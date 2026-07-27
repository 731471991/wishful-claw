import { create } from 'zustand'
import { emitAgentRuntimeSync, isAgentRuntimeSyncSuppressed } from '../lib/agent-runtime-sync'
import { invokeMessagePackBinary } from '../lib/ipc/messagepack-ipc-client'
import {
  DB_TASKS_CREATE_MSGPACK_CHANNEL,
  DB_TASKS_DELETE_BY_SESSION_MSGPACK_CHANNEL,
  DB_TASKS_DELETE_MSGPACK_CHANNEL,
  DB_TASKS_LIST_BY_SESSION_MSGPACK_CHANNEL,
  DB_TASKS_UPDATE_MSGPACK_CHANNEL
} from '../../../shared/messagepack/binary-ipc'
import { useChatStore } from './chat-store'

export interface TaskItem {
  id: string
  sessionId?: string
  planId?: string
  subject: string
  description: string
  activeForm?: string
  status: 'pending' | 'in_progress' | 'completed' | string
  owner?: string | null
  blocks: string[]
  blockedBy: string[]
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

/** @deprecated Use TaskItem instead */
export type TodoItem = TaskItem

// --- DB persistence helpers (fire-and-forget) ---

export function dbCreateTask(task: TaskItem, sortOrder: number): void {
  if (!task.sessionId) return
  invokeMessagePackBinary(DB_TASKS_CREATE_MSGPACK_CHANNEL, {
    id: task.id,
    sessionId: task.sessionId,
    planId: task.planId,
    subject: task.subject,
    description: task.description,
    activeForm: task.activeForm,
    status: task.status,
    owner: task.owner,
    blocks: task.blocks,
    blockedBy: task.blockedBy,
    metadata: task.metadata,
    sortOrder,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  }).catch(() => {})
}

export function dbUpdateTask(id: string, patch: Record<string, unknown>): void {
  invokeMessagePackBinary(DB_TASKS_UPDATE_MSGPACK_CHANNEL, { id, patch }).catch(() => {})
}

export function dbDeleteTask(id: string): void {
  invokeMessagePackBinary(DB_TASKS_DELETE_MSGPACK_CHANNEL, id).catch(() => {})
}

export function dbDeleteTasksBySession(sessionId: string): void {
  invokeMessagePackBinary(DB_TASKS_DELETE_BY_SESSION_MSGPACK_CHANNEL, sessionId).catch(() => {})
}

interface TaskRow {
  id: string
  session_id: string
  plan_id: string | null
  subject: string
  description: string
  active_form: string | null
  status: string
  owner: string | null
  blocks: string
  blocked_by: string
  metadata: string | null
  sort_order: number
  created_at: number
  updated_at: number
}

export function rowToTask(row: TaskRow): TaskItem {
  return {
    id: row.id,
    sessionId: row.session_id,
    planId: row.plan_id ?? undefined,
    subject: row.subject,
    description: row.description,
    activeForm: row.active_form ?? undefined,
    status: row.status as TaskItem['status'],
    owner: row.owner,
    blocks: JSON.parse(row.blocks || '[]'),
    blockedBy: JSON.parse(row.blocked_by || '[]'),
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function buildDbPatch(
  patch: Partial<Omit<TaskItem, 'id' | 'createdAt'>>,
  now: number
): Record<string, unknown> {
  const dbPatch: Record<string, unknown> = { updatedAt: now }
  if (patch.subject !== undefined) dbPatch.subject = patch.subject
  if (patch.description !== undefined) dbPatch.description = patch.description
  if (patch.activeForm !== undefined) dbPatch.activeForm = patch.activeForm
  if (patch.status !== undefined) dbPatch.status = patch.status
  if (patch.owner !== undefined) dbPatch.owner = patch.owner
  if (patch.blocks !== undefined) dbPatch.blocks = patch.blocks
  if (patch.blockedBy !== undefined) dbPatch.blockedBy = patch.blockedBy
  if (patch.metadata !== undefined) dbPatch.metadata = patch.metadata
  return dbPatch
}

interface TaskStore {
  tasks: TaskItem[]
  /** Session-scoped cache for background/concurrent session updates */
  tasksBySession: Record<string, TaskItem[]>
  /** The session ID tasks are currently loaded for */
  currentSessionId: string | null

  /** Load tasks for a session from DB */
  loadTasksForSession: (sessionId: string) => Promise<void>
  /** Add a single task (returns the added task) */
  addTask: (task: TaskItem) => TaskItem
  /** Get a task by ID */
  getTask: (id: string) => TaskItem | undefined
  /** Update a task by ID (partial patch). Returns updated task or undefined if not found. */
  updateTask: (
    id: string,
    patch: Partial<Omit<TaskItem, 'id' | 'createdAt'>>
  ) => TaskItem | undefined
  /** Delete a task by ID */
  deleteTask: (id: string) => boolean
  /** Get all tasks */
  getTasks: () => TaskItem[]
  /** Get tasks for a specific session */
  getTasksBySession: (sessionId: string) => TaskItem[]
  /** Get the currently in_progress task */
  getActiveTask: () => TaskItem | undefined
  /** Get progress stats */
  getProgress: () => { total: number; completed: number; percentage: number }
  /** Clear all tasks in memory (does not touch DB) */
  clearTasks: () => void
  releaseDormantSessionTasks: (residentSessionIds: string[]) => void
  /** Delete all tasks for a session from DB and memory */
  deleteSessionTasks: (sessionId: string) => void
  applySyncedTaskAdd: (task: TaskItem) => void
  applySyncedTaskUpdate: (id: string, patch: Partial<Omit<TaskItem, 'id' | 'createdAt'>>) => void
  applySyncedTaskDelete: (id: string) => void
  applySyncedDeleteSessionTasks: (sessionId: string) => void

  // --- Backward-compatible aliases ---
  /** @deprecated Use tasks */
  todos: TaskItem[]
  /** @deprecated Use addTask / getTasks */
  setTodos: (todos: TaskItem[]) => void
  /** @deprecated Use getTasks */
  getTodos: () => TaskItem[]
  /** @deprecated Use getActiveTask */
  getActiveTodo: () => TaskItem | undefined
}

