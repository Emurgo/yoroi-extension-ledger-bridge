const HARDENED = 0x80000000;

const {
  EventEmitter
} = require('events'); // see SLIP-0044


const coinType = 1815; // Cardano

const BRIDGE_URL = 'https://emurgo.github.io/yoroi-extension-ledger-bridge/';

class LedgerBridge extends EventEmitter {
  /**
   * Use `bridgeOverride` to use this library with your own website
   */
  constructor(bridgeOverride = null) {
    super();
    this.bridgeUrl = bridgeOverride || BRIDGE_URL;
    this.iframe = _setupIframe(this.bridgeUrl);
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
          reject(new Error('Ledger: getVersion failed'));
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
          reject(new Error('Ledger: getExtendedPublicKey failed'));
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
          reject(new Error('Ledger: deriveAddress failed'));
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
          reject(new Error('Ledger: signTransaction failed'));
        }
      });
    });
  }

  _sendMessage(msg, cb) {
    msg.target = 'LEDGER-IFRAME';
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

  if (document.head) {
    document.head.appendChild(iframe);
  }

  return iframe;
} // ====================
//   Helper Functions
// ====================

/** See BIP44 for explanation
 * https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#examples
 * 
 * Ledger (according to current security rules) denies any derivation path which does not start with
 *  `[HD+44, HD+1815, HD+(small) account number]`
 */


function getPathHelper(account, change, address) {
  return [HARDENED + 44, HARDENED + coinType, HARDENED + account, change ? 1 : 0, address];
}

module.exports = LedgerBridge;