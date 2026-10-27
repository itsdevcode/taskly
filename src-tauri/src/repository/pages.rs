use crate::{error::Error, models::pages::Page};
use rusqlite::{params, Connection, OptionalExtension, Row};
fn row_page(row: &Row<'_>) -> rusqlite::Result<Page> {
    let content: String = row.get(2)?;
    let blocks = serde_json::from_str(&content).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(2, rusqlite::types::Type::Text, Box::new(e))
    })?;
    Ok(Page {
        id: row.get(0)?,
        title: row.get(1)?,
        blocks,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}
pub fn list(db: &Connection) -> Result<Vec<Page>, Error> {
    let mut statement = db.prepare(
        "SELECT id,title,content,created_at,updated_at FROM pages ORDER BY updated_at DESC,id",
    )?;
    let pages = statement
        .query_map([], row_page)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(pages)
}
pub fn find(db: &Connection, id: &str) -> Result<Page, Error> {
    db.query_row(
        "SELECT id,title,content,created_at,updated_at FROM pages WHERE id=?1",
        [id],
        row_page,
    )
    .optional()?
    .ok_or_else(|| Error::Validation("This page no longer exists.".into()))
}
fn content(page: &Page) -> Result<String, Error> {
    serde_json::to_string(&page.blocks)
        .map_err(|_| Error::Validation("The page content could not be saved.".into()))
}
pub fn insert(db: &Connection, page: &Page) -> Result<(), Error> {
    db.execute(
        "INSERT INTO pages (id,title,content,created_at,updated_at) VALUES (?1,?2,?3,?4,?5)",
        params![
            page.id,
            page.title,
            content(page)?,
            page.created_at,
            page.updated_at
        ],
    )?;
    Ok(())
}
pub fn save(db: &Connection, page: &Page) -> Result<(), Error> {
    if db.execute(
        "UPDATE pages SET title=?2,content=?3,updated_at=?4 WHERE id=?1",
        params![page.id, page.title, content(page)?, page.updated_at],
    )? == 0
    {
        return Err(Error::Validation("This page no longer exists.".into()));
    }
    Ok(())
}
pub fn delete(db: &Connection, id: &str) -> Result<(), Error> {
    if db.execute("DELETE FROM pages WHERE id=?1", [id])? == 0 {
        return Err(Error::Validation("This page no longer exists.".into()));
    }
    Ok(())
}
