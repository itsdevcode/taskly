mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod repository;
pub mod services;
use tauri::Manager;
pub fn run() {
    let result = tauri::Builder::default()
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            let connection = db::open(&directory.join("taskly.db"))?;
            app.manage(commands::Database(std::sync::Mutex::new(connection)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_task,
            commands::update_task,
            commands::delete_task,
            commands::get_task,
            commands::list_tasks,
            commands::set_task_status
        ])
        .run(tauri::generate_context!());
    if let Err(error) = result {
        eprintln!("Taskly could not start: {error}");
        std::process::exit(1);
    }
}
