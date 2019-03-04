// @flow

import type {
  BIP32Path,
  InputTypeUTxO,
  OutputTypeAddress,
  OutputTypeChange,
  GetVersionResponse,
  DeriveAddressResponse,
  GetExtendedPublicKeyResponse,
  SignTransactionResponse
} from '@cardano-foundation/ledgerjs-hw-app-cardano';

import EventEmitter from 'events';

// https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#examples
// https://github.com/satoshilabs/slips/blob/master/slip-0044.md
const HARDENED = 0x80000000;
const PURPOSE = 44;
const COIN_TYPE = 1815; // Cardano
export const BIP44_HARDENED_CARDANO_FIRST_ACCOUNT_SUB_PATH: BIP32Path = [
  HARDENED + PURPOSE,
  HARDENED + COIN_TYPE,
  HARDENED + 0, // FIRST_ACCOUNT
];

const BRIDGE_URL = 'https://emurgo.github.io/yoroi-extension-ledger-bridge';
export const TARGET_IFRAME_NAME = 'YOROI-LEDGER-BRIDGE-IFRAME';

type MessageType = {
  target?: string,
  action: string,
  params: any
};

export type ConnectionType = 'webusb' | 'u2f';

export class LedgerBridge extends EventEmitter {

  bridgeUrl: string;
  iframe: HTMLIFrameElement;

  /**
   * Use `bridgeOverride` to use this library with your own website
   * 
   * @param {*} iframe 
   * @param {*} bridgeOverride 
   * @param {*} connectionType 'webusb' | 'u2f'
   */
  constructor (
    iframe: ?HTMLIFrameElement = null,
    bridgeOverride: string = BRIDGE_URL,
    connectionType: ConnectionType = 'u2f',
  ) {
    super();
    this.bridgeUrl = bridgeOverride + '?' + connectionType;
    this.iframe = (iframe) ? iframe : _setupIframe(this.bridgeUrl);
  }

  // ==============================
  //   Interface with Cardano app
  // ==============================

  getVersion(): Promise<GetVersionResponse> {
    return new Promise((resolve, reject) => {
      this._sendMessage({
        action: 'ledger-get-version',
        params: {
        },
      },
      ({success, payload}) => {
        if (success) {
          resolve(payload);
        } else {
          reject(new Error('Ledger: getVersion failed'))
        }
      });
    });
  }

  getExtendedPublicKey(
    hdPath: BIP32Path
  ): Promise<GetExtendedPublicKeyResponse> {
    return new Promise((resolve, reject) => {
      this._sendMessage({
        action: 'ledger-get-extended-public-key',
        params: {
          hdPath,
        },
      },
      ({success, payload}) => {
        if (success) {
          resolve(payload);
        } else {
          reject(new Error('Ledger: getExtendedPublicKey failed'))
        }
      })
    });
  }

  deriveAddress(
    hdPath: BIP32Path
  ): Promise<DeriveAddressResponse> {
    return new Promise((resolve, reject) => {
      this._sendMessage({
        action: 'ledger-derive-address',
        params: {
          hdPath,
        },
      },
      ({success, payload}) => {
        if (success) {
          resolve(payload);
        } else {
          reject(new Error('Ledger: deriveAddress failed'))
        }
      })
    });
  }

  signTransaction(
    inputs: Array<InputTypeUTxO>,
    outputs: Array<OutputTypeAddress | OutputTypeChange>
  ): Promise<SignTransactionResponse> {
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
            resolve(payload);
          } else {
            reject(new Error('Ledger: signTransaction failed'))
          }
        })
    });
  }

  _sendMessage (
    msg: MessageType,
    cb: ({ success: boolean, payload: any}) => void
  ) {
    msg.target = TARGET_IFRAME_NAME;
    this.iframe.contentWindow.postMessage(msg, '*');
    window.addEventListener('message', ({ origin, data }) => {
      if (origin !== _getOrigin(this.bridgeUrl)) return false;
      if (data && data.action && data.action === `${msg.action}-reply`) {
        cb(data);
      }
    })
  }
}

// ================
//   Bridge Setup
// ================

function _getOrigin (bridgeUrl: string): string {
  const tmp = bridgeUrl.split('/');
  tmp.splice(-1, 1);
  return tmp.join('/');
}

function _setupIframe (bridgeUrl: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.src = bridgeUrl;
  iframe.id = TARGET_IFRAME_NAME
  
  if (document.head) {
    document.head.appendChild(iframe);
  }

  return iframe;
}

// ====================
//   Helper Functions
// ====================

/**
 * See BIP44 for explanation
 * https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#examples
 * Ledger (according to current security rules) denies any derivation path which does not start with
 *  `[HD+44, HD+1815, HD+(account), chain, address]`
 * 
 * @param {*} account account index eg: { 0 = first account , 1 = second account ...}
 * @param {*} chain 0 = external or 1 = change
 * @param {*} address address index eg: { 0 = first address , 1 = second address ...}
 */
export function makeCardanoBIP44Path (
  account: number,
  chain: number,
  address: number
): BIP32Path {
  return [
    HARDENED + PURPOSE,
    HARDENED + COIN_TYPE,
    HARDENED + account,
    chain,
    address
  ];
}

export * from '@cardano-foundation/ledgerjs-hw-app-cardano';