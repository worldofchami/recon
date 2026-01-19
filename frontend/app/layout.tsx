import type { Metadata } from 'next'
import './globals.css'
import { ReactQueryProvider } from './providers'
import Navbar from './components/Navbar'

export const metadata: Metadata = {
  title: 'Direla | Enterprise Reconciliation Engine',
  description: 'Enterprise-grade event-driven reconciliation for high-volume financial operations',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
      </head>
      <body className="min-h-screen bg-surface-primary antialiased">
        <ReactQueryProvider>
          <div className="relative min-h-screen">
            {/* Ambient background gradient */}
            <div className="fixed inset-0 bg-mesh-gradient pointer-events-none" />
            
            {/* Content */}
            <div className="relative">
              <Navbar />
              <main className="animate-fade-in">
                {children}
              </main>
            </div>
          </div>
        </ReactQueryProvider>
      </body>
    </html>
  )
}
