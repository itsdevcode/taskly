import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskForm } from "./TaskForm";
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(cleanup);
it("creates a task without a due date and preserves multiline notes", async () => {
  const user = userEvent.setup();
  const save = vi.fn().mockResolvedValue(undefined),
    close = vi.fn();
  render(<TaskForm task={null} onSave={save} onClose={close} />);
  await user.type(screen.getByLabelText(/Task title/), "  Plan tomorrow  ");
  await user.type(
    screen.getByLabelText(/Description/),
    "First step{Enter}Second step",
  );
  expect(save).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Create task" }));
  expect(save).toHaveBeenCalledWith({
    title: "Plan tomorrow",
    description: "First step\nSecond step",
    dueDate: null,
  });
  expect(close).toHaveBeenCalled();
});
it("shows backend errors without closing or losing entered text", async () => {
  const user = userEvent.setup();
  const save = vi.fn().mockRejectedValue({ message: "Database unavailable" }),
    close = vi.fn();
  render(<TaskForm task={null} onSave={save} onClose={close} />);
  await user.type(screen.getByLabelText(/Task title/), "Keep my work");
  await user.click(screen.getByRole("button", { name: "Create task" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Database unavailable",
  );
  expect(close).not.toHaveBeenCalled();
  expect((screen.getByLabelText(/Task title/) as HTMLInputElement).value).toBe(
    "Keep my work",
  );
});
it("rejects long titles before calling the backend", async () => {
  const user = userEvent.setup();
  const save = vi.fn();
  render(<TaskForm task={null} onSave={save} onClose={() => {}} />);
  await user.type(screen.getByLabelText(/Task title/), "x".repeat(151));
  await user.click(screen.getByRole("button", { name: "Create task" }));
  expect(screen.getByRole("alert").textContent).toContain("150");
  expect(save).not.toHaveBeenCalled();
});
