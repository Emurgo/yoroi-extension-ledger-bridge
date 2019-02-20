// @flow

import 'babel-polyfill'; // this is need but no clear reasion why??
import TransportU2F from '@ledgerhq/hw-transport-u2f';
import AdaApp from '@cardano-foundation/ledgerjs-hw-app-cardano';
import type {
  BIP32Path,
  InputTypeUTxO,
  OutputTypeAddress,
  OutputTypeChange,
  GetVersionResponse
} from '@cardano-foundation/ledgerjs-hw-app-cardano';

type MessageType = {
  action: string,
  success: boolean,
  payload: any
};

const TARGET_IFRAME_NAME = 'YOROI-LEDGER-BRIDGE-IFRAME';

export default class YoroiLedgerBridge {

  constructor () {
    this.addEventListeners();
  }

  /**
   * @description Just to testing connectiong, result is not sent to iframe invoker
   * 
   * @returns {Promise<{major:number, minor:number, patch:number, flags:{isDebug:boolean}}>}
   */
  async getConnectedDeviceVersion(): Promise<GetVersionResponse> {
    const transport = await TransportU2F.create();
    try {
      const adaApp = new AdaApp(transport);
      return adaApp.getVersion();
    } finally {
      transport.close(); 
    }
  }

  /**
   * @description Returns an object containing the app version.
   * 
   * @param {*} replyAction
   * @returns {Promise<{major:number, minor:number, patch:number, flags:{isDebug:boolean}}>} 
   *
   * @example
   * const { major, minor, patch, flags } = await app.getVersion();
   */
  async getVersion(
    replyAction: string
  ): Promise<void> {
    const transport = await TransportU2F.create();
    try {
      const adaApp = new AdaApp(transport);
      const res = await adaApp.getVersion();
      this.sendMessageToExtension({
          action: replyAction,
          success: true,
          payload: res,
      });
    } catch (err) {
      const e = this.ledgerErrToMessage(err);
      this.sendMessageToExtension({
        action: replyAction,
        success: false,
        payload: { error: e.toString() },
      });
    } finally {
      transport.close();
    }
  }
  
  /**
   * @description Get a public key from the specified BIP 32 path.
   * 
   * @param {*} replyAction
   * @param {*} hdPath : The path indexes. Path must begin with `44'/1815'/n'`, and may be up to 10 indexes long. 
   * 
   * @return {Promise<{ publicKey:string, chainCode:string }>} The public key with chaincode for the given path.
   * 
   * @example
   * const { publicKey, chainCode } = await ada.getExtendedPublicKey([ HARDENED + 44, HARDENED + 1815, HARDENED + 1 ]);
   * 
   */
  async getExtendedPublicKey(
    replyAction: string,
    hdPath: BIP32Path
  ): Promise<void> {
    const transport = await TransportU2F.create();
    try {
      const adaApp = new AdaApp(transport);
      const res = await adaApp.getExtendedPublicKey(hdPath);
      this.sendMessageToExtension({
          action: replyAction,
          success: true,
          payload: res,
      });
    } catch (err) {
      const e = this.ledgerErrToMessage(err)
      this.sendMessageToExtension({
        action: replyAction,
        success: false,
        payload: { error: e.toString() },
      });
    } finally {
      transport.close();
    }
  }

  /**
   * @description SignTx on device
   * 
   * @returns { txHashHex, witnesses }
   */
  async signTransaction(
    replyAction: string,
    inputs: Array<InputTypeUTxO>,
    outputs: Array<OutputTypeAddress | OutputTypeChange>
  ): Promise<void> {
    const transport = await TransportU2F.create();
    try {
      const adaApp = new AdaApp(transport);
      const res = await adaApp.signTransaction(inputs, outputs);
      this.sendMessageToExtension({
          action: replyAction,
          success: true,
          payload: res,
      });
    } catch (err) {
      const e = this.ledgerErrToMessage(err);
      this.sendMessageToExtension({
          action: replyAction,
          success: false,
          payload: { error: e.toString() },
      });
    } finally {
      transport.close();
    }
  }

  /**
   * @description Gets an address from the specified BIP 32 path.
   * 
   * @param {*} replyAction 
   * @param {*} hdPath : The path indexes. Path must begin with `44'/1815'/i'/(0 or 1)/j`, and may be up to 10 indexes long
   * 
   * @throws 5001 - The path provided does not have the first 3 indexes hardened or 4th index is not 0 or 1
   * @throws 5002 - The path provided is less than 5 indexes
   * @throws 5003 - Some of the indexes is not a number
   *
   * @example
   * const { address } = await ada.deriveAddress([ HARDENED + 44, HARDENED + 1815, HARDENED + 1, 0, 5 ]);
   * 
   * @return {Promise<{ address58:string }>} The address for the given path.
   */
  async deriveAddress(
    replyAction: string,
    hdPath: BIP32Path
  ): Promise<void> {
    const transport = await TransportU2F.create();
    try {
      const adaApp = new AdaApp(transport);
      const res = await adaApp.deriveAddress(hdPath)
      this.sendMessageToExtension({
          action: replyAction,
          success: true,
          payload: res,
      });
    } catch (err) {
      const e = this.ledgerErrToMessage(err);
      this.sendMessageToExtension({
          action: replyAction,
          success: false,
          payload: { error: e.toString() },
      });
    } finally {
      transport.close();
    }
  }

  addEventListeners(): void {
    window.addEventListener('message', async e => {
      if (e && e.data && e.data.target === TARGET_IFRAME_NAME) {
        const { action, params } = e.data;
        const replyAction = `${action}-reply`;
        switch (action) {
          case 'ledger-get-version':
            this.getVersion(replyAction)
            break;
          case 'ledger-get-extended-public-key':
            this.getExtendedPublicKey(replyAction, params.hdPath)
            break;
          case 'ledger-sign-transaction':
            this.signTransaction(replyAction, params.inputs, params.outputs)
            break;
          case 'ledger-derive-address':
            this.deriveAddress(replyAction, params.hdPath)
            break;
        }
      }
    }, false)
  }

  sendMessageToExtension(msg: MessageType): void {
    window.parent.postMessage(msg, '*');
  }  

  ledgerErrToMessage (err: any): any {
    const isU2FError = (err) => !!err && !!(err).metaData;
    const isStringError = (err) => typeof err === 'string';
    // https://developers.yubico.com/U2F/Libraries/Client_error_codes.html
    const isErrorWithId = (err) => err.hasOwnProperty('id') && err.hasOwnProperty('message');

    if (isU2FError(err)) {
      // Timeout
      if (err.metaData.code === 5) {
        return 'LEDGER_TIMEOUT'
      }
      return err.metaData.type;
    }

    if (isStringError(err)) {
      // Wrong app logged into
      if (err.includes('6804')) {
        return 'LEDGER_WRONG_APP';
      }
      // Ledger locked
      if (err.includes('6801')) {
        return 'LEDGER_LOCKED';
      }  
      return err;
    }

    if (isErrorWithId(err)) {
      // Browser doesn't support U2F
      if (err.message.includes('U2F not supported')) {
        return 'U2F_NOT_SUPPORTED';
      }
    }

    // Other
    return err.toString();
  }

}