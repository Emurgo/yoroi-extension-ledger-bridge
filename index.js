const {EventEmitter} = require('events')
const HDKey = require('hdkey')

// see SLIP-0044
const coinType = 1815; // Cardano

const hdPathString = `m/44'/${coinType}'/0'`
const BRIDGE_URL = 'https://emurgo.github.io/yoroi-extension-ledger-bridge/'

class LedgerBridge extends EventEmitter {
  constructor (opts = {}) {
    super()
    this.bridgeUrl = null
    // pages of accounts on the device
    this.page = 0
    this.perPage = 5

    this.hdk = new HDKey()
    this.iframe = null
    this.deserialize(opts)
    this._setupIframe()
  }

  serialize () {
    return Promise.resolve({
      hdPath: this.hdPath,
      accounts: this.accounts,
      bridgeUrl: this.bridgeUrl,
    })
  }

  deserialize (opts = {}) {
    this.hdPath = opts.hdPath || hdPathString
    this.bridgeUrl = opts.bridgeUrl || BRIDGE_URL
    this.accounts = opts.accounts || []
    return Promise.resolve()
  }

  // =====================
  //   Account Selection
  // =====================

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

  getFirstPage () {
    this.page = 0
    return this.__getPage(1)
  }

  getNextPage () {
    return this.__getPage(1)
  }

  getPreviousPage () {
    return this.__getPage(-1)
  }

  forgetDevice () {
    this.accounts = []
    this.page = 0
    this.unlockedAccount = 0
    this.hdk = new HDKey()
  }

  // ==============================
  //   Interface with Cardano app
  // ==============================

  /** Pass major+mintor+patch version to callback */
  getVersion() {
    this._sendMessage({
      action: 'ledger-get-version',
      params: {
      },
    },
    ({success, payload}) => {
      if (success) {
        if (callback(payload)) {
          resolve();
        } else {
          reject(new Error('Ledger: getVersion callback failed'))
        }
      }
    })
  }

  /** Get extended public key and pass publicKeyHex+chainCodeHex to callback */
  getExtendedPublicKey() {
    return new Promise((resolve, reject) => {
      let hdPath = _getHdPath();

      this._sendMessage({
        action: 'ledger-get-extended-public-key',
        params: {
          hdPath,
        },
      },
      ({success, payload}) => {
        if (success) {
          if (callback(payload)) {
            resolve();
          } else {
            reject(new Error('Ledger: getExtendedPublicKey callback failed'))
          }
        }
      })
    })
  }

  /** Get derive address and pas address58 to callback */
  deriveAddress() {
    return new Promise((resolve, reject) => {
      let hdPath = _getHdPath();

      this._sendMessage({
        action: 'ledger-derive-address',
        params: {
          hdPath,
        },
      },
      ({success, payload}) => {
        if (success) {
          if (callback(payload)) {
            resolve();
          } else {
            reject(new Error('Ledger: deriveAddress callback failed'))
          }
        }
      })
    })
  }

  /**
   * Sign a transaction and pass txHashHex+witness to the callback
   */
  signTransaction(inputs, outputs, callback) {
    return new Promise((resolve, reject) => {
        this._sendMessage({
          action: 'ledger-sign-transaction',
          params: {
            inputs,
            outputs
          },
        },
        ({success, payload}) => {
          if (success) {
            if (callback(payload)) {
              resolve();
            } else {
              reject(new Error('Ledger: signTransaction callback failed'))
            }
          }
        })
    })
  }

  // ================
  //   Bridge Setup
  // ================

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

  // ====================
  //   Helper Functions
  // ====================

  _getHdPath () {
      return this._getPathForIndex(this.unlockedAccount);
  }

  __getPage (increment) {

    this.page += increment

    if (this.page <= 0) { this.page = 1 }
    const from = (this.page - 1) * this.perPage
    const to = from + this.perPage

    return new Promise((resolve, reject) => {
      this.unlock()
        .then(async _ => {
          let accounts = await this._getAccountsBIP44(from, to)
          resolve(accounts)
        })
    })
  }

  async _getAccountsBIP44 (from, to) {
    const accounts = []

    for (let i = from; i < to; i++) {
      const path = this._getPathForIndex(i)
      const address = await this.unlock(path)
      const valid = await this._hasPreviousTransactions(address)
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

  _getPathForIndex (index) {
    return `m/44'/${coinType}'/${index}'/0/0`
  }
}

module.exports = LedgerBridge