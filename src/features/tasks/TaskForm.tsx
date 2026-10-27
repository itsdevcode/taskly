import { useRef, useState, type FormEvent } from "react";
import { CalendarDays, ArrowRight } from "lucide-react";
import { Dialog } from "../../components/Dialog";
import type { Task, TaskInput } from "../../lib/tasks";
import { errorMessage } from "../../lib/api";
export function TaskForm({
  task,
  onClose,
  onSave,
}: {
  task: Task | null;
  onClose: () => void;
  onSave: (input: TaskInput) => Promise<void>;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    if (!title.trim() || Array.from(title.trim()).length > 150) {
      setError("Enter a title between 1 and 150 characters.");
      return;
    }
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await onSave({
        title: title.trim(),
        description,
        dueDate: dueDate || null,
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={task ? "Edit task" : "A little less on your mind"}
      onClose={onClose}
      busy={busy}
      wide
    >
      <form onSubmit={submit}>
        <div className="form-body">
          <label htmlFor="task-title">
            Task title <span className="required">*</span>
          </label>
          <input
            autoFocus
            id="task-title"
            placeholder="What would you like to get done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            aria-describedby={error ? "form-error" : undefined}
          />
          <div className="input-hint">
            Keep it simple. Make it actionable.
            <span>{Array.from(title).length}/150</span>
          </div>
          <label htmlFor="task-description">
            Description <span className="optional">Optional</span>
          </label>
          <textarea
            id="task-description"
            placeholder="Add a few details, notes, or a first step…"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label htmlFor="task-date">
            <CalendarDays size={15} /> Due date{" "}
            <span className="optional">Optional</span>
          </label>
          <input
            type="date"
            id="task-date"
            min="0001-01-01"
            max="9999-12-31"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          {error && (
            <p role="alert" className="error" id="form-error">
              {error}
            </p>
          )}
        </div>
        <footer className="dialog-footer">
          <span className="keyboard-hint">Enter to save · Esc to close</span>
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : task ? "Save changes" : "Create task"}
            <ArrowRight size={16} />
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
