/**
 * Hello world
 */

import {
  establishConnection,
  establishPayer,
  checkProgram,
  addFriend,
} from './social-dapp-api';

async function main() {
  console.log("Starting the social dapp...");

  // Establish connection to the cluster
  await establishConnection();

  // // Check if the program has been deployed
  await checkProgram();

  // // Determine who pays for the fees
  await establishPayer();

  // // Add target to the friends list.
  console.log("First addFriend call returned: ", await addFriend());

  // // Add target to the friends list for a second time.
  console.log("Second addFriend call returned: ", await addFriend());
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
