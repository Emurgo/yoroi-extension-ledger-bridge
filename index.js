// @flow

const {EventEmitter} = require('events');
const HDKey = require('hdkey');

// see SLIP-0044
const coinType = 1815; // Cardano

const hdPathString = `m/44'/${coinType}'/0'`;
const BRIDGE_URL = 'https://emurgo.github.io/yoroi-extension-ledger-bridge/';

type Account = {
  address: string,
  balance: ?number,
  index: number
}

type Options = {
  hdPath: string,
  bridgeUrl: string,
  accounts: Array<Account>
};

type MessageType = {
  target?: string,
  action: string,
  params: any
};

type CallbackType = any => boolean;

export type BIP32Path = Array<number>;

export type InputTypeUTxO = {|
  txDataHex: string,
  outputIndex: number,
  path: BIP32Path
|};
 
export type OutputTypeAddress = {|
  amountStr: string,
  address58: string
|};
 
export type OutputTypeChange = {|
  amountStr: string,
  path: BIP32Path
|};  

class LedgerBridge extends EventEmitter {

  currPage: number;
  perPage: number;
  bridgeUrl: string;
  hdk: HDKey;
  iframe: HTMLIFrameElement;
  hdPath: string;
  bridgeUrl: string;
  accounts: Array<Account>;
  unlockedAccount: number
  
  constructor (opts: Options = {}) {
    super();
    this.bridgeUrl = BRIDGE_URL;
    // pages of accounts on the device
    this.currPage = 1;
    this.perPage = 5;

    this.hdk = new HDKey();

    this.hdPath = opts.hdPath || hdPathString
    this.bridgeUrl = opts.bridgeUrl || BRIDGE_URL;
    this.accounts = opts.accounts || [];

    this.unlockedAccount = 0;

    this.iframe = _setupIframe(this.bridgeUrl);
  }

  serialize (): Promise<Options> {
    return Promise.resolve({
      hdPath: this.hdPath,
      bridgeUrl: this.bridgeUrl,
      accounts: this.accounts,
    })
  }

  // =====================
  //   Account Selection
  // =====================

  isUnlocked (): boolean {
    return !!(this.hdk && this.hdk.publicKey);
  }

  setAccountToUnlock (index: number): void {
    this.unlockedAccount = parseInt(index, 10);
  }

  setHdPath (hdPath: string): void {
    // Reset HDKey if the path changes
    if (this.hdPath !== hdPath) {
      this.hdk = new HDKey();
    }
    this.hdPath = hdPath;
  }

  getFirstPage (): Promise<Array<Account>>  {
    this.currPage = 1;
    return _getPage(this.currPage, this.perPage);
  }

  getNextPage (): Promise<Array<Account>>  {
    this.currPage += 1;
    return _getPage(this.currPage, this.perPage);
  }

  getPreviousPage (): Promise<Array<Account>>  {
    if (this.currPage > 1) {
      this.currPage -= 1;
    }
    return _getPage(this.currPage, this.perPage);
  }

  forgetDevice (): void {
    this.accounts = [];
    this.currPage = 0;
    this.unlockedAccount = 0;
    this.hdk = new HDKey();
  }

  // ==============================
  //   Interface with Cardano app
  // ==============================

  /** Pass major+mintor+patch version to callback */
  getVersion(callback: CallbackType): Promise<void> {
    return new Promise((resolve, reject) => {
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
      });
    });
  }

  /** Get extended public key and pass publicKeyHex+chainCodeHex to callback */
  getExtendedPublicKey(callback: CallbackType): Promise<void> {
    return new Promise((resolve, reject) => {
      let hdPath = _getHdPath(this.unlockedAccount);

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
    });
  }

  /** Get derive address and pas address58 to callback */
  deriveAddress(callback: CallbackType): Promise<void> {
    return new Promise((resolve, reject) => {
      let hdPath = _getHdPath(this.unlockedAccount);

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
    });
  }

  /**
   * Sign a transaction and pass txHashHex+witness to the callback
   */
  signTransaction(
    inputs: Array<InputTypeUTxO>,
    outputs: Array<OutputTypeAddress | OutputTypeChange>,
    callback: CallbackType
  ): Promise<void> {
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
    });
  }

  // ================
  //   Bridge Setup
  // ================

  _getOrigin (): string {
    const tmp = this.bridgeUrl.split('/');
    tmp.splice(-1, 1);
    return tmp.join('/');
  }

  _sendMessage (msg: MessageType, cb: Function) {
    msg.target = 'LEDGER-IFRAME';
    this.iframe.contentWindow.postMessage(msg, '*');
    window.addEventListener('message', ({ origin, data }) => {
      if (origin !== this._getOrigin()) return false;
      if (data && data.action && data.action === `${msg.action}-reply`) {
        cb(data);
      }
    })
  }
}

// ====================
//   Helper Functions
// ====================

function _setupIframe (bridgeUrl: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.src = bridgeUrl;
  
  if (document.head) {
    document.head.appendChild(iframe);
  }

  return iframe;
}

function _getHdPath(account: number): string {
    return _getPathForIndex(account);
}

function _getPage (page: number, perPage: number): Promise<Array<Account>> {
  const from = (page - 1) * perPage;
  const to = from + perPage;

  return _getAccountsBIP44(from, to);
}

async function  _getAccountsBIP44 (from: number, to: number): Promise<Array<Account>> {
  const accounts = [];

  for (let i = from; i < to; i++) {
    const path = _getPathForIndex(i);
    const address = await this.unlock(path);
    const valid = await this._hasPreviousTransactions(address);
    accounts.push({
      address: address,
      balance: null,
      index: i,
    });
    // PER BIP44
    // "Software should prevent a creation of an account if
    // a previous account does not have a transaction history
    // (meaning none of its addresses have been used before)."
    if (!valid) {
      break;
    }
  }
  return accounts;
}

function _getPathForIndex (index: number): string {
  return `m/44'/${coinType}'/${index}'/0/0`;
}

module.exports = LedgerBridge