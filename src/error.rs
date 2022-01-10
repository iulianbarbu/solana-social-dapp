use thiserror::Error;
use solana_program::program_error::ProgramError;

#[derive(Error, Debug, Copy, Clone)]
pub enum SolanaDAppError {
    /// Invalid instruction
    #[error("Invalid User State Data Length")]
    InvalidUserStateDataLength,
    #[error("Handle Friend Instruction")]
    HandleFriendInstruction,
    #[error("Handle Status Instruction")]
    HandleStatusInstruction,
    #[error("Insufficient Accounts For Instruction")]
    InsufficientAccountsForInstruction,
    #[error("Unknown Instruction")]
    UnknownInstruction
}

impl From<SolanaDAppError> for ProgramError {
    fn from(e: SolanaDAppError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
