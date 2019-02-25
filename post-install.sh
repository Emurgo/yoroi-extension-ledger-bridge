#!/bin/bash

echo "[*] post-install script started"
echo "[*] Restarting flow..."

./node_modules/.bin/flow stop && \
yarn run flow && \

echo "[*] post-install script finished"