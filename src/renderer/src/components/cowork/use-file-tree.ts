import { useState, useCallback, useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useChatStore } from '@renderer/stores/chat-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { IPC } from '@renderer/lib/ipc/channels'
import { createSelectFileTag } from '@renderer/lib/select-file-tags'
import type { TreeNode, FileEntry, FileSearchItem } from './file-tree-types'
import {
  sortEntries, collectExpandedPaths, getErrorMessage, toRelativePath, basename
} from './file-tree-utils'

export interface UseFileTreeOptions {
  sessionId?: string | null
  surface?: 'card' | 'sheet' | 'agent'
  agentSearchOpen?: boolean
  watchEnabled?: boolean
}

export function useFileTree(options: UseFileTreeOptions) {
  const { sessionId = null, surface = 'card', agentSearchOpen = false, watchEnabled = true } = options
  const { t } = useTranslation('layout')
  const sessionView = useChatStore(
    useShallow((state) => {
      const resolvedSessionId = sessionId ?? state.activeSessionId
      const currentSession = resolvedSessionId
        ? state.sessions.find((item) => item.id === resolvedSessionId)
        : undefined
      const currentProject = currentSession?.projectId
        ? state.projects.find((item) => item.id === currentSession.projectId)
        : undefined

      return {
        sessionId: resolvedSessionId,
        projectId: currentSession?.projectId ?? currentProject?.id ?? null,
        projectName: currentProject?.name ?? null,
        workingFolder: currentSession?.workingFolder ?? currentProject?.workingFolder,
        sshConnectionId: currentSession?.sshConnectionId ?? currentProject?.sshConnectionId
      }
    })
  )
  const workingFolder = sessionView.workingFolder
  const sshConnectionId = sessionView.sshConnectionId
  const agentSurface = surface === 'agent'
  const previewPanelState = useUIStore((s) => s.previewPanelState)

  const [tree, setTree] = useState<TreeNode[]>([])
  const treeRef = useRef<TreeNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FileSearchItem[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [agentRootExpanded, setAgentRootExpanded] = useState(true)
  const lastAgentCommandIdRef = useRef(0)

  // --- Edit state for context menu actions ---
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [newItemParent, setNewItemParent] = useState<string | null>(null)
  const [newItemType, setNewItemType] = useState<'file' | 'directory'>('file')

  const loadDir = useCallback(
    async (dirPath: string): Promise<TreeNode[]> => {
      const result = sshConnectionId
        ? ((await ipcClient.invoke(IPC.SSH_FS_LIST_DIR, {
            connectionId: sshConnectionId,
            path: dirPath
          })) as FileEntry[] | { error: string })
        : ((await ipcClient.invoke(IPC.FS_LIST_DIR, { path: dirPath })) as
            | FileEntry[]
            | { error: string })
      if ('error' in result) throw new Error(String(result.error))
      const sorted = sortEntries(result as FileEntry[])
      return sorted.map((e) => ({
        ...e,
        expanded: false,
        loaded: e.type === 'file',
        children: e.type === 'directory' ? [] : undefined
      }))
    },
    [sshConnectionId]
  )

  useEffect(() => {
    treeRef.current = tree
  }, [tree])

  const hydrateExpandedNodes = useCallback(
    async (nodes: TreeNode[], expandedPaths: Set<string>): Promise<TreeNode[]> => {
      const hydrate = async (items: TreeNode[]): Promise<TreeNode[]> => {
        return Promise.all(
          items.map(async (node) => {
            if (node.type !== 'directory') return node
            const expanded = expandedPaths.has(node.path)
            if (!expanded) {
              return { ...node, expanded: false, loaded: false, children: [] }
            }

            try {
              const children = await loadDir(node.path)
              return {
                ...node,
                expanded: true,
                loaded: true,
                children: await hydrate(children)
              }
            } catch {
              return { ...node, expanded: true, loaded: true, children: node.children ?? [] }
            }
          })
        )
      }

      return hydrate(nodes)
    },
    [loadDir]
  )

  const loadRoot = useCallback(
    async (preserveExpanded = false) => {
      if (!workingFolder) return
      setLoading(true)
      setError(null)
      try {
        const expandedPaths: Set<string> = preserveExpanded
          ? collectExpandedPaths(treeRef.current)
          : new Set<string>()
        const nodes = await loadDir(workingFolder)
        const nextTree = preserveExpanded ? await hydrateExpandedNodes(nodes, expandedPaths) : nodes
        setTree(nextTree)
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load files'))
      } finally {
        setLoading(false)
      }
    },
    [hydrateExpandedNodes, workingFolder, loadDir]
  )

  useEffect(() => {
    treeRef.current = []
    void loadRoot(false)
  }, [loadRoot])

  const refreshTree = useCallback(async () => {
    await loadRoot(true)
  }, [loadRoot])

  // Watch working directory for changes and auto-refresh
  useEffect(() => {
    const shouldWatchWorkingFolder = watchEnabled && (!agentSurface || agentRootExpanded)
    if (!shouldWatchWorkingFolder || !workingFolder || sshConnectionId) return

    let mounted = true
    let refreshTimer: NodeJS.Timeout | null = null
    const handleDirChanged = (...args: unknown[]): void => {
      const payload = args[0]
      const data =
        payload && typeof payload === 'object'
          ? (payload as { path?: string; changedPath?: string })
          : undefined
      if (!mounted) return
      if (data?.path && data.path !== workingFolder) return
      // Debounce refresh to avoid excessive updates
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        if (!mounted) return
        void refreshTree()
      }, 500)
    }

    // Start watching the working directory
    void ipcClient.invoke(IPC.FS_WATCH_DIR, { path: workingFolder, recursive: true })

    // Listen for directory change events
    const cleanup = ipcClient.on(IPC.FS_DIR_CHANGED, handleDirChanged)

    return () => {
      mounted = false
      if (refreshTimer) clearTimeout(refreshTimer)
      cleanup()
      void ipcClient.invoke(IPC.FS_UNWATCH_DIR, { path: workingFolder, recursive: true })
    }
  }, [agentRootExpanded, agentSurface, watchEnabled, workingFolder, sshConnectionId, refreshTree])

  useEffect(() => {
    const query = searchQuery.trim()
    if (!workingFolder || !query) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }

    let cancelled = false
    setSearchLoading(true)
    const timer = window.setTimeout(() => {
      void ipcClient
        .invoke(
          sshConnectionId ? IPC.SSH_FS_GLOB : 'fs:search-files',
          sshConnectionId
            ? {
                connectionId: sshConnectionId,
                path: workingFolder,
                pattern: `*${query}*`
              }
            : {
                path: workingFolder,
                query,
                limit: 100
              }
        )
        .then((result) => {
          if (cancelled) return
          if (sshConnectionId) {
            const matches = (
              result as { matches?: Array<{ path: string; type?: 'file' | 'directory' }> }
            ).matches
            setSearchResults(
              Array.isArray(matches)
                ? matches
                    .filter((item) => item.type !== 'directory')
                    .slice(0, 100)
                    .map((item) => ({ path: item.path, name: basename(item.path) }))
                : []
            )
            return
          }
          setSearchResults(Array.isArray(result) ? (result as FileSearchItem[]) : [])
        })
        .catch(() => {
          if (cancelled) return
          setSearchResults([])
        })
        .finally(() => {
          if (cancelled) return
          setSearchLoading(false)
        })
    }, 120)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searchQuery, sshConnectionId, workingFolder])

  const handleToggle = useCallback(
    async (dirPath: string) => {
      const toggleNode = async (nodes: TreeNode[]): Promise<TreeNode[]> => {
        return Promise.all(
          nodes.map(async (n) => {
            if (n.path === dirPath && n.type === 'directory') {
              if (n.expanded) {
                return { ...n, expanded: false }
              }
              // Always reload directory contents when expanding to ensure fresh data
              try {
                const children = await loadDir(dirPath)
                return { ...n, expanded: true, loaded: true, children }
              } catch {
                return { ...n, expanded: true, loaded: true, children: [] }
              }
            }
            if (n.children) {
              return { ...n, children: await toggleNode(n.children) }
            }
            return n
          })
        )
      }
      setTree(await toggleNode(treeRef.current))
    },
    [loadDir]
  )

  // Refresh a single directory's children in the tree (after create/rename/delete)
  const refreshDir = useCallback(
    async (dirPath: string) => {
      if (dirPath) await refreshTree()
    },
    [refreshTree]
  )

  const handleCopyPath = useCallback(
    (filePath: string) => {
      void navigator.clipboard.writeText(filePath).catch((err) => {
        toast.error(t('fileTree.copyFailed'), {
          description: getErrorMessage(err, 'Unable to copy path')
        })
      })
    },
    [t]
  )

  const handleAddToChat = useCallback(
    (filePath: string) => {
      const relativePath = toRelativePath(filePath, workingFolder)
      useUIStore.getState().setPendingInsertText(createSelectFileTag(relativePath))
    },
    [workingFolder]
  )

  return {
    t, sessionView, workingFolder, sshConnectionId, agentSurface,
    previewPanelState,
    tree, setTree, treeRef, loading, error,
    searchQuery, setSearchQuery, searchResults, searchLoading,
    agentRootExpanded, setAgentRootExpanded,
    renamingPath, setRenamingPath,
    newItemParent, setNewItemParent,
    newItemType, setNewItemType,
    loadDir, loadRoot, refreshTree, refreshDir,
    handleToggle, handleCopyPath, handleAddToChat
  }
}

export type FileTreeState = ReturnType<typeof useFileTree>
