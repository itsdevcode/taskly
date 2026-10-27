import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Circle,
  CircleCheck,
  Command,
  Inbox,
  LayoutGrid,
  ListTodo,
  LoaderCircle,
  Moon,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { api, desktop, errorMessage } from "./lib/api";
import {
  classify,
  dateLabel,
  isOverdue,
  localDate,
  selectTasks,
  type Task,
  type TaskInput,
  type View,
} from "./lib/tasks";
import { Dialog } from "./components/Dialog";
import { TaskForm } from "./features/tasks/TaskForm";

const views = [
  {
    id: "all",
    label: "All Tasks",
    icon: LayoutGrid,
    subtitle: "A little structure. A lot more clarity.",
  },
  {
    id: "pending",
    label: "Pending",
    icon: Inbox,
    subtitle: "Make room for what matters today.",
  },
  {
    id: "upcoming",
    label: "Upcoming",
    icon: CalendarDays,
    subtitle: "Good things start with a little planning.",
  },
  {
    id: "completed",
    label: "Completed",
    icon: CircleCheck,
    subtitle: "Take a moment. Look how far you’ve come.",
  },
] as const;
type Theme = "light" | "dark" | "system";
function initialTheme(): Theme {
  try {
    const value = localStorage.getItem("taskly-theme");
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}
export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"smart" | "due" | "created">("smart");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Task | null | undefined>(undefined);
  const [details, setDetails] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [today, setToday] = useState(localDate());
  const search = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!desktop)
        throw new Error(
          "Open Taskly as a desktop app to access your local database. Run pnpm tauri dev.",
        );
      setTasks(await api.list());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const refresh = () => setToday(localDate());
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme);
    apply();
    media.addEventListener("change", apply);
    try {
      localStorage.setItem("taskly-theme", theme);
    } catch {
      /* Theme remains available for this session. */
    }
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  const modalOpen = form !== undefined || !!details || !!deleting || settings;
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        if (event.key.toLowerCase() === "n" && !modalOpen && desktop) {
          event.preventDefault();
          setForm(null);
        }
        if (event.key.toLowerCase() === "f" && !modalOpen) {
          event.preventDefault();
          search.current?.focus();
        }
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [modalOpen]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  const counts = useMemo(
    () => ({
      all: tasks.length,
      pending: tasks.filter((t) => classify(t, today) === "pending").length,
      upcoming: tasks.filter((t) => classify(t, today) === "upcoming").length,
      completed: tasks.filter((t) => t.status === "completed").length,
    }),
    [tasks, today],
  );
  const visible = useMemo(
    () => selectTasks(tasks, view, query, sort, today),
    [tasks, view, query, sort, today],
  );
  const active = views.find((v) => v.id === view)!;
  function replace(task: Task) {
    setTasks((previous) =>
      previous.some((t) => t.id === task.id)
        ? previous.map((t) => (t.id === task.id ? task : t))
        : [task, ...previous],
    );
  }
  async function save(input: TaskInput) {
    const task = form
      ? await api.update(form.id, input)
      : await api.create(input);
    replace(task);
    setNotice(form ? "Changes saved" : "Task created. You’ve got this.");
  }
  async function toggle(task: Task) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      replace(
        await api.status(
          task.id,
          task.status === "completed" ? "pending" : "completed",
        ),
      );
      setNotice(
        task.status === "pending"
          ? "One less thing on your mind."
          : "Task moved back to pending.",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  useEffect(() => setDeleteError(""), [deleting?.id]);
  async function remove() {
    if (!deleting || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setDeleteError("");
    try {
      await api.remove(deleting.id);
      setTasks((previous) => previous.filter((t) => t.id !== deleting.id));
      setDeleting(null);
      setNotice("Task deleted");
    } catch (err) {
      setDeleteError(errorMessage(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const progress = tasks.length
    ? Math.round((counts.completed / tasks.length) * 100)
    : 0;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("all");
          }}
          aria-label="Taskly home"
        >
          <span className="brand-mark">
            <CheckCheck size={24} strokeWidth={2.6} />
          </span>
          taskly<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Task views">
          {views.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => {
                setView(item.id);
                setSort("smart");
              }}
              aria-current={view === item.id ? "page" : undefined}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              <span className="nav-count">{counts[item.id]}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-icon">
            <Sparkles size={17} />
          </span>
          <h3>Small steps, big things.</h3>
          <p>
            A clear mind starts with
            <br />a little less to remember.
          </p>
          <div className="note-line" />
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setSettings(true)}>
            <Settings size={19} />
            <span>Settings</span>
          </button>
          <div className="offline">
            <span />
            All yours. Always local.
            <ShieldCheck size={14} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            My workspace <ChevronRight size={14} />
            <span>{active.label}</span>
          </span>
          <span className="top-date">
            {new Date(`${today}T12:00:00`).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
        </header>
        <main>
          <div className="heading-row">
            <div>
              <div className="eyebrow">A LITTLE FOCUS GOES A LONG WAY</div>
              <h1>
                {active.label}
                <span className="heading-count">{counts[view]}</span>
              </h1>
              <p className="subtitle">{active.subtitle}</p>
            </div>
            <button
              className="primary add-task"
              onClick={() => setForm(null)}
              disabled={!desktop || loading}
            >
              <Plus size={18} />
              Add task<span className="shortcut">Ctrl N</span>
            </button>
          </div>
          <section className="overview" aria-label="Task overview">
            <div>
              <span className="stat-icon lavender">
                <ListTodo size={19} />
              </span>
              <div>
                <span className="stat-label">On your list</span>
                <strong>
                  {counts.pending + counts.upcoming}
                  <small>tasks to go</small>
                </strong>
              </div>
            </div>
            <div>
              <span className="stat-icon amber">
                <CalendarDays size={19} />
              </span>
              <div>
                <span className="stat-label">Coming up</span>
                <strong>
                  {counts.upcoming}
                  <small>on the horizon</small>
                </strong>
              </div>
            </div>
            <div>
              <span className="stat-icon mint">
                <CircleCheck size={19} />
              </span>
              <div>
                <span className="stat-label">Made it happen</span>
                <strong>
                  {counts.completed}
                  <small>tasks completed</small>
                </strong>
              </div>
            </div>
          </section>
          <div className="list-toolbar">
            <div className="search-field">
              <Search size={17} />
              <input
                ref={search}
                aria-label="Search tasks"
                placeholder="Search your tasks…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query ? (
                <button
                  className="icon-button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                >
                  <X size={14} />
                </button>
              ) : (
                <kbd>Ctrl F</kbd>
              )}
            </div>
            <label className="sort-field">
              <ArrowDownWideNarrow size={16} />
              <select
                aria-label="Sort tasks"
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
              >
                <option value="smart">Smart order</option>
                <option value="due">Due date</option>
                <option value="created">Newest first</option>
              </select>
            </label>
          </div>
          {error && (
            <div role="alert" className="error-banner">
              <span>{error}</span>
              {desktop && (
                <button onClick={() => void load()} disabled={loading || busy}>
                  Retry
                </button>
              )}
            </div>
          )}
          <div className="list-caption">
            <span>
              {query
                ? "SEARCH RESULTS"
                : view === "all"
                  ? "YOUR TASKS"
                  : `${active.label.toUpperCase()} TASKS`}
            </span>
            <span>
              {visible.length} {visible.length === 1 ? "task" : "tasks"}
            </span>
          </div>
          {loading ? (
            <div className="empty">
              <LoaderCircle className="spinner" size={28} />
              <h2>Opening your workspace…</h2>
            </div>
          ) : visible.length ? (
            <div className="task-list">
              {visible.map((task) => (
                <article
                  className={`task-row ${task.status === "completed" ? "done" : ""}`}
                  key={task.id}
                >
                  <button
                    className="task-check"
                    aria-label={`${task.status === "completed" ? "Reopen" : "Complete"} ${task.title}`}
                    aria-pressed={task.status === "completed"}
                    disabled={busy}
                    onClick={() => void toggle(task)}
                  >
                    {task.status === "completed" ? (
                      <Check size={14} strokeWidth={3} />
                    ) : null}
                  </button>
                  <button
                    className="task-content"
                    onClick={() => setDetails(task)}
                  >
                    <span className="task-title">{task.title}</span>
                    {task.description && (
                      <span className="task-description">
                        {task.description}
                      </span>
                    )}
                  </button>
                  <div className="task-meta">
                    {task.dueDate && (
                      <span
                        className={`due ${isOverdue(task, today) ? "overdue" : ""}`}
                      >
                        <CalendarDays size={13} />
                        {isOverdue(task, today) ? "Overdue · " : ""}
                        {dateLabel(task.dueDate, today)}
                      </span>
                    )}
                    <span className={`status ${classify(task, today)}`}>
                      <span />
                      {classify(task, today) === "completed"
                        ? "Completed"
                        : classify(task, today) === "upcoming"
                          ? "Upcoming"
                          : "Pending"}
                    </span>
                  </div>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      aria-label={`Edit ${task.title}`}
                      onClick={() => setForm(task)}
                      disabled={busy}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button delete"
                      aria-label={`Delete ${task.title}`}
                      onClick={() => setDeleting(task)}
                      disabled={busy}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              <div className="empty-art">
                <div className="art-paper">
                  <span />
                  <span />
                  <span />
                  <div>
                    <Check size={23} />
                  </div>
                </div>
                <Sparkles size={20} className="art-spark" />
              </div>
              <h2>
                {query
                  ? "No matching tasks"
                  : view === "completed"
                    ? "Your wins will live here"
                    : view === "upcoming"
                      ? "A little room on the horizon"
                      : view === "pending"
                        ? "You’re all clear for now"
                        : "A fresh start. A clearer mind."}
              </h2>
              <p>
                {query
                  ? "Try another word or clear your search."
                  : view === "completed"
                    ? "Complete a task and take a moment to enjoy your progress."
                    : view === "upcoming"
                      ? "Tasks with a future due date will appear here."
                      : "Get the little things out of your head and onto your list."}
              </p>
              {query ? (
                <button className="secondary" onClick={() => setQuery("")}>
                  Clear search
                </button>
              ) : (
                <button
                  className="empty-add"
                  disabled={!desktop}
                  onClick={() => setForm(null)}
                >
                  <Plus size={16} />
                  Create a task
                  <ArrowUpRight size={15} />
                </button>
              )}
            </div>
          )}
          <button
            className="quick-add"
            onClick={() => setForm(null)}
            disabled={!desktop || loading}
          >
            <Plus size={17} />
            Add a new task<span>Ctrl + N</span>
          </button>
          <footer className="main-footer">
            <span>
              <ShieldCheck size={14} />
              Saved on this device. Just for you.
            </span>
            <span>
              {progress}% complete{" "}
              <span className="progress-track">
                <span style={{ width: `${progress}%` }} />
              </span>
            </span>
          </footer>
        </main>
        <div className="bottom-quote">
          <span>Less noise. More done.</span>
          <Circle size={4} fill="currentColor" />
          <span>Made for your everyday.</span>
        </div>
      </div>
      <div className="toast-region" role="status" aria-live="polite">
        {notice && (
          <div className="toast">
            <CircleCheck size={17} />
            {notice}
          </div>
        )}
      </div>
      {form !== undefined && (
        <TaskForm
          task={form}
          onClose={() => setForm(undefined)}
          onSave={save}
        />
      )}
      {details && (
        <Dialog title="Task details" onClose={() => setDetails(null)} wide>
          <div className="form-body details">
            <span className={`status ${classify(details, today)}`}>
              {classify(details, today)}
            </span>
            <h2>{details.title}</h2>
            <p className="detail-description">
              {details.description || "No description added."}
            </p>
            <dl>
              <dt>Due date</dt>
              <dd>
                {details.dueDate
                  ? new Date(`${details.dueDate}T12:00:00`).toLocaleDateString(
                      undefined,
                      { dateStyle: "long" },
                    )
                  : "No due date"}
              </dd>
              <dt>Created</dt>
              <dd>{new Date(details.createdAt).toLocaleString()}</dd>
              <dt>Updated</dt>
              <dd>{new Date(details.updatedAt).toLocaleString()}</dd>
              {details.completedAt && (
                <>
                  <dt>Completed</dt>
                  <dd>{new Date(details.completedAt).toLocaleString()}</dd>
                </>
              )}
            </dl>
          </div>
          <footer className="dialog-footer">
            <button
              className="secondary"
              onClick={() => {
                setDeleting(details);
                setDetails(null);
              }}
            >
              <Trash2 size={15} />
              Delete
            </button>
            <button
              className="primary"
              onClick={() => {
                setForm(details);
                setDetails(null);
              }}
            >
              <Pencil size={15} />
              Edit task
            </button>
          </footer>
        </Dialog>
      )}
      {deleting && (
        <Dialog
          title="Delete this task?"
          onClose={() => setDeleting(null)}
          busy={busy}
        >
          <div className="form-body">
            <p className="delete-copy">
              “{deleting.title}” will be permanently deleted from this device.
              This can’t be undone.
            </p>
            {deleteError && (
              <p role="alert" className="error">
                {deleteError}
              </p>
            )}
          </div>
          <footer className="dialog-footer">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Keep task
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? "Deleting…" : "Delete task"}
            </button>
          </footer>
        </Dialog>
      )}
      {settings && (
        <Dialog
          title="Make yourself at home"
          onClose={() => setSettings(false)}
        >
          <div className="form-body">
            <h3 className="setting-label">Appearance</h3>
            <p className="setting-description">
              A workspace that feels right, day or night.
            </p>
            <div className="theme-options">
              {(
                [
                  { id: "light", icon: Sun },
                  { id: "dark", icon: Moon },
                  { id: "system", icon: Command },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  aria-pressed={theme === item.id}
                  className={theme === item.id ? "selected" : ""}
                  onClick={() => setTheme(item.id)}
                >
                  <item.icon size={22} />
                  {item.id}
                </button>
              ))}
            </div>
            <h3 className="setting-label">A few handy shortcuts</h3>
            <div className="shortcut-list">
              <span>
                New task<kbd>Ctrl / ⌘ N</kbd>
              </span>
              <span>
                Find a task<kbd>Ctrl / ⌘ F</kbd>
              </span>
              <span>
                Close dialog<kbd>Esc</kbd>
              </span>
            </div>
            <div className="privacy-note">
              <ShieldCheck size={20} />
              <p>
                Your tasks stay on this device in a local SQLite database. No
                accounts, no cloud, no tracking.
              </p>
            </div>
            <p className="version">Taskly · Version 1.0.0</p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
