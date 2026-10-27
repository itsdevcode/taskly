export type Status = 'pending' | 'completed';
export type View = 'all' | 'pending' | 'upcoming' | 'completed';
export interface Task { id: string; title: string; description: string; status: Status; dueDate: string | null; createdAt: string; updatedAt: string; completedAt: string | null }
export interface TaskInput { title: string; description: string; dueDate: string | null }
export function localDate(date = new Date()): string { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function classify(task: Task, today = localDate()): Exclude<View,'all'> { return task.status === 'completed' ? 'completed' : task.dueDate && task.dueDate > today ? 'upcoming' : 'pending'; }
export function isOverdue(task: Task, today = localDate()): boolean { return task.status === 'pending' && !!task.dueDate && task.dueDate < today; }
export function dateLabel(date: string, today = localDate()): string {
  if (date === today) return 'Today';
  const tomorrow = new Date(`${today}T12:00:00`); tomorrow.setDate(tomorrow.getDate()+1);
  if (date === localDate(tomorrow)) return 'Tomorrow';
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric',...(date.slice(0,4) !== today.slice(0,4) ? {year:'numeric'} : {})});
}
export function selectTasks(tasks: Task[], view: View, query: string, sort: 'smart' | 'due' | 'created', today: string): Task[] {
  const search = query.trim().toLocaleLowerCase();
  return tasks.filter(task => (view === 'all' || classify(task,today) === view) && `${task.title} ${task.description}`.toLocaleLowerCase().includes(search)).sort((a,b) => {
    if (sort === 'created') return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
    if (sort === 'smart' && view === 'completed') return (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
    if (sort === 'smart' && view === 'all' && a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
  });
}
