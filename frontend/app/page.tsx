'use client'

import Link from 'next/link'
import { 
  LayoutDashboard, 
  AlertTriangle, 
  Settings, 
  FileCode, 
  Users2,
  ArrowUpRight,
  Zap,
  Shield,
  LineChart
} from 'lucide-react'

const features = [
  {
    name: 'Dashboard',
    description: 'Real-time KPIs and transaction analytics',
    href: '/dashboard',
    icon: LayoutDashboard,
    color: 'emerald',
  },
  {
    name: 'Exceptions',
    description: 'Investigate and resolve reconciliation breaks',
    href: '/breaks',
    icon: AlertTriangle,
    color: 'rose',
  },
  {
    name: 'Configuration',
    description: 'Field mappings and transformation rules',
    href: '/config',
    icon: Settings,
    color: 'violet',
  },
  {
    name: 'Rule Editor',
    description: 'Create and deploy matching algorithms',
    href: '/rules',
    icon: FileCode,
    color: 'amber',
  },
  {
    name: 'Direla',
    description: 'Multi-party reconciliation workflows',
    href: '/direla',
    icon: Users2,
    color: 'sky',
  },
]

const colorClasses: Record<string, { bg: string; text: string; glow: string; border: string }> = {
  emerald: {
    bg: 'bg-accent-emerald/10',
    text: 'text-accent-emerald',
    glow: 'group-hover:shadow-[0_0_30px_rgba(52,211,153,0.15)]',
    border: 'group-hover:border-accent-emerald/20',
  },
  rose: {
    bg: 'bg-accent-rose/10',
    text: 'text-accent-rose',
    glow: 'group-hover:shadow-[0_0_30px_rgba(251,113,133,0.15)]',
    border: 'group-hover:border-accent-rose/20',
  },
  violet: {
    bg: 'bg-accent-violet/10',
    text: 'text-accent-violet',
    glow: 'group-hover:shadow-[0_0_30px_rgba(167,139,250,0.15)]',
    border: 'group-hover:border-accent-violet/20',
  },
  amber: {
    bg: 'bg-accent-amber/10',
    text: 'text-accent-amber',
    glow: 'group-hover:shadow-[0_0_30px_rgba(251,191,36,0.15)]',
    border: 'group-hover:border-accent-amber/20',
  },
  sky: {
    bg: 'bg-accent-sky/10',
    text: 'text-accent-sky',
    glow: 'group-hover:shadow-[0_0_30px_rgba(56,189,248,0.15)]',
    border: 'group-hover:border-accent-sky/20',
  },
}

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Badge */}
          <div className="flex justify-center mb-8 opacity-0 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-accent-emerald/20">
                <Zap className="w-3 h-3 text-accent-emerald" />
              </div>
              <span className="text-sm font-medium text-content-secondary">
                Enterprise Reconciliation Engine
              </span>
            </div>
          </div>

          {/* Main headline */}
          <div className="text-center max-w-4xl mx-auto mb-6 opacity-0 animate-fade-in-up delay-100">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-content-primary leading-[1.1]">
              Financial Reconciliation,{' '}
              <span className="gradient-text">Reimagined</span>
            </h1>
          </div>

          {/* Subheadline */}
          <p className="text-center text-lg sm:text-xl text-content-secondary max-w-2xl mx-auto mb-12 opacity-0 animate-fade-in-up delay-200">
            High-volume transaction matching with dynamic configuration, 
            real-time processing, and intelligent break resolution.
          </p>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 sm:gap-16 mb-20 opacity-0 animate-fade-in-up delay-300">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-content-primary mb-1">99.9%</div>
              <div className="text-sm text-content-tertiary">Match Rate</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-content-primary mb-1">&lt;50ms</div>
              <div className="text-sm text-content-tertiary">Avg. Processing</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-content-primary mb-1">24/7</div>
              <div className="text-sm text-content-tertiary">Real-time Ops</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {features.map((feature, index) => {
              const Icon = feature.icon
              const colors = colorClasses[feature.color]
              
              return (
                <Link
                  key={feature.name}
                  href={feature.href}
                  className={`
                    group relative glass-card p-6
                    transition-all duration-300 ease-out-expo
                    hover:-translate-y-1
                    ${colors.glow}
                    ${colors.border}
                    opacity-0 animate-fade-in-up
                  `}
                  style={{ animationDelay: `${400 + index * 75}ms` }}
                >
                  {/* Icon */}
                  <div className={`
                    flex items-center justify-center w-11 h-11 rounded-xl mb-4
                    ${colors.bg}
                    transition-transform duration-300 group-hover:scale-110
                  `}>
                    <Icon className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  
                  {/* Content */}
                  <h3 className="text-base font-semibold text-content-primary mb-1.5 flex items-center gap-2">
                    {feature.name}
                    <ArrowUpRight className="w-4 h-4 text-content-muted opacity-0 -translate-x-1 translate-y-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0" />
                  </h3>
                  <p className="text-sm text-content-tertiary leading-relaxed">
                    {feature.description}
                  </p>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Bottom accent cards */}
      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-6 opacity-0 animate-fade-in-up delay-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-emerald/10">
                  <Zap className="w-5 h-5 text-accent-emerald" />
                </div>
                <h3 className="text-base font-semibold text-content-primary">Event-Driven</h3>
              </div>
              <p className="text-sm text-content-tertiary leading-relaxed">
                Real-time Pub/Sub architecture processes millions of transactions with sub-second latency.
              </p>
            </div>

            <div className="glass-card p-6 opacity-0 animate-fade-in-up delay-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-violet/10">
                  <Shield className="w-5 h-5 text-accent-violet" />
                </div>
                <h3 className="text-base font-semibold text-content-primary">Enterprise Security</h3>
              </div>
              <p className="text-sm text-content-tertiary leading-relaxed">
                SOC2 compliant infrastructure with end-to-end encryption and audit logging.
              </p>
            </div>

            <div className="glass-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '900ms' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-sky/10">
                  <LineChart className="w-5 h-5 text-accent-sky" />
                </div>
                <h3 className="text-base font-semibold text-content-primary">Smart Analytics</h3>
              </div>
              <p className="text-sm text-content-tertiary leading-relaxed">
                ML-powered break categorization and intelligent matching suggestions.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
