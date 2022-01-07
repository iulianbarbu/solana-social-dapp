/**
 * Social DApp
 */

import {
  establishConnection,
  establishPayer,
  checkProgram,
  addFriend,
  removeFriend,
  setStatus,
} from './social-dapp-api';

import yargs from 'yargs';
import {hideBin} from 'yargs/helpers'

/**
 * Path to the payer key pair - is the same as the transaction initialiser.
 */
let payerKeyPairPath: string;


/**
 * Path to the target pub key.
 */
 let targetPubkeyStr: string;

let cmdLineParser = function () {
  const argv = yargs(process.argv).options({
    payer_key_pair_path: { type: 'string', demandOption: true },
    target_pubkey: { type: 'string', demandOption: true },
  }).parseSync();
  

  payerKeyPairPath = argv.payer_key_pair_path;
  targetPubkeyStr = argv.target_pubkey;
}


async function main() {
  console.log("Starting the social dapp...");
  cmdLineParser();
  // Establish connection to the cluster
  await establishConnection();

  // // Check if the program has been deployed
  await checkProgram();

  // // Determine who pays for the fees
  await establishPayer(payerKeyPairPath);

  await addFriend(targetPubkeyStr);
  await removeFriend(targetPubkeyStr);
  await setStatus(true);
  await setStatus(true);
  await setStatus(false);
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
