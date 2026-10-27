# Taskly

A quiet, offline desktop task manager built with Tauri 2, Rust, React, TypeScript, Tailwind CSS, and SQLite. Windows is the primary build target. There are no accounts, network services, analytics, or seeded tasks.

## Run

Install Node.js 20.19+ (22 recommended), pnpm 10, stable Rust, Microsoft C++ Build Tools with **Desktop development with C++**, and Microsoft Edge WebView2. See the [official Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). Reopen your terminal after installing Rust.

```powershell
npm install --global pnpm@10
pnpm install --frozen-lockfile
pnpm tauri dev
```

`pnpm dev` runs the frontend alone. It displays an explicit desktop-required message because SQLite is accessed only through Tauri; it does not create a second browser storage implementation.

## Check and build

```powershell
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --locked --manifest-path src-tauri/Cargo.toml
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
pnpm tauri build
```

The Windows NSIS installer is generated in `src-tauri/target/release/bundle/nsis/`. It installs for the current user. Public releases should use your own Windows signing certificate; this project's local installer is unsigned. GitHub Actions runs the frontend, browser, Rust, formatting and Clippy checks, builds the installer, and uploads it as an artifact. It does not publish a release automatically.

For future macOS/Linux packaging, install the [platform prerequisites](https://v2.tauri.app/start/prerequisites/) and select the appropriate bundle target (`pnpm tauri build --bundles app` on macOS, for example). The data/repository/UI layers contain no Windows-specific code.

## Use

- Add, inspect, edit, complete, reopen, and delete tasks. Deletion requires confirmation.
- Pending includes overdue, today's, and undated incomplete tasks, in that order. Upcoming includes incomplete tasks after today. Completed includes completed tasks with any due date, newest completion first. These three categories are exclusive. All Tasks includes all three.
- Search matches titles and descriptions case-insensitively. Smart order uses each view's default. Due date and newest-first sorts are also available.
- Ctrl/Cmd+N creates a task; Ctrl/Cmd+F focuses search. Escape closes a dialog. Enter submits a task form from a single-line field; Enter in the description inserts a newline.
- Settings includes Light, Dark, and System themes, remembered on the device. Native modal dialogs trap focus and return it to the previous control.

## Data and architecture

`src-tauri/src/db` initializes SQLite and applies migrations transactionally using `PRAGMA user_version`. The first migration lives in `src-tauri/migrations/001_initial.sql`; subsequent migrations should increment the version and run in the same transaction. Updates must retain the application identifier `com.taskly.desktop` so they retain the data path.

The database is `taskly.db` in Tauri's platform app data directory: usually `%APPDATA%\com.taskly.desktop\taskly.db` on Windows. SQLite WAL and a five-second busy timeout are enabled. To back up data, close Taskly and copy the database (and any remaining `-wal`/`-shm` files) together. No task data is written into the installation directory. Uninstalling/replacing the executable does not explicitly delete the database.

Models, repository, services, and commands are separate small Rust modules. Commands return serialized `{ code, message }` errors; UI mutations wait for SQLite success. A mutex serializes local database operations. All SQL values are bound parameters. UUIDs identify tasks; UTC RFC 3339 timestamps record creation, updates, and completion. Completing twice preserves the original completion time; reopening clears it. The database checks statuses, title lengths, and completion consistency. The service validates exact calendar dates.

Due dates are `YYYY-MM-DD` **local calendar dates**, never UTC instants. React compares them against a date built from local calendar components. It refreshes that date every 30 seconds and on window focus/visibility changes, so leaving the app open overnight or changing timezones updates classifications. Date-only display uses local noon to avoid UTC/DST midnight shifts; timestamps use the user's locale/timezone.

`src/lib/tasks.ts` owns frontend classification/search/sorting. `src/lib/api.ts` is the typed IPC boundary. React state is local to the app; no state management library or cloud fallback is used. Theme preference is the only setting stored in webview localStorage. The CSP restricts resources to bundled assets and Tauri IPC.

## Tests and manual acceptance

Rust integration tests use temporary real SQLite databases, covering CRUD, input limits, invalid/leap dates, idempotent status transitions, parameter binding, exclusive categories, overdue/undated tasks, new-year/DST dates, constraints, migrations and persistence across reopen. Frontend tests cover classification, local-date construction, ordering/search, multiline form input, validation and errors. Browser tests exercise the actual UI through a test-only mocked Tauri transport; Rust tests independently cover its SQLite implementation.

For a native smoke test: run `pnpm tauri dev`, create undated, yesterday, today and tomorrow tasks; verify the three exclusive views. Complete and reopen a task, edit notes and due date, cancel a deletion and then confirm it. Search notes, change sorting and themes, navigate with Tab, use shortcuts, and resize to 720×540. Restart the app and confirm persistence. The browser transport mock is never imported into production.

## Implementation phases

| Phase | Main files and behavior | Verification | Suggested branch / commit |
| --- | --- | --- | --- |
| 1 Foundation | `package.json`, Vite/TS configuration, `src-tauri/tauri.conf.json`, `db/`, migration, icons | Install dependencies; frontend build; database tests | `feat/foundation` / `chore: initialize Taskly desktop foundation` |
| 2 Backend | `models/`, `error.rs`, `repository/`, `services/`, `commands/`, Rust tests | `cargo test --manifest-path src-tauri/Cargo.toml` | `feat/task-backend` / `feat: add SQLite task service and commands` |
| 3 Interface | `App.tsx`, `Dialog.tsx`, `TaskForm.tsx`, `app.css`, `api.ts` | Form/browser tests and native CRUD smoke test | `feat/task-interface` / `feat: build task workspace and editing flows` |
| 4 Productivity | `tasks.ts`, shortcuts, search/sorts, themes, error/empty states | Frontend/browser tests; keyboard and theme checks | `feat/productivity` / `feat: add search shortcuts and appearance settings` |
| 5 Release | Tests, lockfiles, this README, `.github/workflows/ci.yml` | All checks above; `pnpm tauri build` | `chore/release` / `chore: verify and package Taskly for Windows` |

Suggested branches/commits are documentation; the project does not automatically create Git branches or commits.
