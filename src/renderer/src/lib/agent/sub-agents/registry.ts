import type { SubAgentDefinition } from './types'

/**
 * SubAgent Registry — manages available SubAgent definitions.
 * Similar pattern to ToolRegistry but for SubAgents.
 */
class SubAgentRegistry {
  private agents = new Map<string, SubAgentDefinition>()
  private listeners = new Set<() => void>()
  private allCache: SubAgentDefinition[] | null = []
  private namesCache: string[] | null = []

  private invalidate(): void {
    this.allCache = null
    this.namesCache = null
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  register(def: SubAgentDefinition): void {
    const prev = this.agents.get(def.name)
    this.agents.set(def.name, def)
    if (prev !== def) {
      this.invalidate()
      this.emit()
    }
  }

  unregister(name: string): void {
    if (this.agents.delete(name)) {
      this.invalidate()
      this.emit()
    }
  }

  get(name: string): SubAgentDefinition | undefined {
    return this.agents.get(name)
  }

  has(name: string): boolean {
    return this.agents.has(name)
  }

  getAll(): SubAgentDefinition[] {
    if (!this.allCache) {
      this.allCache = Array.from(this.agents.values())
    }
    return this.allCache
  }

  getNames(): string[] {
    if (!this.namesCache) {
      this.namesCache = Array.from(this.agents.keys())
    }
    return this.namesCache
  }
}

export const subAgentRegistry = new SubAgentRegistry()
