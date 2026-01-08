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
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Exceptions', href: '/breaks', icon: AlertTriangle },
  { name: 'Config', href: '/config', icon: Settings },
  { name: 'Rules', href: '/rules', icon: FileCode },
  { name: 'Direla', href: '/direla', icon: Users2 },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-surface-primary/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center gap-3 group"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-accent-emerald/20 blur-xl rounded-full group-hover:bg-accent-emerald/30 transition-all duration-500" />
              <div className="relative flex items-center justify-center w-9 h-9 bg-gradient-to-br from-accent-emerald to-accent-emerald-dim rounded-xl shadow-glow-sm group-hover:shadow-glow transition-shadow duration-300">
                <Sparkles className="w-5 h-5 text-surface-primary" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-content-primary">
                Recon
              </span>
              <span className="text-[10px] font-medium text-content-muted uppercase tracking-widest -mt-0.5">
                Platform
              </span>
            </div>
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
