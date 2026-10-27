use crate::{
    error::Error,
    models::{Status, Task, TaskInput},
    repository,
};
use chrono::{NaiveDate, SecondsFormat, Utc};
use rusqlite::Connection;
fn now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}
fn validate(mut input: TaskInput) -> Result<TaskInput, Error> {
    input.title = input.title.trim().to_owned();
    if input.title.is_empty() || input.title.chars().count() > 150 {
        return Err(Error::Validation(
            "Enter a title between 1 and 150 characters.".into(),
        ));
    }
    if let Some(date) = &input.due_date {
        if date.len() != 10
            || date.starts_with("0000")
            || NaiveDate::parse_from_str(date, "%Y-%m-%d").is_err()
        {
            return Err(Error::Validation(
                "Choose a valid due date (YYYY-MM-DD).".into(),
            ));
        }
    }
    Ok(input)
}
pub fn create(db: &Connection, input: TaskInput) -> Result<Task, Error> {
    let input = validate(input)?;
    let timestamp = now();
    let task = Task {
        id: uuid::Uuid::new_v4().to_string(),
        title: input.title,
        description: input.description,
        due_date: input.due_date,
        status: Status::Pending,
        created_at: timestamp.clone(),
        updated_at: timestamp,
        completed_at: None,
    };
    repository::insert(db, &task)?;
    Ok(task)
}
pub fn update(db: &Connection, id: &str, input: TaskInput) -> Result<Task, Error> {
    let input = validate(input)?;
    let mut task = repository::find(db, id)?;
    task.title = input.title;
    task.description = input.description;
    task.due_date = input.due_date;
    task.updated_at = now();
    repository::save(db, &task)?;
    Ok(task)
}
pub fn set_status(db: &Connection, id: &str, status: Status) -> Result<Task, Error> {
    let mut task = repository::find(db, id)?;
    if task.status != status {
        task.status = status;
        task.updated_at = now();
        task.completed_at = if status == Status::Completed {
            Some(task.updated_at.clone())
        } else {
            None
        };
        repository::save(db, &task)?;
    }
    Ok(task)
}
