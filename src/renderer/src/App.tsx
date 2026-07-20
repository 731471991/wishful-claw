import { useState, useCallback } from 'react'

export function App() {
  const [result, setResult] = useState<string>('—')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePing = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await window.api.ping()
      setResult(`ok=${res.ok}, pid=${res.pid}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setResult('FAILED')
    } finally {
      setIsLoading(false)
    }
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '24px'
      }}
    >
      <h1 style={{ fontSize: '2rem', fontWeight: 600 }}>Wishful Claw</h1>
      <p style={{ color: '#888' }}>迭代一：项目骨架 — Ping/Pong 验证</p>

      <button
        onClick={handlePing}
        disabled={isLoading}
        style={{
          padding: '12px 32px',
          fontSize: '1rem',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          background: isLoading ? '#444' : '#6c5ce7',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          transition: 'background 0.2s'
        }}
      >
        {isLoading ? 'Pinging...' : 'Ping Worker'}
      </button>

      <div
        style={{
          padding: '16px 24px',
          background: '#16213e',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '0.95rem',
          minWidth: '300px',
          textAlign: 'center'
        }}
      >
        <div style={{ color: '#888', marginBottom: '4px' }}>Response:</div>
        <div style={{ color: error ? '#e74c3c' : '#55efc4' }}>
          {error ? `Error: ${error}` : result}
        </div>
      </div>
    </div>
  )
}
