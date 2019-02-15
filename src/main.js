'use strict'

import YoroiLedgerBridge from './yoroi-ledger-bridge';

const init = async () => {
  try {
    const bridge = new YoroiLedgerBridge();
    (bridge) ? onSuccess() : onError();
  } catch(error) {
    onError();
  }
}

const onSuccess = () => {
  console.log('Yoroi Extension Ledger hardware wallet bridge initialized...');
}

const onError = (error) => {
  console.error(`ERROR: Yoroi Extension Ledger hardware wallet bridge initialization failed!!!\n${error}`);
}

init();