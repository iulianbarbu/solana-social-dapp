use std::mem::transmute;
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
        match instruction_data[0] {
            0 => {
                let target = next_account_info(account_info_iter)?;
                let bytes_to_be_read = u32::try_from_slice(&initializer_user_state_data[..4])?;
                msg!("bytes to be read: {}", bytes_to_be_read);
                let mut initializer_user_state = match UserState::try_from_slice(&initializer_user_state_data[4 as usize..(4 + bytes_to_be_read as usize)]) {
                    Ok(user_state) => user_state,
                    Err(err) => {
                        msg!("{:?}", err);
                        UserState::default()
                    }
                };
                // msg!("user state data {:?}", initializer_user_state_data[..100]);
                let target_pubkey_string = target.key.to_string();
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
            _ =>  Err(ProgramError::Custom(10))
        }
    }

    // fn process_modify_state(
    //     accounts: &[AccountInfo],
    //     op: u8,
    //     program_id: &Pubkey,
    // ) -> ProgramResult {
      
    //     let token_to_receive_account = next_account_info(account_info_iter)?;
    //     if *token_to_receive_account.owner != spl_token::id() {
    //         return Err(ProgramError::IncorrectProgramId);
    //     }

    //     let escrow_account = next_account_info(account_info_iter)?;
    //     let rent = &Rent::from_account_info(next_account_info(account_info_iter)?)?;

    //     if !rent.is_exempt(escrow_account.lamports(), escrow_account.data_len()) {
    //         return Err(EscrowError::NotRentExempt.into());
    //     }

    //     let mut escrow_info = Escrow::unpack_unchecked(&escrow_account.try_borrow_data()?)?;
    //     if escrow_info.is_initialized() {
    //         return Err(ProgramError::AccountAlreadyInitialized);
    //     }

    //     escrow_info.is_initialized = true;
    //     escrow_info.initializer_pubkey = *initializer.key;
    //     escrow_info.temp_token_account_pubkey = *temp_token_account.key;
    //     escrow_info.initializer_token_to_receive_account_pubkey = *token_to_receive_account.key;
    //     escrow_info.expected_amount = amount;

    //     Escrow::pack(escrow_info, &mut escrow_account.try_borrow_mut_data()?)?;
    //     let (pda, _bump_seed) = Pubkey::find_program_address(&[b"escrow"], program_id);
        
    //     let token_program = next_account_info(account_info_iter)?;
    //     let owner_change_ix = spl_token::instruction::set_authority(
    //         token_program.key,
    //         temp_token_account.key,
    //         Some(&pda),
    //         spl_token::instruction::AuthorityType::AccountOwner,
    //         initializer.key,
    //         &[&initializer.key],
    //     )?;

    //     msg!("Calling the token program to transfer token account ownership...");
    //     invoke(
    //         &owner_change_ix,
    //         &[
    //             temp_token_account.clone(),
    //             initializer.clone(),
    //             token_program.clone(),
    //         ],
    //     )?;

    //     Ok(())
    // }
}
