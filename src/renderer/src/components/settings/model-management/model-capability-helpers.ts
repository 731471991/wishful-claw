import {
  Code2,
  Eye,
  Image as ImageIcon,
  Mic,
  MonitorSmartphone,
  Shapes,
  Sparkles,
  Video
} from 'lucide-react'
import type { AIModelConfig } from '../../../../../shared/types/provider'
import { modelSupportsVision } from '@renderer/stores/provider-store'
import type { ManagedModelConfig } from '@renderer/stores/managed-models'

export function modelSupportsComputerUse(model: AIModelConfig, providerType?: string): boolean {
  return Boolean(model.supportsComputerUse || model.enableComputerUse) || providerType === 'openai-responses'
}

export function getCapabilityIndicators(
  model: ManagedModelConfig,
  providerType?: string
): Array<{ key: string; icon: React.ComponentType<{ className?: string }>; label: string }> {
  const indicators: Array<{ key: string; icon: React.ComponentType<{ className?: string }>; label: string }> = []
  if (model.category === 'image') {
    indicators.push({ key: 'cat-image', icon: ImageIcon, label: '' })
  } else if (model.category === 'speech') {
    indicators.push({ key: 'cat-speech', icon: Mic, label: '' })
  } else if (model.category === 'embedding') {
    indicators.push({ key: 'cat-embedding', icon: Shapes, label: '' })
  } else if (model.category === 'video') {
    indicators.push({ key: 'cat-video', icon: Video, label: '' })
  }
  if (modelSupportsVision(model, model.type ?? providerType as any)) {
    indicators.push({ key: 'vision', icon: Eye, label: '' })
  }
  if (model.supportsFunctionCall !== false) {
    indicators.push({ key: 'function', icon: Code2, label: '' })
  }
  if (modelSupportsComputerUse(model, model.type ?? providerType)) {
    indicators.push({ key: 'computer-use', icon: MonitorSmartphone, label: '' })
  }
  if (model.supportsThinking) {
    indicators.push({ key: 'thinking', icon: Sparkles, label: '' })
  }
  return indicators
}
