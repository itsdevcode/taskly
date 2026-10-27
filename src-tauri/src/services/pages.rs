use crate::{
    error::Error,
    models::pages::{Page, PageInput},
    repository::pages as repository,
};
use rusqlite::Connection;
fn validate(mut input: PageInput) -> Result<PageInput, Error> {
    input.title = input.title.trim().to_owned();
    if input.title.is_empty() {
        input.title = "Untitled".into();
    }
    if input.title.chars().count() > 150 {
        return Err(Error::Validation(
            "Page titles must be 150 characters or fewer.".into(),
        ));
    }
    if input.blocks.len() > 1000
        || input.blocks.iter().map(|b| b.text.len()).sum::<usize>() > 2_000_000
    {
        return Err(Error::Validation(
            "This page is too large. Split it into smaller pages.".into(),
        ));
    }
    let mut ids = std::collections::HashSet::new();
    for block in &input.blocks {
        if uuid::Uuid::parse_str(&block.id).is_err() || !ids.insert(&block.id) {
            return Err(Error::Validation(
                "Page blocks must have unique valid IDs.".into(),
            ));
        }
    }
    Ok(input)
}
pub fn create(db: &Connection, input: PageInput) -> Result<Page, Error> {
    let input = validate(input)?;
    let timestamp = super::now();
    let page = Page {
        id: uuid::Uuid::new_v4().to_string(),
        title: input.title,
        blocks: input.blocks,
        created_at: timestamp.clone(),
        updated_at: timestamp,
    };
    repository::insert(db, &page)?;
    Ok(page)
}
pub fn update(db: &Connection, id: &str, input: PageInput) -> Result<Page, Error> {
    let input = validate(input)?;
    let mut page = repository::find(db, id)?;
    page.title = input.title;
    page.blocks = input.blocks;
    page.updated_at = super::now();
    repository::save(db, &page)?;
    Ok(page)
}
