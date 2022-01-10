use solana_program::program_error::ProgramError;
use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    msg,
    pubkey::Pubkey,
};
use crate::instruction::InstructionType;

pub struct Processor;
impl Processor {
    pub fn process(_program_id: &Pubkey, accounts: &[AccountInfo], instruction_data: &[u8]) -> ProgramResult {
        // TODO: check accounts ownership to be the social-dapp program.
        if instruction_data.len() != 1 {
            return Err(ProgramError::InvalidInstructionData);
        }

        let instruction = InstructionType::from(instruction_data[0]);
        if instruction == InstructionType::Unknown {
            msg!("instruction_data[0]: {}", instruction_data[0]);
            return Err(ProgramError::Custom(instruction_data[0] as u32));
        }

        return instruction.handle(accounts);
    }
}
