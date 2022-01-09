# Social DApp design

This project presents friends relationship as follows:

1. Users are represented by real persons that hold a keypair.

2. Each user has an associated user state (a solana account) that holds
information like (user status and the friends list). User state pubkey can
be uniquely derived from the user pubkey and programID.

3. The user friends list is stored in the user state as a HashMap<string, string>,
where the key represents the pubkey of a friend. The value associated with that pubkey
is empty for the moment, but it might get useful in the future if we need to store information
mapped to a friend pubkey directly into a specific user state. You might ask why a set was not
used and that's because `borsh` (current object serialization lib used by the project) does not
support sets on the client side (`borsh-ts`), where we need to query the user state.

4. The smart contract support the following user opperations:
* add friend
* remove friend
* set status to online/offline.

5. There are some inconveniences with the current design:
* the user state account is created with a hardcoded data buffer of 1MB, which does not scale easily
when it comes to supporting more and more users on the app and also richer features.
* everytime we add a friend, remove a friend or change an user status, we write the entirety of
the user state object back to the user state account instead of writing only the diff.