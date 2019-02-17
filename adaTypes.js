// @flow

/*
 * These types are taken from
 * https://github.com/vacuumlabs/ledgerjs/blob/cardano_app/packages/hw-app-ada/src/Ada.js
 * TODO: find a way to import the types without making this project's dependencies ugly 
*/

export type BIP32Path = Array<number>;

export type InputTypeUTxO = {|
  txDataHex: string,
  outputIndex: number,
  path: BIP32Path
|};

export type OutputTypeAddress = {|
  amountStr: string,
  address58: string
|};

export type OutputTypeChange = {|
  amountStr: string,
  path: BIP32Path
|};

export type Flags = {|
 isDebug: boolean
|};

export type GetVersionResponse = {|
  major: string,
  minor: string,
  patch: string,
  flags: Flags
|};

export type DeriveAddressResponse = {|
  address58: string
|};

export type GetExtendedPublicKeyResponse = {|
  publicKeyHex: string,
  chainCodeHex: string
|};

export type Witness = {|
  path: BIP32Path,
  witnessHex: string
|};

export type SignTransactionResponse = {|
  txHashHex: string,
  witnesses: Array<Witness>
|};
