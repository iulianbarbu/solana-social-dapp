use borsh::BorshSerialize;
use borsh::BorshDeserialize;
use solana_program::program_error::ProgramError;
use solana_program::account_info::next_account_info;
use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    msg,
};
use crate::state::User as UserState;
use crate::error::SolanaDAppError;

const USER_STATE_DATA_MAX_LEN: usize = 1000000;

#[derive(PartialEq, Eq)]
pub enum InstructionType {
    AddFriend,
    RemoveFriend,
    SetStatusOnline,
    SetStatusOffline,
    Unknown
}

impl From<u8> for InstructionType {
    fn from(opcode: u8) -> Self { 
        match opcode {
            0 => Self::AddFriend,
            1 => Self::RemoveFriend,
            2 => Self::SetStatusOnline,
            3 => Self::SetStatusOffline,
            _ => Self::Unknown
        }
     }
}

impl InstructionType {
    pub fn check_accounts_count(&self, accounts: &[AccountInfo]) -> bool {
        match &self {
            Self::AddFriend | Self::RemoveFriend => accounts.len() == 3,
            Self::SetStatusOnline | Self::SetStatusOffline => accounts.len() == 2,
            _ => false
        }
    }

    pub fn handle_friend_instruction(&self,  initializer_key: &String, initializer_user_state_acc: &AccountInfo, target_acc: &AccountInfo) -> ProgramResult {
        let initializer_user_state_data = &mut &mut initializer_user_state_acc.data.borrow_mut();
        if initializer_user_state_data.len() != USER_STATE_DATA_MAX_LEN {
            return Err(SolanaDAppError::InvalidUserStateDataLength.into());
        }

        let target_pubkey_string = target_acc.key.to_string();
        let bytes_to_be_read = u32::try_from_slice(&initializer_user_state_data[..4])?;
        let mut initializer_user_state = match UserState::try_from_slice(&initializer_user_state_data[4 as usize..(4 + bytes_to_be_read as usize)]) {
            Ok(user_state) => user_state,
            Err(_) => UserState::default()
        };
        
        match &self {
            Self::AddFriend => {
                if !initializer_user_state.friends.contains_key(&target_pubkey_string) {
                    initializer_user_state.friends.insert(target_pubkey_string.clone(), String::new());
                    msg!("Added {} as a friend to {}.", target_pubkey_string, initializer_key);
                } else {
                    msg!("{} is already a friend to {}.", target_pubkey_string, initializer_key);
                }
            }
            Self::RemoveFriend => {
                 match initializer_user_state.friends.remove(&target_pubkey_string) {
                    Some(_) => msg!("Remove {} from friends list of {}.", target_pubkey_string, initializer_key),
                    None => msg!("{} is not a friend of {}.", target_pubkey_string, initializer_key)
                 }
            },
            _ => return Err(SolanaDAppError::HandleFriendInstruction.into())
        };
            
            
        let serialized_initializer_state = initializer_user_state.try_to_vec()?;
        let bytes_to_write = serialized_initializer_state.len() as u32;
        initializer_user_state_data[..4].copy_from_slice(&bytes_to_write.try_to_vec()?);
        initializer_user_state_data[4 as usize..(4 + serialized_initializer_state.len()) as usize].copy_from_slice(&serialized_initializer_state);
        
        Ok(())
    }

    pub fn handle_status_instruction(&self, initializer_key: &String, initializer_user_state_acc: &AccountInfo) -> ProgramResult {
        let initializer_user_state_data = &mut &mut initializer_user_state_acc.data.borrow_mut();
        if initializer_user_state_data.len() != USER_STATE_DATA_MAX_LEN {
            return Err(SolanaDAppError::InvalidUserStateDataLength.into());
        }

        let bytes_to_be_read = u32::try_from_slice(&initializer_user_state_data[..4])?;
        let mut initializer_user_state = match UserState::try_from_slice(&initializer_user_state_data[4 as usize..(4 + bytes_to_be_read as usize)]) {
            Ok(user_state) => user_state,
            Err(_) => UserState::default()
        };

        match &self {
            Self::SetStatusOnline => {
                if initializer_user_state.online == 0 {
                    initializer_user_state.online = 1;
                    msg!("Set status of {} as online.", initializer_key);
                } else {
                    msg!("Status of {} already set as online.", initializer_key);
                }
            }
            Self::SetStatusOffline => {
                if initializer_user_state.online == 1 {
                    initializer_user_state.online = 0;
                    msg!("Set status of {} as offline.", initializer_key);
                } else {
                    msg!("Status of {} already set as offline.", initializer_key);
                }
            },
            _ => return Err(SolanaDAppError::HandleStatusInstruction.into())
        };

        let serialized_initializer_state = initializer_user_state.try_to_vec()?;
        let bytes_to_write = serialized_initializer_state.len() as u32;
        initializer_user_state_data[..4].copy_from_slice(&bytes_to_write.try_to_vec()?);
        initializer_user_state_data[4 as usize..(4 + serialized_initializer_state.len()) as usize].copy_from_slice(&serialized_initializer_state);

        Ok(())
    }

    pub fn handle(&self, accounts: &[AccountInfo]) -> ProgramResult {
        // Check if we've received the appropiate accounts.
        if !self.check_accounts_count(accounts) {
            return Err(SolanaDAppError::InsufficientAccountsForInstruction.into());
        }

        // Verify that first account signed the tx.
        let account_info_iter = &mut accounts.iter();
        let initializer_acc = next_account_info(account_info_iter)?;
        if !initializer_acc.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let initializer_key = initializer_acc.key.to_string();
        let initializer_acc: &AccountInfo = next_account_info(account_info_iter)?;
        match &self {
            Self::AddFriend | Self::RemoveFriend => {
                let target_acc: &AccountInfo = next_account_info(account_info_iter)?;
                self.handle_friend_instruction(&initializer_key, initializer_acc, target_acc)
            }
            Self::SetStatusOnline | Self::SetStatusOffline => {
                self.handle_status_instruction(&initializer_key, initializer_acc)
            },
            _ => return Err(SolanaDAppError::UnknownInstruction.into())
        }
    }
}