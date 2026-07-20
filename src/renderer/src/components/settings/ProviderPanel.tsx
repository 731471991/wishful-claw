import { useState, useCallback } from 'react'
import { useProviderStore, builtinProviderPresets } from '../../stores/provider-store'
import type { AIProvider, AIModelConfig, BuiltinProviderPreset } from '../../../../shared/types/provider'

export function ProviderPanel({ onClose }: { onClose?: () => void }) {
  const {
    providers,
    activeProviderId,
    addProvider,
    updateProvider,
    deleteProvider,
    setActiveProvider,
    setModels,
    testConnection,
    fetchModels
  } = useProviderStore()

  const [selectedId, setSelectedId] = useState<string | null>(
    activeProviderId ?? providers[0]?.id ?? null
  )
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [testing, setTesting] = useState(false)
  const [fetchingModels, setFetchingModels] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const selectedProvider = providers.find(p => p.id === selectedId) ?? null

  const handleAddProvider = useCallback((preset: BuiltinProviderPreset) => {
    const provider = addProvider(preset)
    setSelectedId(provider.id)
    setShowAddMenu(false)
  }, [addProvider])

  const handleTest = useCallback(async () => {
    if (!selectedProvider) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testConnection(selectedProvider)
      if (result.ok) {
        setTestResult(`✓ 连接成功${result.statusCode ? ` (HTTP ${result.statusCode})` : ''}`)
      } else {
        setTestResult(`✗ ${result.error ?? '连接失败'}`)
      }
    } catch (err) {
      setTestResult(`✗ ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTesting(false)
    }
  }, [selectedProvider, testConnection])

  const handleFetchModels = useCallback(async () => {
    if (!selectedProvider) return
    setFetchingModels(true)
    try {
      const models = await fetchModels(selectedProvider)
      const modelConfigs: AIModelConfig[] = models.map(m => ({
        id: m.id,
        name: m.name ?? m.id,
        enabled: true
      }))
      setModels(selectedProvider.id, modelConfigs)
    } catch (err) {
      setTestResult(`✗ 拉取模型失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setFetchingModels(false)
    }
  }, [selectedProvider, fetchModels, setModels])

  const handleDelete = useCallback(() => {
    if (!selectedProvider) return
    if (!confirm(`确定删除 Provider "${selectedProvider.name}"？`)) return
    deleteProvider(selectedProvider.id)
    const remaining = providers.filter(p => p.id !== selectedProvider.id)
    setSelectedId(remaining[0]?.id ?? null)
  }, [selectedProvider, deleteProvider, providers])

  if (!selectedProvider && providers.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>AI 服务商</h2>
          {onClose && <button onClick={onClose} style={closeBtnStyle}>✕</button>}
        </div>
        <div style={{ ...emptyStateStyle, position: 'relative' }}>
          <p style={{ color: '#888', marginBottom: '16px' }}>还没有配置任何 Provider</p>
          <button onClick={() => setShowAddMenu(!showAddMenu)} style={primaryBtnStyle}>
            + 添加 Provider
          </button>
          {showAddMenu && (
            <div style={dropdownStyle}>
              {builtinProviderPresets.map(preset => (
                <button
                  key={preset.builtinId}
                  onClick={() => handleAddProvider(preset)}
                  style={dropdownItemStyle}
                >
                  <span>{preset.name}</span>
                  <span style={{ color: '#666', fontSize: '0.8rem' }}>{preset.type}</span>
                </button>
              ))}
              <button
                onClick={() => {
                  const custom: BuiltinProviderPreset = {
                    builtinId: 'custom',
                    version: 1,
                    name: '自定义 (OpenAI 兼容)',
                    type: 'openai-chat',
                    defaultBaseUrl: '',
                    homepage: '',
                    defaultModels: [],
                    requiresApiKey: true
                  }
                  handleAddProvider(custom)
                }}
                style={dropdownItemStyle}
              >
                <span>自定义 (OpenAI 兼容)</span>
                <span style={{ color: '#666', fontSize: '0.8rem' }}>openai-chat</span>
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>AI 服务商</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            style={smallBtnStyle}
          >
            + 添加
          </button>
          {onClose && <button onClick={onClose} style={closeBtnStyle}>✕</button>}
        </div>
      </div>

      {showAddMenu && (
        <div style={dropdownStyle}>
          {builtinProviderPresets.map(preset => (
            <button
              key={preset.builtinId}
              onClick={() => handleAddProvider(preset)}
              style={dropdownItemStyle}
            >
              <span>{preset.name}</span>
              <span style={{ color: '#666', fontSize: '0.8rem' }}>{preset.type}</span>
            </button>
          ))}
          <button
            onClick={() => {
              const custom: BuiltinProviderPreset = {
                builtinId: 'custom',
                version: 1,
                name: '自定义 (OpenAI 兼容)',
                type: 'openai-chat',
                defaultBaseUrl: '',
                homepage: '',
                defaultModels: [],
                requiresApiKey: true
              }
              handleAddProvider(custom)
            }}
            style={dropdownItemStyle}
          >
            <span>自定义 (OpenAI 兼容)</span>
            <span style={{ color: '#666', fontSize: '0.8rem' }}>openai-chat</span>
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
        {/* Provider list */}
        <div style={sidebarStyle}>
          {providers.map(p => (
            <button
              key={p.id}
              onClick={() => { setSelectedId(p.id); setActiveProvider(p.id); setTestResult(null); }}
              style={{
                ...providerItemStyle,
                ...(p.id === selectedId ? activeProviderItemStyle : {})
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: p.enabled ? '#55efc4' : '#636e72'
                }} />
                <span>{p.name}</span>
              </div>
              <span style={{ color: '#636e72', fontSize: '0.75rem' }}>
                {p.models.length} models
              </span>
            </button>
          ))}
        </div>

        {/* Provider detail */}
        {selectedProvider && (
          <div style={detailStyle}>
            {/* Name */}
            <div style={fieldStyle}>
              <label style={labelStyle}>名称</label>
              <input
                style={inputStyle}
                value={selectedProvider.name}
                onChange={e => updateProvider(selectedProvider.id, { name: e.target.value })}
              />
            </div>

            {/* Type */}
            <div style={fieldStyle}>
              <label style={labelStyle}>类型</label>
              <select
                style={inputStyle}
                value={selectedProvider.type}
                onChange={e => updateProvider(selectedProvider.id, { type: e.target.value as AIProvider['type'] })}
              >
                <option value="openai-chat">OpenAI Chat</option>
                <option value="openai-responses">OpenAI Responses</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>

            {/* Base URL */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Base URL</label>
              <input
                style={inputStyle}
                placeholder="https://api.openai.com/v1"
                value={selectedProvider.baseUrl}
                onChange={e => updateProvider(selectedProvider.id, { baseUrl: e.target.value })}
              />
            </div>

            {/* API Key */}
            <div style={fieldStyle}>
              <label style={labelStyle}>API Key</label>
              <input
                style={inputStyle}
                type="password"
                placeholder={selectedProvider.requiresApiKey === false ? '可选' : 'sk-...'}
                value={selectedProvider.apiKey}
                onChange={e => updateProvider(selectedProvider.id, { apiKey: e.target.value })}
              />
            </div>

            {/* Enabled */}
            <div style={fieldStyle}>
              <label style={labelStyle}>启用</label>
              <input
                type="checkbox"
                checked={selectedProvider.enabled}
                onChange={e => updateProvider(selectedProvider.id, { enabled: e.target.checked })}
              />
            </div>

            {/* Test + Fetch buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', marginBottom: '8px' }}>
              <button
                onClick={handleTest}
                disabled={testing}
                style={testing ? { ...primaryBtnStyle, opacity: 0.5 } : primaryBtnStyle}
              >
                {testing ? '测试中...' : '测试连接'}
              </button>
              <button
                onClick={handleFetchModels}
                disabled={fetchingModels}
                style={testing ? { ...secondaryBtnStyle, opacity: 0.5 } : secondaryBtnStyle}
              >
                {fetchingModels ? '拉取中...' : '拉取模型'}
              </button>
              <button onClick={handleDelete} style={dangerBtnStyle}>
                删除
              </button>
            </div>

            {testResult && (
              <div style={{
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                background: testResult.startsWith('✓') ? '#1a4a2a' : '#4a1a1a',
                color: testResult.startsWith('✓') ? '#55efc4' : '#e17055'
              }}>
                {testResult}
              </div>
            )}

            {/* Models */}
            <div style={{ marginTop: '16px' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '8px'
              }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ccc' }}>
                  模型 ({selectedProvider.models.length})
                </h3>
                <button
                  onClick={() => {
                    const id = prompt('模型 ID:')
                    if (!id) return
                    const name = prompt('显示名称:', id) ?? id
                    useProviderStore.getState().addModel(selectedProvider.id, {
                      id, name, enabled: true
                    })
                  }}
                  style={smallBtnStyle}
                >
                  + 添加模型
                </button>
              </div>

              {selectedProvider.models.length === 0 ? (
                <p style={{ color: '#636e72', fontSize: '0.85rem' }}>
                  暂无模型。点击"拉取模型"从 API 获取，或手动添加。
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {selectedProvider.models.map(model => (
                    <div
                      key={model.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '6px 10px',
                        background: '#1a1a2e',
                        borderRadius: '6px',
                        fontSize: '0.85rem'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={model.enabled}
                        onChange={e => useProviderStore.getState().updateModel(
                          selectedProvider.id, model.id, { enabled: e.target.checked }
                        )}
                      />
                      <span style={{ flex: 1, color: '#eee' }}>{model.name}</span>
                      <span style={{ color: '#636e72', fontSize: '0.75rem' }}>{model.id}</span>
                      {model.contextLength && (
                        <span style={{ color: '#636e72', fontSize: '0.7rem' }}>
                          {(model.contextLength / 1000).toFixed(0)}K
                        </span>
                      )}
                      <button
                        onClick={() => useProviderStore.getState().deleteModel(
                          selectedProvider.id, model.id
                        )}
                        style={{
                          background: 'none', border: 'none', color: '#e17055',
                          cursor: 'pointer', fontSize: '0.8rem'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles ──

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: '#0f0f1e',
  color: '#eee',
  fontFamily: 'system-ui, sans-serif'
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 20px',
  borderBottom: '1px solid #2a2a3e'
}

const titleStyle: React.CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 600,
  margin: 0
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#888',
  fontSize: '1.2rem', cursor: 'pointer'
}

const smallBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '0.8rem',
  background: '#2a2a3e',
  color: '#ccc',
  border: '1px solid #3a3a4e',
  borderRadius: '4px',
  cursor: 'pointer'
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '0.85rem',
  background: '#6c5ce7',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer'
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '0.85rem',
  background: '#2a2a3e',
  color: '#ccc',
  border: '1px solid #3a3a4e',
  borderRadius: '6px',
  cursor: 'pointer'
}

const dangerBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '0.85rem',
  background: '#4a1a1a',
  color: '#e17055',
  border: '1px solid #6a2a2a',
  borderRadius: '6px',
  cursor: 'pointer'
}

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#1a1a2e',
  border: '1px solid #3a3a4e',
  borderRadius: '8px',
  padding: '4px',
  zIndex: 100,
  minWidth: '280px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
}

const dropdownItemStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  width: '100%',
  padding: '8px 12px',
  background: 'none',
  border: 'none',
  color: '#eee',
  cursor: 'pointer',
  borderRadius: '4px',
  fontSize: '0.85rem'
}

const sidebarStyle: React.CSSProperties = {
  width: '200px',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  overflowY: 'auto',
  borderRight: '1px solid #2a2a3e',
  paddingRight: '8px'
}

const providerItemStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 12px',
  background: 'none',
  border: 'none',
  color: '#ccc',
  cursor: 'pointer',
  borderRadius: '6px',
  fontSize: '0.85rem',
  textAlign: 'left'
}

const activeProviderItemStyle: React.CSSProperties = {
  background: '#2a2a4e'
}

const detailStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '16px'
}

const fieldStyle: React.CSSProperties = {
  marginBottom: '12px'
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  color: '#888',
  marginBottom: '4px'
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: '#1a1a2e',
  border: '1px solid #3a3a4e',
  borderRadius: '6px',
  color: '#eee',
  fontSize: '0.85rem',
  outline: 'none'
}
