use borsh::BorshSerialize;
use borsh::BorshDeserialize;
use solana_program::program_error::ProgramError;
use solana_program::account_info::next_account_info;
use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    msg,
    pubkey::Pubkey,
};
use crate::state::User as UserState;

pub struct Processor;
impl Processor {
    pub fn process(_program_id: &Pubkey, accounts: &[AccountInfo], instruction_data: &[u8]) -> ProgramResult {
        // TODO: check accounts ownership to be the social-dapp program.
        if instruction_data.len() != 1 {
            return Err(ProgramError::InvalidInstructionData);
        }

        let account_info_iter = &mut accounts.iter();
        let initializer = next_account_info(account_info_iter)?;
        if !initializer.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let initializer_user_state_acc = next_account_info(account_info_iter)?;
        let initializer_user_state_data = &mut &mut initializer_user_state_acc.data.borrow_mut();
        if initializer_user_state_data.len() != 1000000 {
            return Err(ProgramError::InvalidAccountData);
        }

        // 0 - add friend
        // 1 - remove friend
        // 2 - set online true
        // 4 - get online friends (TODO)
        match instruction_data[0] {
            0 => {
                let target = next_account_info(account_info_iter)?;
                let target_pubkey_string = target.key.to_string();
                let bytes_to_be_read = u32::try_from_slice(&initializer_user_state_data[..4])?;
                let mut initializer_user_state = match UserState::try_from_slice(&initializer_user_state_data[4 as usize..(4 + bytes_to_be_read as usize)]) {
                    Ok(user_state) => user_state,
                    Err(_) => {
                        UserState::default()
                    }
                };
                if !initializer_user_state.friends.contains_key(&target_pubkey_string) {
                    initializer_user_state.friends.insert(target_pubkey_string.clone(), String::new());
                    
                    let serialized_initializer_state = initializer_user_state.try_to_vec()?;
                    let bytes_to_write = serialized_initializer_state.len() as u32;
                    initializer_user_state_data[..4].copy_from_slice(&bytes_to_write.try_to_vec()?);
                    initializer_user_state_data[4 as usize..(4 + serialized_initializer_state.len()) as usize].copy_from_slice(&serialized_initializer_state);
                    
                    msg!("Added {} as a friend to {}.", target_pubkey_string, initializer.key.to_string());
                    Ok(())
                } else {
                    msg!("{} is already a friend to {}.", target_pubkey_string, initializer.key.to_string());
                    Ok(())
                }
            },
            1 => {
                let target = next_account_info(account_info_iter)?;
                let target_pubkey_string = target.key.to_string();
                let bytes_to_be_read = u32::try_from_slice(&initializer_user_state_data[..4])?;
                let mut initializer_user_state = match UserState::try_from_slice(&initializer_user_state_data[4 as usize..(4 + bytes_to_be_read as usize)]) {
                    Ok(user_state) => user_state,
                    Err(_) => {
                        UserState::default()
                    }
                };
                match initializer_user_state.friends.remove(&target_pubkey_string) {
                    Some(_) => {
                        let serialized_initializer_state = initializer_user_state.try_to_vec()?;
                        let bytes_to_write = serialized_initializer_state.len() as u32;
                        initializer_user_state_data[..4].copy_from_slice(&bytes_to_write.try_to_vec()?);
                        initializer_user_state_data[4 as usize..(4 + serialized_initializer_state.len()) as usize].copy_from_slice(&serialized_initializer_state);
                        msg!("Remove {} from friends list of {}.", target_pubkey_string, initializer.key.to_string());
                        Ok(())
                    },
                    None => {
                        msg!("{} is not a friend of {}.", target_pubkey_string, initializer.key.to_string());
                        Ok(())
                    }
                }
            },
            2 => {
                let bytes_to_be_read = u32::try_from_slice(&initializer_user_state_data[..4])?;
                let mut initializer_user_state = match UserState::try_from_slice(&initializer_user_state_data[4 as usize..(4 + bytes_to_be_read as usize)]) {
                    Ok(user_state) => user_state,
                    Err(_) => {
                        UserState::default()
                    }
                };
                if initializer_user_state.online == 0 {
                    initializer_user_state.online = 1;
                    let serialized_initializer_state = initializer_user_state.try_to_vec()?;
                    let bytes_to_write = serialized_initializer_state.len() as u32;
                    initializer_user_state_data[..4].copy_from_slice(&bytes_to_write.try_to_vec()?);
                    initializer_user_state_data[4 as usize..(4 + serialized_initializer_state.len()) as usize].copy_from_slice(&serialized_initializer_state);
                    msg!("Set status of {} as online.", initializer.key.to_string());
                    Ok(())
                } else {
                    msg!("Status of {} already set as online.", initializer.key.to_string());
                    Ok(())
                }
            },
            3 => {
                let bytes_to_be_read = u32::try_from_slice(&initializer_user_state_data[..4])?;
                let mut initializer_user_state = match UserState::try_from_slice(&initializer_user_state_data[4 as usize..(4 + bytes_to_be_read as usize)]) {
                    Ok(user_state) => user_state,
                    Err(_) => {
                        UserState::default()
                    }
                };
                if initializer_user_state.online == 1 {
                    initializer_user_state.online = 0;
                    let serialized_initializer_state = initializer_user_state.try_to_vec()?;
                    let bytes_to_write = serialized_initializer_state.len() as u32;
                    initializer_user_state_data[..4].copy_from_slice(&bytes_to_write.try_to_vec()?);
                    initializer_user_state_data[4 as usize..(4 + serialized_initializer_state.len()) as usize].copy_from_slice(&serialized_initializer_state);
                    msg!("Set status of {} as offline.", initializer.key.to_string());
                    Ok(())
                } else {
                    msg!("Status of {} already set as offline.", initializer.key.to_string());
                    Ok(())
                }
            },
            4 => {
                let bytes_to_be_read = u32::try_from_slice(&initializer_user_state_data[..4])?;
                let mut _initializer_user_state = match UserState::try_from_slice(&initializer_user_state_data[4 as usize..(4 + bytes_to_be_read as usize)]) {
                    Ok(user_state) => user_state,
                    Err(_) => {
                        UserState::default()
                    }
                };
                // TODO
                Ok(())
            }
            _ =>  {
                msg!("instruction_data[0]: {}", instruction_data[0]);
                Err(ProgramError::Custom(instruction_data[0] as u32))
            }
        }
    }
}
