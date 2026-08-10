import { openDB, type IDBPDatabase } from 'idb';
import { notifyUpsert, notifyDelete } from '@/lib/sync/cloud';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Todo {
  id?: number; // auto-increment
  /** 云端 UUID（Supabase 同步用） */
  cloudId?: string;
  title: string;
  date: string; // YYYY-MM-DD 格式
  isCompleted: boolean;
  completedAt?: string; // ISO timestamp
  createdAt: string; // ISO timestamp
}

export interface TodoStats {
  total: number;
  completed: number;
  pending: number;
}

// ─── Database ────────────────────────────────────────────────────────────────

const DB_NAME = 'todo-db';
const DB_VERSION = 2;

let dbInstance: IDBPDatabase | null = null;

export async function initDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('todos')) {
        const todosStore = db.createObjectStore('todos', {
          keyPath: 'id',
          autoIncrement: true,
        });
        todosStore.createIndex('by-date', 'date');
        todosStore.createIndex('by-completed', 'isCompleted');
      }
    },
  });

  return dbInstance;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}

function getSunday(monday: Date): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  return d;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function addTodo(
  todo: Omit<Todo, 'id' | 'isCompleted' | 'createdAt'> & Partial<Pick<Todo, 'createdAt'>>
): Promise<number> {
  const db = await initDB();
  const record: Todo = {
    ...todo,
    isCompleted: false,
    createdAt: todo.createdAt || new Date().toISOString(),
  };
  const id = await db.add('todos', record);
  notifyUpsert('todos', id as number);
  return id as number;
}

export async function getTodo(id: number): Promise<Todo | undefined> {
  const db = await initDB();
  return db.get('todos', id);
}

export async function updateTodo(
  id: number,
  updates: Partial<Omit<Todo, 'id'>>
): Promise<void> {
  const db = await initDB();
  const existing = await db.get('todos', id);
  if (!existing) throw new Error(`Todo ${id} not found`);

  const updated: Todo = {
    ...existing,
    ...updates,
    id,
  };
  await db.put('todos', updated);
  notifyUpsert('todos', id);
}

export async function deleteTodo(id: number): Promise<void> {
  const db = await initDB();
  const existing = await db.get('todos', id);
  await db.delete('todos', id);
  notifyDelete('todos', existing?.cloudId);
}

export async function toggleComplete(id: number): Promise<Todo> {
  const db = await initDB();
  const existing = await db.get('todos', id);
  if (!existing) throw new Error(`Todo ${id} not found`);

  const updated: Todo = { ...existing, id };
  if (existing.isCompleted) {
    updated.isCompleted = false;
    updated.completedAt = undefined;
  } else {
    updated.isCompleted = true;
    updated.completedAt = new Date().toISOString();
  }

  await db.put('todos', updated);
  notifyUpsert('todos', id);
  return updated;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getTodosByDate(date: string): Promise<Todo[]> {
  const db = await initDB();
  const items: Todo[] = await db.getAllFromIndex('todos', 'by-date', date);

  const pending = items
    .filter((t) => !t.isCompleted)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const completed = items
    .filter((t) => t.isCompleted)
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));

  return [...pending, ...completed];
}

export async function getTodayTodos(): Promise<Todo[]> {
  return getTodosByDate(getToday());
}

export async function getWeekTodos(): Promise<Todo[]> {
  const db = await initDB();
  const monday = getMonday(new Date());
  const sunday = getSunday(monday);

  const mondayStr = monday.toISOString().slice(0, 10);
  const sundayStr = sunday.toISOString().slice(0, 10);

  const items: Todo[] = await db.getAll('todos');
  const weekItems = items.filter((t) => t.date >= mondayStr && t.date <= sundayStr);

  const pending = weekItems
    .filter((t) => !t.isCompleted)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const completed = weekItems
    .filter((t) => t.isCompleted)
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));

  return [...pending, ...completed];
}

export async function getTodayStats(): Promise<TodoStats> {
  const todos = await getTodayTodos();
  const completed = todos.filter((t) => t.isCompleted).length;
  return {
    total: todos.length,
    completed,
    pending: todos.length - completed,
  };
}

export async function listAllTodos(): Promise<Todo[]> {
  const db = await initDB();
  const items: Todo[] = await db.getAll('todos');
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
