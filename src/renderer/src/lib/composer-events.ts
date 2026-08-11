/**
 * Global event bus for injecting text into the active chat composer.
 * External surfaces (e.g. PreviewPanel) emit a request here; the InputArea
 * subscribes and fills the composer with the given text, then focuses it.
 */
export interface ComposerInjectEvent {
  text: string
}

type ComposerEventListener = (event: ComposerInjectEvent) => void

class ComposerEventBus {
  private listeners = new Set<ComposerEventListener>()

  on(listener: ComposerEventListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(event: ComposerInjectEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}

export const composerEvents = new ComposerEventBus()