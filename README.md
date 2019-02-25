# yoroi-extension-ledger-bridge

## Overview 

To connect to the Ledger device, we need to use a u2f connection (WebUSB is rejected by Firefox). However, [u2f doesn't work in extensions](https://bugs.chromium.org/p/chromium/issues/detail?id=823736) and so to fix this, we host the u2f connection on a Github Pages and then add that to Yoroi through an iframe.

## Implementation

We host [cardano-foundation/ledgerjs-hw-app-cardano](https://github.com/cardano-foundation/ledgerjs-hw-app-cardano) on the `gh-pages` [branch](https://github.com/Emurgo/yoroi-extension-ledger-bridge/tree/gh-pages) the interface to connect to this page on the `master` branch.

Hosted page [link](https://emurgo.github.io/yoroi-extension-ledger-bridge/).

To use this interface, simply add the `master` branch as a dependency to your `node` project.

**Note**: Assumes wallet is BIP44 compliant

## Build

```
yarn install
yarn build
```