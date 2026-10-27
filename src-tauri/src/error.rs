use serde::Serialize;
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{0}")]
    Validation(String),
    #[error("This task no longer exists.")]
    NotFound,
    #[error("The local database could not complete the operation.")]
    Database(#[from] rusqlite::Error),
    #[error("The local database is unavailable. Restart Taskly to try again.")]
    Lock,
}
#[derive(Serialize)]
pub struct CommandError {
    code: &'static str,
    message: String,
}
impl From<Error> for CommandError {
    fn from(error: Error) -> Self {
        let code = match &error {
            Error::Validation(_) => "validation",
            Error::NotFound => "not_found",
            _ => "database",
        };
        Self {
            code,
            message: error.to_string(),
        }
    }
}
