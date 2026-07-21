import { create } from 'zustand'

export interface TaskItem {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
}

interface TaskStore {
  tasksBySession: Record<string, TaskItem[]>
}

export const useTaskStore = create<TaskStore>(() => ({
  tasksBySession: {}
}))
