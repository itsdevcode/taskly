import { invoke, isTauri } from '@tauri-apps/api/core';
import type { Task, TaskInput, Status } from './tasks';
export const desktop = isTauri();
export const api = {
  list: () => invoke<Task[]>('list_tasks'),
  create: (input: TaskInput) => invoke<Task>('create_task', { input }),
  update: (id: string, input: TaskInput) => invoke<Task>('update_task', { id, input }),
  remove: (id: string) => invoke<void>('delete_task', { id }),
  status: (id: string, status: Status) => invoke<Task>('set_task_status', { id, status }),
};
export function errorMessage(error: unknown): string { return typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : typeof error === 'string' ? error : 'Something went wrong. Please try again.'; }
