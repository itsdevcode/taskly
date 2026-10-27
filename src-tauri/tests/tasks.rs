use chrono::NaiveDate;
use taskly_lib::{
    db,
    error::Error,
    models::{Status, TaskInput, View},
    repository, services,
};
fn input(title: &str, due: Option<&str>) -> TaskInput {
    TaskInput {
        title: title.into(),
        description: "Details".into(),
        due_date: due.map(Into::into),
    }
}
fn date(s: &str) -> NaiveDate {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").expect("test date")
}
#[test]
fn create_update_delete_and_status_transitions() {
    let db = db::open(std::path::Path::new(":memory:")).expect("database");
    let task = services::create(&db, input("  First task  ", None)).expect("create");
    assert_eq!(task.title, "First task");
    assert_eq!(task.status, Status::Pending);
    assert!(task.completed_at.is_none());
    assert_eq!(task.id.len(), 36);
    assert!(task.created_at.ends_with('Z'));
    let updated =
        services::update(&db, &task.id, input("Renamed", Some("2026-10-28"))).expect("update");
    assert_eq!(updated.title, "Renamed");
    assert_eq!(updated.created_at, task.created_at);
    let completed = services::set_status(&db, &task.id, Status::Completed).expect("complete");
    assert!(completed.completed_at.is_some());
    let repeated = services::set_status(&db, &task.id, Status::Completed).expect("idempotent");
    assert_eq!(repeated.completed_at, completed.completed_at);
    let edited =
        services::update(&db, &task.id, input("Still complete", None)).expect("edit completed");
    assert_eq!(edited.completed_at, completed.completed_at);
    let reopened = services::set_status(&db, &task.id, Status::Pending).expect("reopen");
    assert!(reopened.completed_at.is_none());
    repository::delete(&db, &task.id).expect("delete");
    assert!(repository::list(&db).expect("list").is_empty());
    assert!(matches!(
        repository::find(&db, &task.id),
        Err(Error::NotFound)
    ));
    assert!(matches!(
        repository::delete(&db, &task.id),
        Err(Error::NotFound)
    ));
}
#[test]
fn validates_titles_and_calendar_dates() {
    let db = db::open(std::path::Path::new(":memory:")).expect("database");
    for title in ["", "   ", &"x".repeat(151)] {
        assert!(matches!(
            services::create(&db, input(title, None)),
            Err(Error::Validation(_))
        ));
    }
    assert!(services::create(&db, input(&"😀".repeat(150), None)).is_ok());
    for invalid in [
        "2026-02-29",
        "2026-13-01",
        "2026-1-01",
        "2026-10-27T00:00:00Z",
        "garbage",
    ] {
        assert!(services::create(&db, input("Task", Some(invalid))).is_err());
    }
    assert!(services::create(&db, input("Leap day", Some("2028-02-29"))).is_ok());
    let task = services::create(&db, input("Original", None)).expect("create");
    assert!(services::update(&db, &task.id, input("", None)).is_err());
    assert_eq!(
        repository::find(&db, &task.id).expect("get").title,
        "Original"
    );
}
#[test]
fn exclusive_views_overdue_and_local_calendar_boundaries() {
    let db = db::open(std::path::Path::new(":memory:")).expect("database");
    let today = date("2026-10-27");
    for (due, view, overdue) in [
        (None, View::Pending, false),
        (Some("2026-10-26"), View::Pending, true),
        (Some("2026-10-27"), View::Pending, false),
        (Some("2026-10-28"), View::Upcoming, false),
    ] {
        let task = services::create(&db, input("Task", due)).expect("create");
        assert_eq!(task.view(today), view);
        assert_eq!(task.overdue(today), overdue);
        let complete = services::set_status(&db, &task.id, Status::Completed).expect("complete");
        assert_eq!(complete.view(today), View::Completed);
        assert!(!complete.overdue(today));
    }
    let task = services::create(&db, input("New year", Some("2027-01-01"))).expect("create");
    assert_eq!(task.view(date("2026-12-31")), View::Upcoming);
    assert_eq!(task.view(date("2027-01-01")), View::Pending);
    assert!(task.overdue(date("2027-01-02")));
    // Callers supply the user's date, never the UTC date, including across DST.
    let dst = services::create(&db, input("DST", Some("2026-11-01"))).expect("create");
    assert_eq!(dst.view(date("2026-10-31")), View::Upcoming);
    assert_eq!(dst.view(date("2026-11-01")), View::Pending);
}
#[test]
fn persists_across_restarts_and_migrations_are_idempotent() {
    let folder = tempfile::tempdir().expect("temp directory");
    let path = folder.path().join("tasks.db");
    let id = {
        let db = db::open(&path).expect("open");
        services::create(&db, input("Keep me", Some("2026-10-27")))
            .expect("create")
            .id
    };
    let db = db::open(&path).expect("reopen");
    assert_eq!(
        repository::find(&db, &id)
            .expect("persisted")
            .due_date
            .as_deref(),
        Some("2026-10-27")
    );
    assert!(db
        .execute("UPDATE tasks SET status='upcoming' WHERE id=?1", [&id])
        .is_err());
    assert!(db
        .execute("UPDATE tasks SET status='completed' WHERE id=?1", [&id])
        .is_err());
}
#[test]
fn parameterized_queries_preserve_sql_text() {
    let db = db::open(std::path::Path::new(":memory:")).expect("database");
    let title = "'); DROP TABLE tasks; --";
    let task = services::create(&db, input(title, None)).expect("create");
    assert_eq!(repository::find(&db, &task.id).expect("find").title, title);
    assert_eq!(repository::list(&db).expect("list").len(), 1);
}
