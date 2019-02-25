#!/bin/bash

echo "[*] pre-install script started"
echo "[*] Setting up @cardano-foundation/ledgerjs-hw-app-cardano module..."

git submodule update --init --recursive && \
cd modules/ledgerjs-hw-app-cardano && \
git checkout 511a674a0801e4fdbf503bea6cfd96d565d2223a && \
yarn && \
yarn run build && \
yarn link && \
cd .. && \
cd .. && \
yarn link "@cardano-foundation/ledgerjs-hw-app-cardano" && \

echo "[*] pre-install script finished"