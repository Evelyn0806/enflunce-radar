'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages }),
      })
      const json = await res.json()
      if (res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: json.reply }])
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: `错误: ${json.error ?? '请求失败'}` }])
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: '网络错误，请重试' }])
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>AI 助手</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
          基于 KOL 数据库的智能问答 · 支持中英文
        </p>
      </div>

      {/* Messages */}
      <div className="card" style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>💬</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>试试问我：</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              {[
                '帮我设置 KOL 发新帖时自动推送到 TG 群',
                '在 Telegram 里用 /add /status /search 操作 Radar',
                '怎么让团队多人在 TG 群里协作管理 KOL？',
                '帮我生成本周 KOL 活跃度日报和合作 ROI 摘要',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  style={{
                    padding: '8px 14px', background: '#f8fafc', border: '1px solid #e2e8f0',
                    borderRadius: 8, cursor: 'pointer', textAlign: 'left', color: '#475569',
                    fontSize: 13, transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6366f1' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0' }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              maxWidth: '75%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: msg.role === 'user' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#f1f5f9',
              color: msg.role === 'user' ? '#ffffff' : '#0f172a',
              fontSize: 13,
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '10px 14px', borderRadius: '12px 12px 12px 2px', background: '#f1f5f9', color: '#94a3b8', fontSize: 13 }}>
              思考中...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          placeholder="问关于 KOL 的任何问题..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          disabled={loading}
        />
        <button
          className="btn btn-primary"
          onClick={send}
          disabled={loading || !input.trim()}
          style={{ flexShrink: 0 }}
        >
          发送
        </button>
      </div>
    </div>
  )
}
