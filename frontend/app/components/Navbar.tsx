'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  AlertTriangle, 
  Settings, 
  FileCode, 
  Users2,
  Sparkles
} from 'lucide-react'

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Breaks', href: '/breaks', icon: AlertTriangle },
  { name: 'Sources', href: '/config', icon: Settings },
  { name: 'Matching Rules', href: '/rules', icon: FileCode },
  { name: 'Operator Console', href: '/console', icon: Users2 },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-30 border-b border-white/[0.06] bg-surface-primary/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center gap-3 group"
          >
            <img src="/assets/direla_logo.svg" alt="Direla Logo" className="size-24" />
          </Link>
          
          {/* Navigation */}
          <div className="flex items-center gap-1">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href))
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.name}</span>
                </Link>
              )
            })}
          </div>

          {/* Right section - could add user menu, notifications etc */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
              <div className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
              <span className="text-xs font-medium text-content-secondary">System Online</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
