// @flow

import YoroiLedgerBridge from './yoroi-ledger-bridge';

let bridge;

const init = async () => {
  try {
    bridge = new YoroiLedgerBridge();

    window.onload = function(e) { 
      document.getElementById("versionButton")
        .addEventListener('click', async () => logConnectedDeviceVersion());
    }

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
  console.info('[YOROI-LB] initialized...');
}

const onError = (error) => {
  console.error(`[YOROI-LB] ERROR: initialization failed!!!\n${error}`);
}

/**
 * Test Ledger connection : Console Log Connected Device Version
 */
const logConnectedDeviceVersion = async () => {
  try {
    const deviceVersion = await bridge.getConnectedDeviceVersion();
    console.info('[YOROI-LB] Connected Ledger device version: '
      + JSON.stringify(deviceVersion, null , 2));
  } catch (error) {
    console.error(error);
    console.info('[YOROI-LB] '
      + 'Is your Ledger Nano S device connected to your system\'s USB port?');
  }
}

init();
