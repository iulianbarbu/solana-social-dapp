/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  Keypair,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import fs from 'mz/fs';
import path from 'path';
// import * as borsh from 'borsh';

import {SOCIAL_DAPP_SEED, USER_STATE_SIZE, getPayer, getRpcUrl, createKeypairFromFile, getTarget} from './utils';

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
 * The public key of the account that is target by an initialiser within the social dapp.
 */
 let targetPubkey: PublicKey;

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
 * Establish an account to pay for everything
 */
export async function establishPayer(payerKeyPairPath: string): Promise<void> {
  let fees = 0;
  if (!payer) {
    const {feeCalculator} = await connection.getRecentBlockhash();

    // Calculate the cost to fund the greeter account
    // fees += await connection.getMinimumBalanceForRentExemption(USER_ACCOUNT_SIZE);

    // Calculate the cost of sending transactions
    fees += feeCalculator.lamportsPerSignature * 100; // wag

    payer = await getPayer(payerKeyPairPath, connection, programId);
  }

  let lamports = await connection.getBalance(payer.publicKey);
  if (lamports < fees) {
    // If current balance is not enough to pay for fees, request an airdrop
    const sig = await connection.requestAirdrop(
      payer.publicKey,
      fees - lamports,
    );
    await connection.confirmTransaction(sig);
    lamports = await connection.getBalance(payer.publicKey);
  }

  console.log(
    'Using account',
    payer.publicKey.toBase58(),
    'containing',
    lamports / LAMPORTS_PER_SOL,
    'SOL to pay for fees',
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
  console.log(`Using program ${programId.toBase58()}`);
}

/**
 * Add friend - 0 opcode
 */
export async function addFriend(targetPubkeyStr: string): Promise<void> {
  let targetPubkey: PublicKey;
  if (!targetPubkeyStr) {
    targetPubkey = await getTarget();
  } else {
    targetPubkey = new PublicKey(targetPubkeyStr);
  }

  const targetAccountInfo = await connection.getAccountInfo(targetPubkey);
  if (targetAccountInfo === null) {
    throw 'Error: cannot find the target user account. Please make sure you want to add as a friend an existing user.';
  }

  // Derive the address (public key) of a greeting account from the program so that it's easy to find later.
  let payerUserStatePubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    SOCIAL_DAPP_SEED,
    programId,
  );
  
  console.log('Follow request initiated by ', payer.publicKey.toBase58(), ' to target ', targetPubkey.toBase58());
  
  // Initialize the operation.
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

  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer],
  );
}

/**
 * Remove friend - 1 opcode
 */
 export async function removeFriend(targetPubkeyStr: string): Promise<void> {
  let targetPubkey: PublicKey;
  if (!targetPubkeyStr) {
    targetPubkey = await getTarget();
  } else {
    targetPubkey = new PublicKey(targetPubkeyStr);
  }

  const targetAccountInfo = await connection.getAccountInfo(targetPubkey);
  if (targetAccountInfo === null) {
    throw 'Error: cannot find the target user account. Please make sure you want to add as a friend an existing user.';
  }

  // Derive the address (public key) of a greeting account from the program so that it's easy to find later.
  let payerUserStatePubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    SOCIAL_DAPP_SEED,
    programId,
  );
  
  console.log('Remove request initiated by ', payer.publicKey.toBase58(), ' for target ', targetPubkey.toBase58());
  
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

  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer],
  );
}

/**
 * Remove friend - 2 & 3 opcodes
 */
 export async function setStatus(online: boolean): Promise<void> {
  // Derive the address (public key) of a greeting account from the program so that it's easy to find later.
  let payerUserStatePubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    SOCIAL_DAPP_SEED,
    programId,
  );
  
  console.log('Set status request initiated by ', payer.publicKey.toBase58());
  
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
}