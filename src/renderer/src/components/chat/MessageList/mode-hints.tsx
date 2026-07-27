import { MessageSquare, CircleHelp, Briefcase, Code2, ShieldCheck } from 'lucide-react'
import type { JSX } from 'react'

export interface ModeHint {
  icon: JSX.Element
  titleKey: string
  descKey: string
}

export const modeHints: Record<string, ModeHint> = {
  chat: {
    icon: <MessageSquare className="size-12 text-muted-foreground/20" />,
    titleKey: 'messageList.startConversation',
    descKey: 'messageList.startConversationDesc'
  },
  clarify: {
    icon: <CircleHelp className="size-12 text-muted-foreground/20" />,
    titleKey: 'messageList.startClarify',
    descKey: 'messageList.startClarifyDesc'
  },
  cowork: {
    icon: <Briefcase className="size-12 text-muted-foreground/20" />,
    titleKey: 'messageList.startCowork',
    descKey: 'messageList.startCoworkDesc'
  },
  code: {
    icon: <Code2 className="size-12 text-muted-foreground/20" />,
    titleKey: 'messageList.startCoding',
    descKey: 'messageList.startCodingDesc'
  },
  acp: {
    icon: <ShieldCheck className="size-12 text-muted-foreground/20" />,
    titleKey: 'messageList.startAcp',
    descKey: 'messageList.startAcpDesc'
  }
}
