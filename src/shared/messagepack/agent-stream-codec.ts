/**
 * Agent stream MessagePack codec.
 * The native-worker already decodes the MessagePack frame using @msgpack/msgpack,
 * so the renderer receives a plain JS object. This module provides type-safe
 * helpers for working with the decoded envelope.
 */
import type { AgentStreamEnvelope, AgentStreamEvent } from '../agent-stream-protocol'

/**
 * Validates that a decoded object is a valid AgentStreamEnvelope.
 */
export function isAgentStreamEnvelope(value: unknown): value is AgentStreamEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).runId === 'string' &&
    typeof (value as Record<string, unknown>).seq === 'number' &&
    Array.isArray((value as Record<string, unknown>).events)
  )
}

/**
 * Safely casts a decoded object to AgentStreamEnvelope.
 * Returns null if the object doesn't match the expected shape.
 */
export function asAgentStreamEnvelope(value: unknown): AgentStreamEnvelope | null {
  return isAgentStreamEnvelope(value) ? value : null
}

/**
 * Extracts events of a specific type from an envelope.
 */
export function filterEventsByType<T extends AgentStreamEvent['type']>(
  envelope: AgentStreamEnvelope,
  type: T
): Extract<AgentStreamEvent, { type: T }>[] {
  return envelope.events.filter((e) => e.type === type) as Extract<AgentStreamEvent, { type: T }>[]
}
