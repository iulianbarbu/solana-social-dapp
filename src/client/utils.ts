/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import os from 'os';
import fs from 'mz/fs';
import path from 'path';
import yaml from 'yaml';
import {Connection, Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction} from '@solana/web3.js';


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

/**
 * Load and parse the Solana CLI config file to determine which payer to use
 */
export async function getPayer(connection: Connection, programId: PublicKey): Promise<Keypair> {
  try {
    const config = await getConfig();
    if (!config.keypair_path) throw new Error('Missing keypair path');
    let key_pair = await createKeypairFromFile(config.keypair_path);
    
    {
      // Derive the address (public key) of a greeting account from the program so that it's easy to find later.
      let payerUserStatePubkey = await PublicKey.createWithSeed(
        key_pair.publicKey,
        SOCIAL_DAPP_SEED,
        programId,
      );

      // Check if the greeting account has already been created
      const payerUserStateAccount = await connection.getAccountInfo(payerUserStatePubkey);
      if (payerUserStateAccount === null) {
        console.log(
          'Creating user state account',
          payerUserStatePubkey.toBase58(),
          'for payer.',
        );
        const lamports = await connection.getMinimumBalanceForRentExemption(
          USER_STATE_SIZE,
        );

        const transaction = new Transaction().add(
          SystemProgram.createAccountWithSeed({
            fromPubkey: key_pair.publicKey,
            basePubkey: key_pair.publicKey,
            seed: SOCIAL_DAPP_SEED,
            newAccountPubkey: payerUserStatePubkey,
            lamports,
            space: USER_STATE_SIZE,
            programId,
          }),
        );
        await sendAndConfirmTransaction(connection, transaction, [key_pair]);
      }
    }
    return key_pair;
  } catch (err) {
    console.warn(
      'Failed to create keypair from CLI config file, falling back to new random keypair',
    );
    return Keypair.generate();
  }
}

/**
 * Load and parse the Solana CLI config file to determine who is the target of the payer
 */
 export async function getTarget(): Promise<PublicKey> {
    const config = await getConfig();
    if (!config.social_dapp_target || config.social_dapp_target == "") throw new Error('Missing social dapp target');
    return new PublicKey(config.social_dapp_target);
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
