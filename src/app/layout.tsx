import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'En·flunce Radar',
  description: 'KOL Discovery & Management Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
