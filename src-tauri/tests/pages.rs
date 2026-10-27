use taskly_lib::{
    db,
    models::pages::{Block, BlockKind, PageInput},
    repository, services,
};
fn input(title: &str) -> PageInput {
    PageInput {
        title: title.into(),
        blocks: vec![Block {
            id: uuid::Uuid::new_v4().to_string(),
            kind: BlockKind::Checklist,
            text: "Remember this\nA second line".into(),
            checked: true,
        }],
    }
}
#[test]
fn page_crud_and_persistence() {
    let folder = tempfile::tempdir().expect("temp");
    let path = folder.path().join("test.db");
    let id = {
        let db = db::open(&path).expect("open");
        let page = services::pages::create(&db, input("  Notes  ")).expect("create");
        assert_eq!(page.title, "Notes");
        page.id
    };
    let db = db::open(&path).expect("reopen");
    let page = repository::pages::find(&db, &id).expect("get");
    assert!(page.blocks[0].checked);
    assert!(page.blocks[0].text.contains('\n'));
    let updated = services::pages::update(&db, &id, input("Changed")).expect("update");
    assert_eq!(updated.created_at, page.created_at);
    assert_eq!(updated.title, "Changed");
    assert_eq!(repository::pages::list(&db).expect("list").len(), 1);
    repository::pages::delete(&db, &id).expect("delete");
    assert!(repository::pages::find(&db, &id).is_err());
    assert!(repository::pages::delete(&db, &id).is_err());
}
#[test]
fn validates_page_titles_and_unique_block_ids() {
    let db = db::open(std::path::Path::new(":memory:")).expect("open");
    assert_eq!(
        services::pages::create(&db, input("  "))
            .expect("untitled")
            .title,
        "Untitled"
    );
    assert!(services::pages::create(&db, input(&"x".repeat(151))).is_err());
    let mut duplicate = input("Duplicate");
    duplicate.blocks.push(duplicate.blocks[0].clone());
    assert!(services::pages::create(&db, duplicate).is_err());
    let mut invalid = input("Invalid");
    invalid.blocks[0].id = "invalid".into();
    assert!(services::pages::create(&db, invalid).is_err());
    let text = "'); DROP TABLE pages; --";
    let page = services::pages::create(&db, input(text)).expect("SQL-safe title");
    assert_eq!(
        repository::pages::find(&db, &page.id).expect("get").title,
        text
    );
}
#[test]
fn migration_from_v1_preserves_tasks() {
    let folder = tempfile::tempdir().expect("temp");
    let path = folder.path().join("old.db");
    {
        let db = rusqlite::Connection::open(&path).expect("open");
        db.execute_batch(include_str!("../migrations/001_initial.sql"))
            .expect("old schema");
        db.pragma_update(None, "user_version", 1).expect("version");
        services::create(
            &db,
            taskly_lib::models::TaskInput {
                title: "Existing task".into(),
                description: String::new(),
                due_date: None,
            },
        )
        .expect("task");
    }
    let db = db::open(&path).expect("migrate");
    assert_eq!(
        repository::list(&db).expect("tasks")[0].title,
        "Existing task"
    );
    assert!(repository::pages::list(&db).expect("pages").is_empty());
    drop(db);
    assert!(db::open(&path).is_ok());
}
