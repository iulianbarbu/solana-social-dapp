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
  getOnlineFriends
} from './social-dapp-api';

import yargs from 'yargs';

let cmdLineParser = function () {
  const argv = yargs(process.argv)
  .option({
    add: {type: "string", demandOption: false, default: ""},
    remove: {type: "string", demandOption: false, default: ""},
    online: {type: "string", choices: ["false", "true", ""], demandOption: false, default: ""},
    friends: {type: "boolean", demandOption: false, default: false},
    payerKeypairPath: {type: "string", demandOption: false, default: ""}
  })
  .parseSync();

  return argv;
}


async function main() {
  let argv = cmdLineParser();

  // Establish connection to the cluster
  await establishConnection();

  // Check if the program has been deployed
  await checkProgram();

  if (argv.payerKeypairPath && argv.payerKeypairPath != "") {
    // Determine who pays for the fees
    await establishPayer(argv.payerKeypairPath);
  } else {
    await establishPayer();
  }
 
  if (argv.add && argv.add != "") {
    await addFriend(argv.add);
  }

  if (argv.remove && argv.remove != "") {
    await removeFriend(argv.remove);
  }

  if (argv.online && argv.online != "") {
    await setStatus(argv.online == "true");
  }

  if (argv.friends) {
    await getOnlineFriends();
  }
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
