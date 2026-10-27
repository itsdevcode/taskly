use crate::{
    error::{CommandError, Error},
    models::{Status, Task, TaskInput},
    repository, services,
};
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;
pub struct Database(pub Mutex<Connection>);
fn with_db<T>(
    state: State<'_, Database>,
    operation: impl FnOnce(&Connection) -> Result<T, Error>,
) -> Result<T, CommandError> {
    let db = state
        .0
        .lock()
        .map_err(|_| CommandError::from(Error::Lock))?;
    operation(&db).map_err(Into::into)
}
#[tauri::command]
pub fn create_task(db: State<'_, Database>, input: TaskInput) -> Result<Task, CommandError> {
    with_db(db, |c| services::create(c, input))
}
#[tauri::command]
pub fn update_task(
    db: State<'_, Database>,
    id: String,
    input: TaskInput,
) -> Result<Task, CommandError> {
    with_db(db, |c| services::update(c, &id, input))
}
#[tauri::command]
pub fn delete_task(db: State<'_, Database>, id: String) -> Result<(), CommandError> {
    with_db(db, |c| repository::delete(c, &id))
}
#[tauri::command]
pub fn get_task(db: State<'_, Database>, id: String) -> Result<Task, CommandError> {
    with_db(db, |c| repository::find(c, &id))
}
#[tauri::command]
pub fn list_tasks(db: State<'_, Database>) -> Result<Vec<Task>, CommandError> {
    with_db(db, repository::list)
}
#[tauri::command]
pub fn set_task_status(
    db: State<'_, Database>,
    id: String,
    status: Status,
) -> Result<Task, CommandError> {
    with_db(db, |c| services::set_status(c, &id, status))
}
