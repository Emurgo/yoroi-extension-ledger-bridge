import EventEmitter from 'events'; // https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#examples
// https://github.com/satoshilabs/slips/blob/master/slip-0044.md

const HARDENED = 0x80000000;
const PURPOSE = 44;
const COIN_TYPE = 1815; // Cardano

const BRIDGE_URL = 'https://emurgo.github.io/yoroi-extension-ledger-bridge';
export const YOROI_LEDGER_BRIDGE_IFRAME_NAME = 'YOROI-LEDGER-BRIDGE-IFRAME';
export class LedgerBridge extends EventEmitter {
  /**
   * Use `bridgeOverride` to use this library with your own website
   * 
   * @param {*} iframe 
   * @param {*} bridgeOverride 
   * @param {*} connectionType 'webusb' | 'u2f'
   */
  constructor(iframe = null, bridgeOverride = BRIDGE_URL, connectionType = 'u2f') {
    super();
    this.isReady = false;
    this.bridgeUrl = bridgeOverride + '?' + connectionType;
    this.iframe = iframe ? iframe : _setupIframe(this.bridgeUrl);

    this.iframe.onload = () => {
      this.isReady = true;
      console.debug('[YOROI-LB-CONNECTOR]:: iframe is completely loaded');
    };
  } // ==============================
  //   Interface with Cardano app
  // ==============================


  getVersion() {
    return new Promise((resolve, reject) => {
      this._sendMessage({
        action: 'ledger-get-version',
        params: {}
      }, ({
        success,
        payload
      }) => {
        if (success) {
          resolve(payload);
        } else {
          reject(new Error(_prepareError(payload)));
        }
      });
    });
  }

  getExtendedPublicKey(hdPath) {
    return new Promise((resolve, reject) => {
      this._sendMessage({
        action: 'ledger-get-extended-public-key',
        params: {
          hdPath
        }
      }, ({
        success,
        payload
      }) => {
        if (success) {
          resolve(payload);
        } else {
          reject(new Error(_prepareError(payload)));
        }
      });
    });
  }

  deriveAddress(hdPath) {
    return new Promise((resolve, reject) => {
      this._sendMessage({
        action: 'ledger-derive-address',
        params: {
          hdPath
        }
      }, ({
        success,
        payload
      }) => {
        if (success) {
          resolve(payload);
        } else {
          reject(new Error(_prepareError(payload)));
        }
      });
    });
  }

  showAddress(hdPath) {
    return new Promise((resolve, reject) => {
      this._sendMessage({
        action: 'ledger-show-address',
        params: {
          hdPath
        }
      }, ({
        success,
        payload
      }) => {
        if (success) {
          resolve(payload);
        } else {
          reject(new Error(_prepareError(payload)));
        }
      });
    });
  }

  signTransaction(inputs, outputs) {
    return new Promise((resolve, reject) => {
      this._sendMessage({
        action: 'ledger-sign-transaction',
        params: {
          inputs,
          outputs
        }
      }, ({
        success,
        payload
      }) => {
        if (success) {
          resolve(payload);
        } else {
          reject(new Error(_prepareError(payload)));
        }
      });
    });
  }

  _sendMessage(msg, cb) {
    msg.target = YOROI_LEDGER_BRIDGE_IFRAME_NAME;
    this.iframe.contentWindow.postMessage(msg, '*');
    window.addEventListener('message', ({
      origin,
      data
    }) => {
      if (origin !== _getOrigin(this.bridgeUrl)) return false;

      if (data && data.action && data.action === `${msg.action}-reply`) {
        cb(data);
      }
    });
  }

} // ================
//   Bridge Setup
// ================

function _getOrigin(bridgeUrl) {
  const tmp = bridgeUrl.split('/');
  tmp.splice(-1, 1);
  return tmp.join('/');
}

function _setupIframe(bridgeUrl) {
  const iframe = document.createElement('iframe');
  iframe.src = bridgeUrl;
  iframe.id = YOROI_LEDGER_BRIDGE_IFRAME_NAME;

  if (document.head) {
    document.head.appendChild(iframe);
  }

  return iframe;
} // ====================
//   Helper Functions
// ====================


function _prepareError(payload) {
  return payload && payload.error ? payload.error : 'SOMETHING_UNEXPECTED_HAPPENED';
}
/**
 * Get the Bip44 path required to specify an address
 *
 * https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#examples
 * Ledger (according to current security rules) denies any derivation path which does not start with
 *  `[HD+44, HD+1815, HD+(account), chain, address]`
 * 
 * @param {*} account account index eg: { 0 = first account , 1 = second account ...}
 * @param {*} chain 0 = external or 1 = change
 * @param {*} address address index eg: { 0 = first address , 1 = second address ...}
 */


export function makeCardanoBIP44Path(account, chain, address) {
  return [HARDENED + PURPOSE, HARDENED + COIN_TYPE, HARDENED + account, chain, address];
}
/**
 * Get the Bip44 path required to create an account
 *
 * See BIP44 for explanation
 * https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#examples
 * Ledger (according to current security rules) denies any derivation path which does not start with
 *  `[HD+44, HD+1815, HD+(account)]`
 */

export function makeCardanoAccountBIP44Path(account) {
  return [HARDENED + PURPOSE, HARDENED + COIN_TYPE, HARDENED + account];
}
export function toDerivationPathString(derivationPath) {
  return `m/${derivationPath.map(item => item % HARDENED + (item >= HARDENED ? "'" : '')).join('/')}`;
}