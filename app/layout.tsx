import './globals.css'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ScoreTrak',
  description: 'Realtime GAA fixtures, live scores and results',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="siteHeader">
            <Link href="/" className="brand">GAA ScoreHub</Link>
            <nav>
              <Link href="/">Scores</Link>
              <Link href="/report">Reporter</Link>
              <Link href="/admin">Admin</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}
