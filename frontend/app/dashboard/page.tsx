'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Layers,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock
} from 'lucide-react'

const CHART_COLORS = [
  'rgb(52, 211, 153)',   // emerald
  'rgb(56, 189, 248)',   // sky
  'rgb(251, 191, 36)',   // amber
  'rgb(251, 113, 133)',  // rose
  'rgb(167, 139, 250)',  // violet
]

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  color: 'emerald' | 'rose' | 'amber' | 'sky' | 'violet'
  trend?: { value: number; positive: boolean }
  delay?: number
  onClick?: () => void
}

function StatCard({ title, value, subtitle, icon: Icon, color, trend, delay = 0, onClick }: StatCardProps) {
  const colorMap = {
    emerald: { bg: 'bg-accent-emerald/10', text: 'text-accent-emerald', glow: 'shadow-[0_0_40px_rgba(52,211,153,0.08)]' },
    rose: { bg: 'bg-accent-rose/10', text: 'text-accent-rose', glow: 'shadow-[0_0_40px_rgba(251,113,133,0.08)]' },
    amber: { bg: 'bg-accent-amber/10', text: 'text-accent-amber', glow: 'shadow-[0_0_40px_rgba(251,191,36,0.08)]' },
    sky: { bg: 'bg-accent-sky/10', text: 'text-accent-sky', glow: 'shadow-[0_0_40px_rgba(56,189,248,0.08)]' },
    violet: { bg: 'bg-accent-violet/10', text: 'text-accent-violet', glow: 'shadow-[0_0_40px_rgba(167,139,250,0.08)]' },
  }
  
  const colors = colorMap[color]

  return (
    <button 
      type="button"
      onClick={onClick}
      className={`glass-card stat-card p-6 opacity-0 animate-fade-in-up ${colors.glow} ${
        onClick ? 'hover:-translate-y-0.5 transition-transform focus:outline-none focus:ring-2 focus:ring-accent-emerald/40' : ''
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${colors.bg}`}>
          <Icon className={`w-5 h-5 ${colors.text}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend.positive ? 'text-status-success' : 'text-status-error'}`}>
            {trend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend.value}%
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-content-secondary">{title}</p>
        <p className={`text-3xl font-bold tracking-tight ${color === 'emerald' ? colors.text : 'text-content-primary'}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {subtitle && (
          <p className="text-xs text-content-secondary">{subtitle}</p>
        )}
      </div>
    </button>
  )
}

function LoadingSkeleton() {
  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="skeleton h-8 w-48 mb-2" />
          <div className="skeleton h-5 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-6">
              <div className="skeleton h-11 w-11 rounded-xl mb-4" />
              <div className="skeleton h-4 w-24 mb-2" />
              <div className="skeleton h-8 w-20" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-card p-6 h-[400px]">
            <div className="skeleton h-6 w-32 mb-4" />
            <div className="skeleton h-[300px] w-full rounded-xl" />
          </div>
          <div className="glass-card p-6 h-[400px]">
            <div className="skeleton h-6 w-32 mb-4" />
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="text-sm font-medium text-content-primary">{payload[0].name}</p>
        <p className="text-lg font-bold text-accent-emerald">{payload[0].value}</p>
      </div>
    )
  }
  return null
}

export default function DashboardPage() {
  const router = useRouter()
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    activity: any
  } | null>(null)
  const [rawModal, setRawModal] = useState<{
    open: boolean
    loading: boolean
    error: string | null
    content: string | null
    uri: string | null
    transactionId: string | null
  }>({
    open: false,
    loading: false,
    error: null,
    content: null,
    uri: null,
    transactionId: null,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: apiClient.getDashboardSummary,
    refetchInterval: 30000,
  })

  const closeContextMenu = () => {
    setContextMenu(null)
  }

  const openRawModalForActivity = async (activity: any) => {
    setRawModal({
      open: true,
      loading: true,
      error: null,
      content: null,
      uri: null,
      transactionId: activity.transaction_uuid,
    })
    try {
      const raw = await apiClient.getRawTransaction(activity.transaction_uuid)
      setRawModal({
        open: true,
        loading: false,
        error: null,
        content: raw.raw_text,
        uri: raw.raw_uri,
        transactionId: activity.transaction_uuid,
      })
    } catch (err: any) {
      setRawModal({
        open: true,
        loading: false,
        error: err?.response?.data?.detail || 'Failed to load raw transaction data',
        content: null,
        uri: null,
        transactionId: activity.transaction_uuid,
      })
    }
  }

  const formatRawContent = (text: string) => {
    try {
      const parsed = JSON.parse(text)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return text
    }
  }

  const handleCopyRawUrl = async () => {
    if (!rawModal.uri) return
    try {
      await navigator.clipboard.writeText(rawModal.uri)
    } catch {
      // ignore clipboard errors
    }
  }

  const handleDownloadRawJson = () => {
    if (!rawModal.content) return
    const pretty = formatRawContent(rawModal.content)
    const blob = new Blob([pretty], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const filename = `transaction-${rawModal.transactionId || 'raw'}.json`
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6">
        <div className="glass-card p-8 text-center max-w-md">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-status-error/10 mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-status-error" />
          </div>
          <h3 className="text-lg font-semibold text-content-primary mb-2">Unable to load dashboard</h3>
          <p className="text-sm text-content-tertiary">Please check your connection and try again.</p>
        </div>
      </div>
    )
  }

  const matchRate = data?.total_transactions
    ? ((data.matched_count / data.total_transactions) * 100).toFixed(1)
    : '0'

  const pieData = Object.entries(data?.breaks_by_category || {}).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value,
  }))

  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 opacity-0 animate-fade-in-up">
          <h1 className="text-3xl font-bold tracking-tight text-content-primary mb-2">
            Dashboard
          </h1>
          <p className="text-content-secondary">
            Real-time reconciliation metrics and system health
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Transactions"
            value={data?.total_transactions || 0}
            icon={FileText}
            color="sky"
            trend={{ value: 12.5, positive: true }}
            delay={100}
            onClick={() => router.push('/breaks')}
          />
          <StatCard
            title="Matched"
            value={data?.matched_count || 0}
            subtitle={`${matchRate}% match rate`}
            icon={CheckCircle2}
            color="emerald"
            trend={{ value: 3.2, positive: true }}
            delay={150}
            onClick={() => router.push('/breaks?match_status=MATCHED')}
          />
          <StatCard
            title="Unmatched"
            value={data?.unmatched_count || 0}
            icon={AlertCircle}
            color="rose"
            trend={{ value: 2.1, positive: false }}
            delay={200}
            onClick={() => router.push('/breaks?match_status=UNMATCHED')}
          />
          <StatCard
            title="Break Categories"
            value={Object.keys(data?.breaks_by_category || {}).length}
            icon={Layers}
            color="violet"
            delay={250}
            onClick={() => router.push('/breaks')}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {/* Pie Chart */}
          <div className="glass-card p-6 opacity-0 animate-fade-in-up delay-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-content-primary">Breaks by Category</h2>
              <span className="text-xs font-medium text-content-secondary px-2 py-1 rounded-md bg-white/[0.08] border border-white/[0.1]">
                {pieData.length} categories
              </span>
            </div>
            
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                        className="transition-opacity hover:opacity-80"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-content-tertiary text-sm">No break categories to display</p>
              </div>
            )}
            
            {/* Legend */}
            {pieData.length > 0 && (
              <div className="flex flex-wrap gap-4 mt-4 justify-center">
                {pieData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="text-xs text-content-secondary capitalize">{entry.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="glass-card p-6 opacity-0 animate-fade-in-up delay-400">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-content-primary">Recent Activity</h2>
              <div className="flex items-center gap-1.5 text-xs font-medium text-content-muted">
                <Activity className="w-3.5 h-3.5" />
                Live
              </div>
            </div>
            
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
              {data?.recent_activity?.slice(0, 6).map((activity: any) => (
                <div 
                  key={activity.transaction_uuid}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      activity,
                    })
                  }}
                  className="group p-4 rounded-xl bg-white/[0.06] border border-white/[0.12] hover:bg-white/[0.1] hover:border-white/[0.2] transition-all duration-200 cursor-default"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-content-primary truncate">
                          {activity.source_system}
                        </span>
                        <span className="text-xs text-content-muted">•</span>
                        <span className="text-xs text-content-tertiary font-mono truncate">
                          {activity.source_ref_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-content-muted">
                        <Clock className="w-3 h-3" />
                        {new Date(activity.transaction_datetime_utc).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-sm font-semibold text-content-primary whitespace-nowrap">
                        {Number(activity.amount_local).toLocaleString(undefined, { minimumFractionDigits: 2 })} {activity.currency_code_iso}
                      </span>
                      <span className={`
                        badge
                        ${activity.match_status === 'DIRELA_VERIFIED' ? 'badge-info' : ''}
                        ${activity.match_status === 'MATCHED_1_1' ? 'badge-success' : ''}
                        ${activity.match_status === 'DIRELA_REVIEW_REQUIRED' ? 'badge-warning' : ''}
                        ${!activity.match_status || activity.match_status === 'UNMATCHED' ? 'badge-error' : ''}
                      `}>
                        {(activity.match_status || 'UNMATCHED').replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                  
                  {(activity.confidence_score || activity.direla_id) && (
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.1]">
                      {activity.confidence_score && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 rounded-full bg-white/[0.15] overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-accent-emerald" 
                              style={{ width: `${activity.confidence_score}%` }}
                            />
                          </div>
                          <span className="text-xs text-content-muted">{activity.confidence_score}%</span>
                        </div>
                      )}
                      {activity.direla_id && (
                        <span className="text-xs font-mono text-accent-sky">
                          {activity.direla_id}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {(!data?.recent_activity || data.recent_activity.length === 0) && (
                <div className="h-[200px] flex items-center justify-center">
                  <p className="text-content-tertiary text-sm">No recent activity</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right-click context menu for recent transactions */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={closeContextMenu}
        >
          <div
            className="absolute min-w-[180px] rounded-lg bg-surface-elevated border border-white/10 shadow-xl py-1 text-sm"
            style={{ top: contextMenu.y, left: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full text-left px-3 py-2 hover:bg-white/[0.06] text-content-primary flex items-center gap-2"
              onClick={() => {
                openRawModalForActivity(contextMenu.activity)
                closeContextMenu()
              }}
            >
              View raw transaction
            </button>
          </div>
        </div>
      )}

      {/* Raw transaction modal */}
      {rawModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          onClick={() =>
            setRawModal({
              open: false,
              loading: false,
              error: null,
              content: null,
              uri: null,
              transactionId: null,
            })
          }
        >
          <div
            className="glass-card max-w-4xl w-full max-h-[90vh] overflow-hidden rounded-2xl border border-white/[0.2] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.15]">
              <div>
                <h2 className="text-base font-semibold text-content-primary">
                  Raw Transaction Data
                </h2>
                {rawModal.uri && (
                  <p className="text-[11px] text-content-muted truncate max-w-[32rem]">
                    Source: {rawModal.uri}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {rawModal.uri && (
                  <button
                    type="button"
                    onClick={handleCopyRawUrl}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    Copy URL
                  </button>
                )}
                {rawModal.content && (
                  <button
                    type="button"
                    onClick={handleDownloadRawJson}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    Download JSON
                  </button>
                )}
                <button
                  className="btn-secondary p-2 hover:bg-white/[0.1] transition-colors"
                  onClick={() =>
                    setRawModal({
                      open: false,
                      loading: false,
                      error: null,
                      content: null,
                      uri: null,
                      transactionId: null,
                    })
                  }
                >
                  <Clock className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto bg-black/40">
              {rawModal.loading && (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="w-7 h-7 border-2 border-accent-emerald/20 border-t-accent-emerald rounded-full animate-spin mb-3" />
                  <p className="text-xs text-content-tertiary">Loading raw data...</p>
                </div>
              )}
              {!rawModal.loading && rawModal.error && (
                <p className="text-xs text-status-error font-mono whitespace-pre-wrap">
                  {rawModal.error}
                </p>
              )}
              {!rawModal.loading && !rawModal.error && rawModal.content && (
                <pre className="text-xs text-content-primary font-mono whitespace-pre-wrap">
                  {formatRawContent(rawModal.content)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
