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
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.5px' }}>
            En·flunce
          </span>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            background: '#3b82f6',
            color: '#fff',
            padding: '1px 6px',
            borderRadius: 4,
            letterSpacing: '0.5px',
          }}>
            RADAR
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
          KOL Discovery Platform
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 8px', flex: 1 }}>
        {NAV_ITEMS.map((group) => (
          <div key={group.group} style={{ marginBottom: 16 }}>
            <div style={{
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
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 10px',
                    borderRadius: 7,
                    marginTop: 2,
                    textDecoration: 'none',
                    color: isActive ? '#f8fafc' : '#94a3b8',
                    background: isActive ? '#334155' : 'transparent',
                    transition: 'all 0.15s',
                    fontSize: 13,
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  <span style={{ fontSize: 14, opacity: 0.8 }}>{item.icon}</span>
                  <span>{item.label}</span>
                  <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>
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
        padding: '12px 16px',
        borderTop: '1px solid #334155',
        fontSize: 11,
        color: '#475569',
      }}>
        <Link href="/settings" style={{ color: '#475569', textDecoration: 'none' }}>
          ⚙ 设置 Settings
        </Link>
      </div>
    </aside>
  )
}
