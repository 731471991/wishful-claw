/**
 * Managed Models — global model configuration library.
 *
 * Models defined here serve as defaults that provider copies inherit from.
 * When a provider is created from a preset, its models are built by merging
 * the preset's base config with the managed model's overrides.
 *
 * Migrated from OpenCowork's provider-store.ts managed model logic.
 */

import type { AIModelConfig } from '../../../shared/types/provider'
import { builtinProviderPresets } from '@renderer/stores/providers'

export interface ManagedModelConfig extends AIModelConfig {
  normalizedKey: string
}

export function normalizeModelKey(modelId: string): string {
  return modelId.trim().toLowerCase()
}

// ── Clone helpers ──

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T
  }
  if (isPlainObject(value)) {
    const cloned: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      cloned[key] = cloneValue(item)
    }
    return cloned as T
  }
  return value
}

function cloneModelConfig(model: AIModelConfig): AIModelConfig {
  return cloneValue(model)
}

export function cloneManagedModelConfig(model: ManagedModelConfig): ManagedModelConfig {
  return cloneValue(model)
}

// ── Conversion helpers ──

export function toManagedModelConfig(model: AIModelConfig): ManagedModelConfig {
  const cloned = cloneModelConfig(model)
  const id = cloned.id.trim()
  return {
    ...cloned,
    id,
    name: cloned.name.trim() || id,
    normalizedKey: normalizeModelKey(id)
  }
}

export function toManagedModelBase(model: ManagedModelConfig): AIModelConfig {
  const { normalizedKey, ...cloned } = cloneManagedModelConfig(model)
  void normalizedKey
  return cloned
}

// ── Collection helpers ──

export function getManagedModelFromCollection(
  managedModels: ManagedModelConfig[],
  modelId: string
): ManagedModelConfig | undefined {
  const modelKey = normalizeModelKey(modelId)
  return managedModels.find((model) => model.normalizedKey === modelKey)
}

export function sortManagedModels(models: ManagedModelConfig[]): ManagedModelConfig[] {
  return [...models].sort((a, b) => {
    const nameCompare = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    if (nameCompare !== 0) return nameCompare
    return a.id.localeCompare(b.id, undefined, { sensitivity: 'base' })
  })
}

// ── Merge missing fields ──

function isMissingModelValue(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (isPlainObject(value)) return Object.keys(value).length === 0
  return false
}

function mergeMissingValue(target: unknown, source: unknown): { value: unknown; changed: boolean } {
  if (source === undefined) {
    return { value: cloneValue(target), changed: false }
  }
  if (isMissingModelValue(target)) {
    if (isMissingModelValue(source)) {
      return { value: cloneValue(target), changed: false }
    }
    return { value: cloneValue(source), changed: true }
  }
  if (Array.isArray(target) || Array.isArray(source)) {
    return { value: cloneValue(target), changed: false }
  }
  if (isPlainObject(target) && isPlainObject(source)) {
    const merged = cloneValue(target)
    let changed = false
    for (const [key, sourceValue] of Object.entries(source)) {
      const result = mergeMissingValue(merged[key], sourceValue)
      if (result.changed) {
        merged[key] = result.value
        changed = true
      }
    }
    return { value: merged, changed }
  }
  return { value: cloneValue(target), changed: false }
}

export function mergeManagedModelMissingFields(
  target: ManagedModelConfig,
  source: ManagedModelConfig
): { model: ManagedModelConfig; changed: boolean } {
  const merged = cloneManagedModelConfig(target)
  const mergedRecord = merged as unknown as Record<string, unknown>
  let changed = false

  for (const [key, value] of Object.entries(source)) {
    if (key === 'normalizedKey') continue
    const result = mergeMissingValue(mergedRecord[key], value)
    if (result.changed) {
      mergedRecord[key] = result.value
      changed = true
    }
  }

  return { model: merged, changed }
}

// ── Collect builtin managed models from presets ──

export function collectBuiltinManagedModels(): ManagedModelConfig[] {
  const managedByKey = new Map<string, ManagedModelConfig>()

  for (const preset of builtinProviderPresets) {
    for (const model of preset.defaultModels) {
      const candidate = toManagedModelConfig(model)
      const existing = managedByKey.get(candidate.normalizedKey)
      if (!existing) {
        managedByKey.set(candidate.normalizedKey, candidate)
        continue
      }
      // Provider order defines canonical values. Later presets only enrich missing fields.
      managedByKey.set(
        candidate.normalizedKey,
        mergeManagedModelMissingFields(existing, candidate).model
      )
    }
  }

  return Array.from(managedByKey.values())
}

// ── Build provider model snapshot (merge managed + preset + existing) ──

export function buildProviderModelSnapshot(
  model: AIModelConfig,
  options: {
    managedModel?: ManagedModelConfig | null
    existingModel?: AIModelConfig | null
  } = {}
): AIModelConfig {
  const baseModel = cloneModelConfig(model)
  const managedModel = options.managedModel ? toManagedModelBase(options.managedModel) : null
  const existingModel = options.existingModel ? cloneModelConfig(options.existingModel) : null

  if (existingModel) {
    return {
      ...baseModel,
      ...(managedModel ?? {}),
      ...existingModel,
      enabled: existingModel.enabled
    }
  }

  if (managedModel) {
    return {
      ...baseModel,
      ...managedModel
    }
  }

  return baseModel
}
