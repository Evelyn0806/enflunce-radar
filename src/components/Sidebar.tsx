'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  {
    group: '发现',
    items: [
      { href: '/discover', label: 'KOL 发现', labelEn: 'Discover', icon: '🔍' },
      { href: '/kols', label: 'KOL 名录', labelEn: 'Directory', icon: '◎' },
    ],
  },
  {
    group: '管理',
    items: [
      { href: '/crm', label: 'CRM 合作', labelEn: 'Collabs', icon: '◇' },
      { href: '/kols/health', label: '健康监控', labelEn: 'Health', icon: '◈' },
      { href: '/content', label: '内容效果', labelEn: 'ROI', icon: '◆' },
    ],
  },
  {
    group: '情报',
    items: [
      { href: '/competitor', label: '竞品雷达', labelEn: 'Competitor', icon: '◉' },
      { href: '/chat', label: 'AI 助手', labelEn: 'Chat', icon: '💬' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div style={{ padding: '16px 12px 12px', borderBottom: '1px solid #1e293b', minHeight: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 800,
            color: '#fff',
            flexShrink: 0,
          }}>
            E
          </div>
          <span className="sidebar-label" style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.5px' }}>
            En·flunce
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              background: '#6366f1',
              color: '#fff',
              padding: '1px 5px',
              borderRadius: 3,
              marginLeft: 6,
              letterSpacing: '0.5px',
              verticalAlign: 'middle',
            }}>
              RADAR
            </span>
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 6px', flex: 1, overflowY: 'auto' }}>
        {NAV_ITEMS.map((group) => (
          <div key={group.group} style={{ marginBottom: 16 }}>
            <div className="sidebar-label" style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#475569',
              padding: '4px 8px',
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
            }}>
              {group.group}
            </div>
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    marginTop: 2,
                    textDecoration: 'none',
                    color: isActive ? '#f8fafc' : '#94a3b8',
                    background: isActive ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))' : 'transparent',
                    transition: 'all 0.15s',
                    fontSize: 13,
                    fontWeight: isActive ? 500 : 400,
                    minHeight: 36,
                  }}
                >
                  <span style={{ fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                  <span className="sidebar-label">{item.label}</span>
                  <span className="sidebar-label" style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>
                    {item.labelEn}
                  </span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px',
        borderTop: '1px solid #1e293b',
        fontSize: 11,
        color: '#475569',
      }}>
        <Link href="/settings" title="设置" style={{ color: '#475569', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px' }}>
          <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>⚙</span>
          <span className="sidebar-label">设置 Settings</span>
        </Link>
      </div>
    </aside>
  )
}
