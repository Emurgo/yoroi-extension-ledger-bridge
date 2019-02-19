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
  console.log('[YOROI-LEDGER-BRIDGE] initialized...');
}

const onError = (error) => {
  console.error(`[YOROI-LEDGER-BRIDGE] ERROR: initialization failed!!!\n${error}`);
}

init();