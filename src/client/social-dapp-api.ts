/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  Keypair,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import fs from 'mz/fs';
import path from 'path';
import * as borsh from 'borsh';

import {SOCIAL_DAPP_SEED, USER_STATE_SIZE, getPayer, getRpcUrl, createKeypairFromFile, retrieveUserState, UserStateSchema, UserState, retrievePayerUserState, createUserState} from './utils';
import { parseSync } from 'yargs';

/**
 * Connection to the network
 */
let connection: Connection;

/**
 * Keypair associated to the fees' payer, which is also the transaction initaliser
 */
let payer: Keypair;

/**
 * Hello world's program id
 */
let programId: PublicKey;

/**
 * Path to program files
 */
const PROGRAM_PATH = path.resolve(__dirname, '../../dist/program');

/**
 * Path to program shared object file which should be deployed on chain.
 * This file is created when running either:
 *   - `npm run build:program-rust`
 */
const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, 'solana_social_dapp.so');

/**
 * Path to the keypair of the deployed program.
 * This file is created when running `solana program deploy dist/program/solana_social_dapp.so`
 */
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, 'solana_social_dapp-keypair.json');

/**
 * Establish a connection to the cluster
 */
export async function establishConnection(): Promise<void> {
  const rpcUrl = await getRpcUrl();
  connection = new Connection(rpcUrl, 'confirmed');
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', rpcUrl, version);
}

/**
 * Establish an account to pay for everything.
 */
export async function establishPayer(payer_keypair_path?: string): Promise<void> {
  if (payer_keypair_path) {
    payer = await createKeypairFromFile(payer_keypair_path);
    await createUserState(connection, payer, programId);
  }
  
  if (!payer) {
    payer = await getPayer(connection, programId);
  }

  const lamports = await connection.getBalance(payer.publicKey);
  console.log(
    'Using account',
    payer.publicKey.toBase58(),
    'containing',
    lamports / LAMPORTS_PER_SOL,
    'SOL to pay for fees.',
  );
}

/**
 * Check if the hello world BPF program has been deployed
 */
export async function checkProgram(): Promise<void> {
  // Read program id from keypair file
  try {
    const programKeypair = await createKeypairFromFile(PROGRAM_KEYPAIR_PATH);
    programId = programKeypair.publicKey;
  } catch (err) {
    const errMsg = (err as Error).message;
    throw new Error(
      `Failed to read program keypair at '${PROGRAM_KEYPAIR_PATH}' due to error: ${errMsg}. Program may need to be deployed with \`solana program deploy dist/program/helloworld.so\``,
    );
  }

  // Check if the program has been deployed
  const programInfo = await connection.getAccountInfo(programId);
  if (programInfo === null) {
    if (fs.existsSync(PROGRAM_SO_PATH)) {
      throw new Error(
        'Program needs to be deployed with `solana program deploy dist/program/solana_social_dapp.so`',
      );
    } else {
      throw new Error('Program needs to be built and deployed');
    }
  } else if (!programInfo.executable) {
    throw new Error(`Program is not executable`);
  }
  console.log(`Using program ${programId.toBase58()}.`);
}

/**
 * Add friend - 0 opcode.
 */
export async function addFriend(targetPubkeyStr: string): Promise<void> {
  let targetPubkey = new PublicKey(targetPubkeyStr);
  const targetAccountInfo = await connection.getAccountInfo(targetPubkey);
  if (targetAccountInfo === null) {
    throw new Error('[' + payer.publicKey + '] Can not find the target user account: ' 
    + targetPubkeyStr 
    + '. Please make sure you want to add an existing user as a friend.');
  }

  let payerUserStatePubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    SOCIAL_DAPP_SEED,
    programId,
  );
  
  let data = Buffer.alloc(1);
  data[0] = 0;

  const instruction = new TransactionInstruction({
    keys: [
      {pubkey: payer.publicKey, isSigner: true, isWritable: false}, 
      {pubkey: payerUserStatePubkey, isSigner: false, isWritable: true}, 
      {pubkey: targetPubkey, isSigner: false, isWritable: false}],
    programId,
    data,
  });

  let payerUserState = await retrievePayerUserState(connection, payer, programId);
  if (payerUserState && !payerUserState.friends.has(targetPubkeyStr)) {
    await sendAndConfirmTransaction(
      connection,
      new Transaction().add(instruction),
      [payer],
    );
    console.log('[' + payer.publicKey + '] Added ' + targetPubkeyStr + ' to the friends list.');
  } else if(payerUserState) {
    console.log('[' + payer.publicKey + '] ' + targetPubkeyStr + ' already added to the friends list.');
  } else {
    throw new Error('[' + payer.publicKey + '] Failed to add ' + targetPubkeyStr + ' to the friends list.');
  }

  payerUserState = await retrievePayerUserState(connection, payer, programId);
  if (!payerUserState || !payerUserState.friends.has(targetPubkeyStr)) {
    throw new Error('[' + payer.publicKey + '] Failed to add ' + targetPubkeyStr + ' to the friends list.');
  }
}

/**
 * Remove friend - 1 opcode.
 */
 export async function removeFriend(targetPubkeyStr: string): Promise<void> {
  let targetPubkey = new PublicKey(targetPubkeyStr);
  const targetAccountInfo = await connection.getAccountInfo(targetPubkey);
  if (targetAccountInfo === null) {
    throw new Error('[' + payer.publicKey + '] Can not find the target user account. Please make sure you want to remove an existing friend.');
  }

  // Derive the address (public key) of a greeting account from the program so that it's easy to find later.
  let payerUserStatePubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    SOCIAL_DAPP_SEED,
    programId,
  );
  
  // Initialize the operation.
  let data = Buffer.alloc(1);
  data[0] = 1;

  const instruction = new TransactionInstruction({
    keys: [
      {pubkey: payer.publicKey, isSigner: true, isWritable: false}, 
      {pubkey: payerUserStatePubkey, isSigner: false, isWritable: true}, 
      {pubkey: targetPubkey, isSigner: false, isWritable: false}],
    programId,
    data,
  });

  let payerUserState = await retrievePayerUserState(connection, payer, programId);
  if (payerUserState && payerUserState.friends.has(targetPubkeyStr)) {
    await sendAndConfirmTransaction(
      connection,
      new Transaction().add(instruction),
      [payer],
    );
    console.log('[' + payer.publicKey + '] Removed ' + targetPubkeyStr + ' from the friends list.');
  } else if(payerUserState) {
    console.log('[' + payer.publicKey + '] ' + targetPubkeyStr + ' is not part of the friends list.');
  } else {
    throw new Error('[' + payer.publicKey + '] Failed to remove ' + targetPubkeyStr + ' from the friends list.');
  }

  payerUserState = await retrievePayerUserState(connection, payer, programId);
  if (!payerUserState || payerUserState.friends.has(targetPubkeyStr)) {
    throw new Error('[' + payer.publicKey + '] Failed to remove ' + targetPubkeyStr + ' from the friends list.');
  }
}

/**
 * Set status - 2 & 3 opcodes.
 */
 export async function setStatus(online: boolean): Promise<void> {
  // Derive the address (public key) of a greeting account from the program so that it's easy to find later.
  let payerUserStatePubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    SOCIAL_DAPP_SEED,
    programId,
  );
  
  // Initialize the operation.
  let data = Buffer.alloc(1);
  data[0] = online ? 2 : 3;

  const instruction = new TransactionInstruction({
    keys: [
      {pubkey: payer.publicKey, isSigner: true, isWritable: false}, 
      {pubkey: payerUserStatePubkey, isSigner: false, isWritable: true}, 
    ],
    programId,
    data,
  });

  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer],
  );

  let payerUserState = await retrievePayerUserState(connection, payer, programId);
  if (payerUserState && (payerUserState.online == 0 ? false : true) == online) {
    console.log('[' + payer.publicKey + '] Status set to ' + online + '.');
  } else {
    throw new Error('[' + payer.publicKey + '] Failed to set status to ' + online + '.');
  }
}

/**
 * Get online friends.
 * This operation reads through the existing accounts on the blockchain, hence, it does not interact with the
 * deployed social dapp smart contract.
 */
 export async function getOnlineFriends(): Promise<void> {
  let payerUserState = await retrievePayerUserState(connection, payer, programId);
  let onlineFriends = [];
  for (const friend of payerUserState.friends.keys()) {
    let friendUserStatePubkey = await PublicKey.createWithSeed(
      new PublicKey(friend),
      SOCIAL_DAPP_SEED,
      programId
    );
    let friendUserState = await retrieveUserState(connection, friendUserStatePubkey);
    if (friendUserState && friendUserState.online) {
      onlineFriends.push(friend);
    }
  }

  if (onlineFriends.length > 0) {
    console.log("[" + payer.publicKey.toBase58() + "] Online friends: ", onlineFriends + ".");
  } else {
    console.log("[" + payer.publicKey.toBase58() + "] All friends are offline.");
  }
}