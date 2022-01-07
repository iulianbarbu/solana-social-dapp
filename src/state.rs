use std::collections::HashMap;
use borsh::{BorshSerialize, BorshDeserialize};

#[derive(BorshSerialize, BorshDeserialize, Debug, Default)]
pub struct User {
    pub online: u8,
    // We're required to use a HashMap because of borsh-js lack of support for HashSet.
    pub friends: HashMap<String, String>,

}