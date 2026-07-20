import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useProviderStore } from '@renderer/stores/provider-store'
import type { ProviderType } from '../../../../../shared/types/provider'
import { PROVIDER_TYPE_LABELS, PROVIDER_TYPE_OPTIONS } from './constants'

export function AddProviderDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}): React.JSX.Element {
  const addCustomProvider = useProviderStore((s) => s.addCustomProvider)
  const [name, setName] = useState('')
  const [type, setType] = useState<ProviderType>('openai-chat')
  const [baseUrl, setBaseUrl] = useState('')

  const handleAdd = (): void => {
    if (!name.trim()) return
    addCustomProvider(name.trim(), type, baseUrl.trim())
    toast.success(`已添加 ${name.trim()}`)
    setName('')
    setBaseUrl('')
    setType('openai-chat')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>添加自定义服务商</DialogTitle>
          <DialogDescription>添加一个不在内置列表中的 AI 服务商</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">服务商名称</label>
            <Input
              placeholder="My Provider"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">协议类型</label>
            <Select value={type} onValueChange={(v) => setType(v as ProviderType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{PROVIDER_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Base URL</label>
            <Input
              placeholder="https://api.example.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">API 的基础地址，通常以 /v1 结尾</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
            <Button disabled={!name.trim()} onClick={handleAdd}>添加</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
