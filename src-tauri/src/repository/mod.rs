use crate::{
    error::Error,
    models::{Status, Task},
};
use rusqlite::{params, Connection, OptionalExtension, Row};
fn row_task(row: &Row<'_>) -> rusqlite::Result<Task> {
    let status: String = row.get(3)?;
    let status = match status.as_str() {
        "pending" => Status::Pending,
        "completed" => Status::Completed,
        _ => return Err(rusqlite::Error::InvalidQuery),
    };
    Ok(Task {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        status,
        due_date: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
        completed_at: row.get(7)?,
    })
}
pub fn list(db: &Connection) -> Result<Vec<Task>, Error> {
    let mut statement = db.prepare("SELECT id,title,description,status,due_date,created_at,updated_at,completed_at FROM tasks ORDER BY created_at DESC, id")?;
    let tasks = statement
        .query_map([], row_task)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(tasks)
}
pub fn find(db: &Connection, id: &str) -> Result<Task, Error> {
    db.query_row("SELECT id,title,description,status,due_date,created_at,updated_at,completed_at FROM tasks WHERE id=?1", [id], row_task).optional()?.ok_or(Error::NotFound)
}
pub fn insert(db: &Connection, task: &Task) -> Result<(), Error> {
    db.execute("INSERT INTO tasks (id,title,description,status,due_date,created_at,updated_at,completed_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",params![task.id,task.title,task.description,task.status.as_str(),task.due_date,task.created_at,task.updated_at,task.completed_at])?;
    Ok(())
}
pub fn save(db: &Connection, task: &Task) -> Result<(), Error> {
    let changed = db.execute("UPDATE tasks SET title=?2,description=?3,status=?4,due_date=?5,updated_at=?6,completed_at=?7 WHERE id=?1",params![task.id,task.title,task.description,task.status.as_str(),task.due_date,task.updated_at,task.completed_at])?;
    if changed == 0 {
        return Err(Error::NotFound);
    }
    Ok(())
}
pub fn delete(db: &Connection, id: &str) -> Result<(), Error> {
    if db.execute("DELETE FROM tasks WHERE id=?1", [id])? == 0 {
        return Err(Error::NotFound);
    }
    Ok(())
}
