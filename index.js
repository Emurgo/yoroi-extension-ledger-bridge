const {EventEmitter} = require('events')
const HDKey = require('hdkey')

// see SLIP-0044
const coinType = 1815; // Cardano

const hdPathString = `m/44'/${coinType}'/0'`
const type = 'Ledger Hardware'
const BRIDGE_URL = 'https://emurgo.github.io/yoroi-extension-ledger-bridge/'
const pathBase = 'm'
const MAX_INDEX = 1000 // TBD do we want this?

class LedgerBridgeKeyring extends EventEmitter {
  constructor (opts = {}) {
    super()
    this.bridgeUrl = null
    this.type = type
    this.hdk = new HDKey()
    this.paths = {}
    this.iframe = null
    this.implementFullBIP44 = true
    this.deserialize(opts)
    this._setupIframe()
  }

  serialize () {
    return Promise.resolve({
      hdPath: this.hdPath,
      accounts: this.accounts,
      bridgeUrl: this.bridgeUrl,
      implementFullBIP44: false,
    })
  }

  deserialize (opts = {}) {
    this.hdPath = opts.hdPath || hdPathString
    this.bridgeUrl = opts.bridgeUrl || BRIDGE_URL
    this.accounts = opts.accounts || []
    this.implementFullBIP44 = opts.implementFullBIP44 || true
    return Promise.resolve()
  }

  isUnlocked () {
    return !!(this.hdk && this.hdk.publicKey)
  }

  setAccountToUnlock (index) {
    this.unlockedAccount = parseInt(index, 10)
  }

  setHdPath (hdPath) {
    // Reset HDKey if the path changes
    if (this.hdPath !== hdPath) {
      this.hdk = new HDKey()
    }
    this.hdPath = hdPath
  }

  /**
   * Sign a transaction and pass it to the callback
   * Callback will verify tx and populate any required fields
   */
  signTransaction (tx, callback) {
    return new Promise((resolve, reject) => {
        let hdPath
        if (this._isBIP44()) {
          hdPath = this._getPathForIndex(this.unlockedAccount)
        } else {
          hdPath = this._toLedgerPath(this._pathFromAddress(address))
        }

        this._sendMessage({
          action: 'ledger-sign-transaction',
          params: {
            tx: tx.serialize().toString('hex'),
            hdPath,
          },
        },
        ({success, payload}) => {
          if (success) {
            if (callback(payload, tx)) {
              resolve(tx);
            } else {
              reject(new Error('Ledger: The transaction verification failed'))
            }
          }
        })
    })
  }

  signMessage (withAccount, data) {
    throw new Error('Not supported on this device')
  }

  // For personal_sign, we need to prefix the message:
  signPersonalMessage (withAccount, message) {
    const humanReadableMsg = this._toAscii(message)
    const bufferMsg = Buffer.from(humanReadableMsg).toString('hex')
    return new Promise((resolve, reject) => {
      this.unlock()
        .then(_ => {
          let hdPath
          if (this._isBIP44()) {
            hdPath = this._getPathForIndex(this.unlockedAccount)
          } else {
            hdPath = this._toLedgerPath(this._pathFromAddress(withAccount))
          }

          this._sendMessage({
            action: 'ledger-sign-personal-message',
            params: {
              hdPath,
              message: bufferMsg,
            },
          },
          ({success, payload}) => {
            if (success) {
              let v = payload['v'] - 27
              v = v.toString(16)
              if (v.length < 2) {
                v = `0${v}`
              }
              const signature = `0x${payload['r']}${payload['s']}${v}`
              const addressSignedWith = sigUtil.recoverPersonalSignature({data: message, sig: signature})
              if (ethUtil.toChecksumAddress(addressSignedWith) !== ethUtil.toChecksumAddress(withAccount)) {
                reject(new Error('Ledger: The signature doesnt match the right address'))
              }
              resolve(signature)
            } else {
              reject(new Error(payload.error || 'Ledger: Uknown error while signing message'))
            }
          })
      })
    })
  }

  signTypedData (withAccount, typedData) {
    throw new Error('Not supported on this device')
  }

  exportAccount (address) {
    throw new Error('Not supported on this device')
  }

  forgetDevice () {
    this.accounts = []
    this.page = 0
    this.unlockedAccount = 0
    this.paths = {}
    this.hdk = new HDKey()
  }

  /* PRIVATE METHODS */

  _setupIframe () {
    this.iframe = document.createElement('iframe')
    this.iframe.src = this.bridgeUrl
    document.head.appendChild(this.iframe)
  }
  _getOrigin () {
    const tmp = this.bridgeUrl.split('/')
    tmp.splice(-1, 1)
    return tmp.join('/')
  }

  _sendMessage (msg, cb) {
    msg.target = 'LEDGER-IFRAME'
    this.iframe.contentWindow.postMessage(msg, '*')
    window.addEventListener('message', ({ origin, data }) => {
      if (origin !== this._getOrigin()) return false
      if (data && data.action && data.action === `${msg.action}-reply`) {
        cb(data)
      }
    })
  }

  __getPage (increment) {

    this.page += increment

    if (this.page <= 0) { this.page = 1 }
    const from = (this.page - 1) * this.perPage
    const to = from + this.perPage

    return new Promise((resolve, reject) => {
      this.unlock()
        .then(async _ => {
          let accounts
          if (this._isBIP44()) {
            accounts = await this._getAccountsBIP44(from, to)
          } else {
            accounts = this._getAccountsLegacy(from, to)
          }
          resolve(accounts)
        })
    })
  }

  async _getAccountsBIP44 (from, to) {
    const accounts = []

    for (let i = from; i < to; i++) {
      const path = this._getPathForIndex(i)
      const address = await this.unlock(path)
      const valid = this.implementFullBIP44 ? await this._hasPreviousTransactions(address) : true
      accounts.push({
        address: address,
        balance: null,
        index: i,
      })
      // PER BIP44
      // "Software should prevent a creation of an account if
      // a previous account does not have a transaction history
      // (meaning none of its addresses have been used before)."
      if (!valid) {
        break
      }
    }
    return accounts
  }

  _getAccountsLegacy (from, to) {
    const accounts = []

    for (let i = from; i < to; i++) {
      const address = this._addressFromIndex(pathBase, i)
      accounts.push({
        address: address,
        balance: null,
        index: i,
      })
      this.paths[ethUtil.toChecksumAddress(address)] = i
    }
    return accounts
  }

  _padLeftEven (hex) {
    return hex.length % 2 !== 0 ? `0${hex}` : hex
  }

  _normalize (buf) {
    return this._padLeftEven(ethUtil.bufferToHex(buf).toLowerCase())
  }

  _addressFromIndex (pathBase, i) {
    const dkey = this.hdk.derive(`${pathBase}/${i}`)
    const address = ethUtil
      .publicToAddress(dkey.publicKey, true)
      .toString('hex')
    return ethUtil.toChecksumAddress(address)
  }

  _pathFromAddress (address) {
    const checksummedAddress = ethUtil.toChecksumAddress(address)
    let index = this.paths[checksummedAddress]
    if (typeof index === 'undefined') {
      for (let i = 0; i < MAX_INDEX; i++) {
        if (checksummedAddress === this._addressFromIndex(pathBase, i)) {
          index = i
          break
        }
      }
    }

    if (typeof index === 'undefined') {
      throw new Error('Unknown address')
    }
    return this._getPathForIndex(index)
  }

  _toAscii (hex) {
      let str = ''
      let i = 0; const l = hex.length
      if (hex.substring(0, 2) === '0x') {
          i = 2
      }
      for (; i < l; i += 2) {
          const code = parseInt(hex.substr(i, 2), 16)
          str += String.fromCharCode(code)
      }

      return str
  }

  _getPathForIndex (index) {
    // Check if the path is BIP 44 (Ledger Live)
    return this._isBIP44() ? `m/44'/${coinType}'/${index}'/0/0` : `${this.hdPath}/${index}`
  }

  _isBIP44 () {
    return this.hdPath === `m/44'/${coinType}'/0'/0/0`
  }

  _toLedgerPath (path) {
    return path.toString().replace('m/', '')
  }
}

LedgerBridgeKeyring.type = type
module.exports = LedgerBridgeKeyring