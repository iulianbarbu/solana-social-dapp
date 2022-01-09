# Social DApp on Solana

This project is intended to be an example of implementing a minimal social network
on Solana blockchain. It consists of a smart contract (written in Rust) that contract
that can be deployed on localnet (at the moment) and also a typescript library that
provides interaction means with the smart contract API.

## Prerequisites

* Rust 1.57.0
* node 17.3.0
* npm 8.3.0
* solana 1.9.3
* Linux system (the project was developed on Ubuntu, but it might work on MacOS/Windows 
as well, with the required bootstrap).

## How to deploy the smart contract?

1. We must install `solana-cli-tools` as (here)[https://docs.solana.com/cli/install-solana-cli-tools#macos--linux],
`rustup` & latest version of `Rust` (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`), 
nvm (`curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash`) & node (`nvm install 17.3.0 && nvm use 17.3.0`).
`npm` should be installed by installing `node` with `nvm`.

2. Next up, start a validator in a bash terminal: `solana-test-validator`. You might need 
to create first a file based wallet: `solana-keygen new`. The wallet keypair should be present
on `$HOME/.config/solana/id.json`.

3. Run in another terminal `solana logs`.

4. Clone this repo, enter it and run `npm install`.

5. Run `npm run build:program-rust`.

6. Run `npm run deploy`

## How to interact with the smart contract?

1. First, we need the addresses of some friends. Since is hard to find friends nowdays, 
we're going to make some fake ones: Alice and Bob. We generate keypairs for both of them:

    a. `mkdir users && solana-keygen new --outfile users/alice-keypair.json`.

    b. `solana-keygen new --outfile users/bob-keypair.json`.

    c. `solana airdrop 1 <alice_pubkey> && solana airdrop 1 <bob_pubkey>`.

2. Once this is done, we proceed to adding some friends to our current empty friends list:

    a. `solana-keygen pubkey users/alice-keypair.json && solana-keygen pubkey users/bob-keypair.json`.

    b. `npm run start -- --add=<alice-pubkey>`.

    c. `npm run start -- --add=<bob-pubkey>`.

3. Let's see who's online: `npm run start -- --friends`.

4. If all friends are offline, let's set the status of one of them to online:
`npm run start -- --payer-keypair-path=users/alice-keypair.json --online=true`.

5. Let's see again who's online: `npm run start -- --friends`.

6. Let's set Alice status as offline:
`npm run start -- --payer-keypair-path=users/alice-keypair.json --online=false`.

7. Let's see again who's online: `npm run start -- --friends`.

8. Let's set Bob status as online:
`npm run start -- --payer-keypair-path=users/bob-keypair.json --online=true`.

9. Let's see again who's online: `npm run start -- --friends`.

10. Let's remove Bob from friends list (nothing personal):
`npm run start -- --remove=<bob-pubkey>`.

11. Let's see again who's online: `npm run start -- --friends`.
