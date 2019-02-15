'use strict'

import YoroiLedgerBridge from './yoroi-ledger-bridge';

const init = async () => {
  try {
    const bridge = new YoroiLedgerBridge();
    if (bridge) {
      onSuccess(bridge);
    } else {
      onError()
    }
  } catch(error) {
    onError(error);
  }
}

const onSuccess = async (bridge) => {
  console.log('Yoroi Extension Ledger hardware wallet bridge initialized...');
  try {
    const deviceVersion = await bridge.getConnectedDeviceVersion();
    console.info(`Connected Ledger device version: ${JSON.stringify(deviceVersion)}`);
  } catch (error) {
    console.info('No Ledger Nano S device is connected to system USB port');
  }
}

const onError = (error) => {
  console.error(`ERROR: Yoroi Extension Ledger hardware wallet bridge initialization failed!!!\n${error}`);
}

init();