'use strict'

import 'babel-polyfill'; // this is need but no clear reasion why??
import TransportU2F from '@ledgerhq/hw-transport-u2f';
import AdaApp from '../node_modules/ledgerhq/hw-app-ada/lib/Ada.js';

export default class YoroiLedgerBridge {

  constructor () {
    // TODO: need to remove EventListeners??, find out
    this.addEventListeners();
  }

  async makeApp () {
    this.transport = await TransportU2F.create();
    this.app = new AdaApp(this.transport);
  }

  cleanUp () {
    this.app = null;
    this.transport.close();
  }

  async getConnectedDeviceVersion() {
    try {
      await this.makeApp();
      return this.app.getVersion();
    } finally {
      this.cleanUp();    
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
  async getVersion(replyAction) {
    try {
      await this.makeApp();
      const res = await this.app.getVersion();
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
      this.cleanUp();
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
  async getExtendedPublicKey(replyAction, hdPath) {
    try {
      await this.makeApp();
      const res = await this.app.getExtendedPublicKey(hdPath);
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
      this.cleanUp();
    }
  }

  /**
   * @description SignTx on device
   * 
   * type InputTypeUTxO = {|
   *   txDataHex: string,
   *   outputIndex: number,
   *   path: BIP32Path
   * |};
   * 
   * type OutputTypeAddress = {|
   *   amountStr: string,
   *   address58: string
   * |};
   * 
   * type OutputTypeChange = {|
   *   amountStr: string,
   *   path: BIP32Path
   * |};  
   * 
   * @param {*} replyAction 
   * @param {*} inputs : Array<InputTypeUTxO>
   * @param {*} outputs : Array<OutputTypeAddress | OutputTypeChange>
   * 
   * @returns { txHashHex, witnesses }
   */
  async signTransaction(replyAction, inputs, outputs) {
    try {
      await this.makeApp();
      const res = await this.app.signTransaction(inputs, outputs);
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
      this.cleanUp();
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
   * @return {Promise<{ address:string }>} The address for the given path.
   */
  async deriveAddress(replyAction, hdPath) {
    try {
      await this.makeApp()
      const res = await this.app.deriveAddress(hdPath)
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
      this.cleanUp();
    }
  }

  addEventListeners() {
    window.addEventListener('message', async e => {
      if (e && e.data && e.data.target === 'LEDGER-IFRAME') {
        const { action, params } = e.data;
        const replyAction = `${action}-reply`;
        switch (action) {
          case 'ledger-unlock':
            this.unlock(replyAction, params.hdPath)
            break;
          case 'ledger-sign-transaction':
            this.signTransaction(replyAction, params.hdPath, params.tx)
            break;
          case 'ledger-sign-personal-message':
            this.signPersonalMessage(replyAction, params.hdPath, params.message)
            break;
        }
      }
    }, false)
  }

  sendMessageToExtension(msg) {
    window.parent.postMessage(msg, '*');
  }  

  ledgerErrToMessage (err) {
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