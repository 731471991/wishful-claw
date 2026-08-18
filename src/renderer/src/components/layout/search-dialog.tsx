import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

import { useTranslation } from 'react-i18next'

import {

  MessageSquare,

  Search,

  Plus,

  Settings,

  Keyboard,

  PanelLeft,

  PanelRight,

  User,

  Server,

  Image,

  CalendarDays,

  SquareKanban,

  Moon,

  Sun

} from 'lucide-react'

import {

  CommandDialog,

  CommandInput,

  CommandList,

  CommandEmpty,

  CommandGroup,

  CommandItem,

  CommandSeparator

} from '@renderer/components/ui/command'

import { useUIStore } from '@renderer/stores/ui-store'

import { useChatStore } from '@renderer/stores/chat-store'

import { formatRelativeTime } from './workspace-sidebar-items'



export interface MessageSearchHit {

  messageId: string

  sessionId: string

  sessionTitle: string

  snippet: string

  createdAt: number

}



const SEARCH_DEBOUNCE_MS = 200

const SEARCH_LIMIT = 50



interface SearchDialogProps {

  open: boolean

  onOpenChange: (open: boolean) => void

}



export function SearchDialog({ open, onOpenChange }: SearchDialogProps): React.JSX.Element {

  const { t } = useTranslation('layout')

  const { t: tSettings } = useTranslation('settings')

  const [query, setQuery] = useState('')

  const [hits, setHits] = useState<MessageSearchHit[]>([])

  const [searching, setSearching] = useState(false)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)



  const navigateToSession = useUIStore((s) => s.navigateToSession)

  const loadRecentSessionMessages = useChatStore((s) => s.loadRecentSessionMessages)

  const toggleLeftSidebar = useUIStore((s) => s.toggleLeftSidebar)

  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel)

  const openSettings = useUIStore((s) => s.openSettings)

  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen)

  const openDrawPage = useUIStore((s) => s.openDrawPage)

  const openTasksPage = useUIStore((s) => s.openTasksPage)

  const openTaskBoardPage = useUIStore((s) => s.openTaskBoardPage)

  const navigateToHome = useUIStore((s) => s.navigateToHome)

  const setActiveProjectHome = useChatStore((s) => s.setActiveProjectHome)

  const setMode = useUIStore((s) => s.setMode)



  const sessions = useChatStore((s) => s.sessions)

  const activeSessionId = useChatStore((s) => s.activeSessionId)



  const isDark = useMemo(() => {

    // simple check — same approach as TitleBar

    return document.documentElement.classList.contains('dark')

  }, [open])



  const doSearch = useCallback(async (q: string) => {

    const trimmed = q.trim().toLowerCase()

    if (!trimmed) {

      setHits([])

      setSearching(false)

      return

    }



    setSearching(true)

    try {

      const res = await window.api.workerRequest<{

        success: boolean

        results: Array<{

          messageId: string

          sessionId: string

          sessionTitle: string

          snippet: string

          createdAt: number

        }>

        error: string | null

      }>('db/messages-search-content', {

        query: trimmed,

        limit: SEARCH_LIMIT

      })

      if (res?.success && res.results) {

        setHits(res.results.map((r) => ({

          messageId: r.messageId,

          sessionId: r.sessionId,

          sessionTitle: r.sessionTitle,

          snippet: r.snippet,

          createdAt: r.createdAt

        })))

      } else {

        setHits([])

      }

    } catch {

      setHits([])

    }

    setSearching(false)

  }, [])



  useEffect(() => {

    if (timerRef.current) clearTimeout(timerRef.current)

    if (!query.trim()) {

      setHits([])

      setSearching(false)

      return

    }

    timerRef.current = setTimeout(() => {

      void doSearch(query)

    }, SEARCH_DEBOUNCE_MS)

    return () => {

      if (timerRef.current) clearTimeout(timerRef.current)

    }

  }, [query, doSearch])



  // Reset when dialog closes

  useEffect(() => {

    if (!open) {

      setQuery('')

      setHits([])

      setSearching(false)

    }

  }, [open])



  const runAndClose = useCallback((fn: () => void) => {

    fn()

    onOpenChange(false)

  }, [onOpenChange])



  const handleSelect = useCallback(

    (sessionId: string) => {

      void loadRecentSessionMessages(sessionId)

      navigateToSession(sessionId)

      onOpenChange(false)

    },

    [loadRecentSessionMessages, navigateToSession, onOpenChange]

  )



  const handleNewChat = useCallback(() => {

    setActiveProjectHome(null)

    setMode('chat')

    navigateToHome()

  }, [setActiveProjectHome, setMode, navigateToHome])



  // Recent sessions (top 5, excluding active)

  const recentSessions = useMemo(

    () => sessions

      .filter((s) => s.id !== activeSessionId)

      .sort((a, b) => b.updatedAt - a.updatedAt)

      .slice(0, 5),

    [sessions, activeSessionId]

  )



  const hasQuery = query.trim().length > 0



  return (

    <CommandDialog

      open={open}

      onOpenChange={onOpenChange}

      title={t('sidebar.searchLabel', { defaultValue: 'Search' })}

      description={t('sidebar.searchPlaceholder', { defaultValue: 'Search messages…' })}

      showCloseButton={true}

      className="sm:max-w-2xl flex flex-col"

    >

      <CommandInput

        placeholder={t('sidebar.searchPlaceholder', { defaultValue: 'Search messages…' })}

        value={query}

        onValueChange={setQuery}

      />

      <CommandList className={hasQuery ? "max-h-[420px]" : "max-h-[none] overflow-y-hidden"}>

        {/* ── Search results mode ── */}

        {hasQuery && (

          <>

            {searching && hits.length === 0 ? (

              <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground/60">

                <Search className="size-4 animate-spin" />

                {t('sidebar.searching', { defaultValue: 'Searching…' })}

              </div>

            ) : hits.length === 0 ? (

              <CommandEmpty>

                {t('sidebar.noResultsFor', { defaultValue: 'No results for' })} "{query}"

              </CommandEmpty>

            ) : (

              <CommandGroup heading={t('sidebar.messages', { defaultValue: 'Messages' })}>

                {hits.map((hit) => (

                  <CommandItem

                    key={hit.messageId}

                    value={`${hit.sessionTitle} ${hit.snippet}`}

                    onSelect={() => handleSelect(hit.sessionId)}

                  >

                    <MessageSquare className="size-4 shrink-0 text-muted-foreground/50" />

                    <div className="flex min-w-0 flex-col gap-0.5">

                      <div className="flex items-center gap-1.5">

                        <span className="truncate text-sm font-medium text-foreground/90">

                          {hit.sessionTitle || hit.sessionId}

                        </span>

                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/40">

                          {formatRelativeTime(hit.createdAt)}

                        </span>

                      </div>

                      {hit.snippet && (

                        <p className="line-clamp-1 text-xs text-muted-foreground/70">

                          {hit.snippet}

                        </p>

                      )}

                    </div>

                  </CommandItem>

                ))}

              </CommandGroup>

            )}

          </>

        )}



        {/* ── Default mode: quick actions + recent sessions ── */}

        {!hasQuery && (

          <>

            {/* Quick actions */}

            <CommandGroup heading={t('searchDialog.quickActions', { defaultValue: 'Quick Actions' })}>

              <CommandItem onSelect={() => runAndClose(handleNewChat)}>

                <Plus className="size-4" />

                <span>{t('sidebar.newChat', { defaultValue: 'New Chat' })}</span>

              </CommandItem>

              <CommandItem onSelect={() => runAndClose(() => openSettings('general'))}>

                <Settings className="size-4" />

                <span>{tSettings('tabs.general.label', { defaultValue: 'General' })}</span>

              </CommandItem>

              <CommandItem onSelect={() => runAndClose(() => openSettings('provider'))}>

                <Server className="size-4" />

                <span>{tSettings('tabs.provider.label', { defaultValue: 'AI Provider' })}</span>

              </CommandItem>

              <CommandItem onSelect={() => runAndClose(() => openSettings('persona'))}>

                <User className="size-4" />

                <span>{tSettings('tabs.persona.label', { defaultValue: 'Persona' })}</span>

              </CommandItem>

              <CommandItem onSelect={() => runAndClose(() => setShortcutsOpen(true))}>

                <Keyboard className="size-4" />

                <span>{t('searchDialog.keyboardShortcuts', { defaultValue: 'Keyboard Shortcuts' })}</span>

              </CommandItem>

              <CommandItem onSelect={() => runAndClose(toggleLeftSidebar)}>

                <PanelLeft className="size-4" />

                <span>{t('searchDialog.toggleSidebar', { defaultValue: 'Toggle Sidebar' })}</span>

              </CommandItem>

              <CommandItem onSelect={() => runAndClose(toggleRightPanel)}>

                <PanelRight className="size-4" />

                <span>{t('searchDialog.toggleRightPanel', { defaultValue: 'Toggle Right Panel' })}</span>

              </CommandItem>

              <CommandItem onSelect={() => runAndClose(() => {

                document.documentElement.classList.toggle('dark')

              })}>

                {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}

                <span>{t('searchDialog.toggleTheme', { defaultValue: 'Toggle Theme' })}</span>

              </CommandItem>

            </CommandGroup>



            <CommandSeparator />



            {/* Extensions */}

            <CommandGroup heading={t('sidebar.extensionsLabel', { defaultValue: 'Extensions' })}>

              <CommandItem onSelect={() => runAndClose(openDrawPage)}>

                <Image className="size-4" />

                <span>{t('sidebar.drawLabel', { defaultValue: 'Draw' })}</span>

              </CommandItem>

              <CommandItem onSelect={() => runAndClose(openTasksPage)}>

                <CalendarDays className="size-4" />

                <span>{t('sidebar.automationLabel', { defaultValue: 'Automation' })}</span>

              </CommandItem>

              <CommandItem onSelect={() => runAndClose(openTaskBoardPage)}>

                <SquareKanban className="size-4" />

                <span>{t('sidebar.taskBoardLabel', { defaultValue: 'Task Board' })}</span>

              </CommandItem>

            </CommandGroup>



            <CommandSeparator />



            {/* Recent sessions */}

            {recentSessions.length > 0 && (

              <CommandGroup heading={t('searchDialog.recentSessions', { defaultValue: 'Recent Sessions' })}>

                {recentSessions.map((s) => (

                  <CommandItem

                    key={s.id}

                    value={s.title}

                    onSelect={() => handleSelect(s.id)}

                  >

                    <MessageSquare className="size-4 shrink-0 text-muted-foreground/50" />

                    <span className="truncate text-sm">{s.title}</span>

                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/40">

                      {formatRelativeTime(s.updatedAt)}

                    </span>

                  </CommandItem>

                ))}

              </CommandGroup>

            )}

          </>

        )}

      </CommandList>

    </CommandDialog>

  )

}

