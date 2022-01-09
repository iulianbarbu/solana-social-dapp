/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import os from 'os';
import fs from 'mz/fs';
import path from 'path';
import yaml from 'yaml';
import {Connection, Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction} from '@solana/web3.js';
import * as borsh from 'borsh';


/**
 * Hardcoded value for UserState.
 * TODO: Determine what is the required value for a specific amount of users.
 */
export const USER_STATE_SIZE = 1000000;

/**
 * Hardcoded value for a seeded needed by the SystemProgram to create custom accounts.
 */
export const SOCIAL_DAPP_SEED = 'INITIALIZE_STATE';

/**
 * The state of a greeting account managed by the hello world program
*/
export class UserState {
  online = 0;
  friends = new Map();
  constructor(fields: {online: number, friends: Map<string, string>} | undefined = undefined) {
    if (fields) {
      this.online = fields.online;
      this.friends = fields.friends;
    }
  }
}

/**
 * Borsh schema definition for greeting accounts
 */
export const UserStateSchema = new Map([
  [UserState, {kind: 'struct', fields: [['online', 'u8'], ['friends', {kind: 'map', key: 'string', value: 'string'}]]}],
]);


/**
 * @private
 */
async function getConfig(): Promise<any> {
  // Path to Solana CLI config file
  const CONFIG_FILE_PATH = path.resolve(
    os.homedir(),
    '.config',
    'solana',
    'cli',
    'config.yml',
  );
  const configYml = await fs.readFile(CONFIG_FILE_PATH, {encoding: 'utf8'});
  return yaml.parse(configYml);
}

/**
 * Load and parse the Solana CLI config file to determine which RPC url to use
 */
export async function getRpcUrl(): Promise<string> {
  try {
    const config = await getConfig();
    if (!config.json_rpc_url) throw new Error('Missing RPC URL');
    return config.json_rpc_url;
  } catch (err) {
    console.warn(
      'Failed to read RPC url from CLI config file, falling back to localhost',
    );
    return 'http://localhost:8899';
  }
}

export async function retrieveUserState(connection: Connection, pubkey: PublicKey): Promise<UserState> {
  let userStateAcc = await connection.getAccountInfo(pubkey);
  if (!userStateAcc) {
    return new UserState();
  }

  let dataview = new DataView(userStateAcc.data.slice(0, 4).buffer);
  let userStateLen = dataview.getInt32(0, true);
  // Requirement for having an empty serialized `UserState` object.
  if (userStateLen >= 5) {
    return borsh.deserialize(UserStateSchema, UserState, userStateAcc.data.slice(4, 4 + userStateLen));
  }
  
  return new UserState();
}

export async function retrievePayerUserState(connection: Connection, keypair: Keypair, programId: PublicKey): Promise<UserState> {
  // Derive the address (public key) of a greeting account from the program so that it's easy to find later.
  let payerUserStatePubkey = await PublicKey.createWithSeed(
    keypair.publicKey,
    SOCIAL_DAPP_SEED,
    programId,
  );
  return await retrieveUserState(connection, payerUserStatePubkey);
}

export async function createUserState(connection: Connection, keypair: Keypair, programId: PublicKey): Promise<PublicKey> {
  // Derive the address (public key) of a greeting account from the program so that it's easy to find later.
  let userStatePubkey = await PublicKey.createWithSeed(
    keypair.publicKey,
    SOCIAL_DAPP_SEED,
    programId,
  );

  // Check if the greeting account has already been created
  const payerUserStateAccount = await connection.getAccountInfo(userStatePubkey);
  if (payerUserStateAccount === null) {
    console.log(
      'Creating user state account',
      userStatePubkey.toBase58(),
      'for ', keypair.publicKey.toBase58() + "."
    );
  

    const {feeCalculator} = await connection.getRecentBlockhash();
    
    let fees = 0;
    // Calculate the cost to fund the greeter account
    fees = await connection.getMinimumBalanceForRentExemption(USER_STATE_SIZE);

    // Calculate the cost of sending transactions
    fees += feeCalculator.lamportsPerSignature * 100; // wag

    let lamports = await connection.getBalance(keypair.publicKey);
    if (lamports < fees) {
      // If current balance is not enough to pay for fees, request an airdrop
      const sig = await connection.requestAirdrop(
        keypair.publicKey,
        fees - lamports,
      );
      await connection.confirmTransaction(sig);
      lamports = await connection.getBalance(keypair.publicKey);
    }

    lamports = await connection.getMinimumBalanceForRentExemption(
      USER_STATE_SIZE,
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: keypair.publicKey,
        basePubkey: keypair.publicKey,
        seed: SOCIAL_DAPP_SEED,
        newAccountPubkey: userStatePubkey,
        lamports,
        space: USER_STATE_SIZE,
        programId,
      }),
    );

    await sendAndConfirmTransaction(connection, transaction, [keypair]);
  }
  
  return userStatePubkey;
}

/**
 * Load and parse the Solana CLI config file to determine which payer to use
 */
export async function getPayer(connection: Connection, programId: PublicKey): Promise<Keypair> {
  try {
    const config = await getConfig();
    let keypair_path = config.keypair_path;
    if (!keypair_path) throw new Error('Missing keypair from ' +  keypair_path + '.');
    let keypair = await createKeypairFromFile(keypair_path);
    await createUserState(connection, keypair, programId);
    return keypair;
  } catch (_) {
    throw new Error('Failed to create keypair from CLI config file.');
  }
}

/**
 * Create a Keypair from a secret key stored in file as bytes' array
 */
export async function createKeypairFromFile(
  filePath: string,
): Promise<Keypair> {
  const secretKeyString = await fs.readFile(filePath, {encoding: 'utf8'});
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return Keypair.fromSecretKey(secretKey);
}
