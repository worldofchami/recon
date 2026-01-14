'use client'

import { useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import {
  Plus,
  Users2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Zap,
  ArrowRight,
  X,
  Loader2,
} from 'lucide-react'

type ModalType = 'confidence' | 'auto' | 'manual' | null

export default function OperatorConsolePage() {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [didCopyUniversalId, setDidCopyUniversalId] = useState(false)
  const [newTransaction, setNewTransaction] = useState({
    source_system: '',
    source_ref_id: '',
    party_type: 'MERCHANT',
    phone_number: '',
    product_type: '',
    direla_id: '',
  })

  const queryClient = useQueryClient()
  const idsTableRef = useRef<HTMLDivElement | null>(null)

  const { data: saRules } = useQuery({
    queryKey: ['sa-rules'],
    queryFn: apiClient.getSouthAfricanRules,
  })

  const { data: direlaIds, isLoading: isLoadingDirelaIds } = useQuery({
    queryKey: ['direla-ids'],
    queryFn: apiClient.getDirelaIds,
  })

  const { data: insights, isLoading: isLoadingInsights } = useQuery({
    queryKey: ['console-insights'],
    queryFn: apiClient.getConsoleInsights,
  })

  const createDirelaIdMutation = useMutation({
    mutationFn: apiClient.createDirelaId,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      queryClient.invalidateQueries({ queryKey: ['direla-ids'] })
    },
  })

  const handleCreateDirelaId = () => {
    createDirelaIdMutation.mutate(newTransaction)
  }

  const resetForm = () => {
    setShowCreateForm(false)
    setDidCopyUniversalId(false)
    setNewTransaction({
      source_system: '',
      source_ref_id: '',
      party_type: 'MERCHANT',
      phone_number: '',
      product_type: '',
      direla_id: '',
    })
    createDirelaIdMutation.reset()
  }

  const scrollToIds = () => {
    idsTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const stats = [
    {
      key: 'active',
      label: 'Active Direla IDs',
      value: `${direlaIds?.length ?? '—'}`,
      icon: Users2,
      color: 'sky',
      change: 'Scroll to list',
      onClick: scrollToIds,
    },
    {
      key: 'confidence',
      label: 'Avg. Confidence',
      value:
        insights?.avg_confidence !== null && insights?.avg_confidence !== undefined
          ? `${Number(insights.avg_confidence).toFixed(1)}%`
          : '—',
      icon: TrendingUp,
      color: 'emerald',
      change: 'View distribution',
      onClick: () => setActiveModal('confidence'),
    },
    {
      key: 'auto',
      label: 'Auto-Settled',
      value: insights?.auto_settled_recent ? `${insights.auto_settled_recent.length}` : '—',
      icon: CheckCircle2,
      color: 'emerald',
      change: 'View recent',
      onClick: () => setActiveModal('auto'),
    },
    {
      key: 'manual',
      label: 'Manual Review',
      value: insights?.manual_review_recent ? `${insights.manual_review_recent.length}` : '—',
      icon: AlertCircle,
      color: 'amber',
      change: 'View recent',
      onClick: () => setActiveModal('manual'),
    },
  ] as const

  const maxBucket = useMemo(() => {
    const buckets = insights?.confidence_buckets ?? []
    return buckets.reduce((m: number, b: any) => Math.max(m, b.count ?? 0), 0)
  }, [insights?.confidence_buckets])

  const colorMap: Record<string, { bg: string; text: string; glow: string }> = {
    sky: {
      bg: 'bg-accent-sky/10',
      text: 'text-accent-sky',
      glow: 'shadow-[0_0_40px_rgba(56,189,248,0.08)]',
    },
    emerald: {
      bg: 'bg-accent-emerald/10',
      text: 'text-accent-emerald',
      glow: 'shadow-[0_0_40px_rgba(52,211,153,0.08)]',
    },
    amber: {
      bg: 'bg-accent-amber/10',
      text: 'text-accent-amber',
      glow: 'shadow-[0_0_40px_rgba(251,191,36,0.08)]',
    },
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 opacity-0 animate-fade-in-up">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-content-primary mb-2">
                Operator Console
              </h1>
              <p className="text-content-secondary">
                Operational workflows for Direla: create universal IDs, inspect activity, and triage exceptions
              </p>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Universal ID
            </button>
          </div>
        </div>

        {/* Stats Grid (clickable) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon
            const colors = colorMap[stat.color]

            return (
              <button
                key={stat.key}
                type="button"
                onClick={stat.onClick}
                className={`glass-card stat-card p-5 opacity-0 animate-fade-in-up ${colors.glow} text-left hover:bg-white/[0.04] transition-colors`}
                style={{ animationDelay: `${100 + index * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-xl ${colors.bg}`}
                  >
                    <Icon className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <span className="text-xs font-medium text-content-muted">{stat.change}</span>
                </div>
                <p className="text-sm font-medium text-content-tertiary mb-1">{stat.label}</p>
                <p className={`text-2xl font-bold tracking-tight ${colors.text}`}>{stat.value}</p>
              </button>
            )
          })}
        </div>

        {/* SA Rules */}
        <div className="glass-card p-6 mb-8 opacity-0 animate-fade-in-up delay-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent-violet/10">
              <Zap className="w-4 h-4 text-accent-violet" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-content-primary">SA Matching Rules</h2>
              <p className="text-xs text-content-muted">
                Pre-configured rules for South African payment flows
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {saRules &&
              Object.entries(saRules).map(([key, rule]: [string, any]) => (
                <div
                  key={key}
                  className="p-4 rounded-xl bg-white/[0.06] border border-white/[0.12] hover:bg-white/[0.1] hover:border-white/[0.2] transition-all duration-200"
                >
                  <h3 className="font-semibold text-content-primary mb-3">{rule.name}</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-content-muted">Type</span>
                      <span className="badge badge-info border-0">{rule.type}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-content-muted">Parties</span>
                      <span className="text-content-secondary font-medium">
                        {rule.min_parties}–{rule.max_parties}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-content-muted">Time Window</span>
                      <span className="text-content-secondary font-medium">
                        {rule.criteria.time_window_minutes}min
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-content-muted">Min Confidence</span>
                      <span className="text-accent-emerald font-medium">
                        {rule.criteria.min_confidence}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}

            {(!saRules || Object.keys(saRules).length === 0) && (
              <div className="col-span-3 py-8 text-center">
                <p className="text-content-tertiary text-sm">No rules configured</p>
              </div>
            )}
          </div>
        </div>

        {/* Existing Direla IDs (moved to bottom) */}
        <div ref={idsTableRef} className="glass-card p-6 mb-8 opacity-0 animate-fade-in-up delay-150">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-content-primary">Existing Direla IDs</h2>
              <p className="text-xs text-content-muted">Recently active universal IDs</p>
            </div>
            {direlaIds && (
              <span className="text-xs text-content-muted">Showing {direlaIds.length} IDs</span>
            )}
          </div>

          {isLoadingDirelaIds ? (
            <div className="flex items-center justify-center py-8 text-content-muted text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading Direla IDs...
            </div>
          ) : !direlaIds || direlaIds.length === 0 ? (
            <div className="py-8 text-center text-content-tertiary text-sm">
              No Direla IDs found yet. Create a new universal ID to get started.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
              <table className="min-w-full text-sm">
                <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-content-tertiary">
                  <tr>
                    <th className="px-4 py-3 font-medium">Direla ID</th>
                    <th className="px-4 py-3 font-medium">Transactions</th>
                    <th className="px-4 py-3 font-medium">Sources</th>
                    <th className="px-4 py-3 font-medium">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {direlaIds.map((item: any) => (
                    <tr
                      key={item.direla_id}
                      className="border-t border-white/[0.04] hover:bg-white/[0.04] transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-accent-emerald">
                        {item.direla_id}
                      </td>
                      <td className="px-4 py-3 text-content-secondary">{item.transaction_count}</td>
                      <td className="px-4 py-3 text-content-secondary">
                        {item.sources?.join(', ')}
                      </td>
                      <td className="px-4 py-3 text-content-secondary">
                        {item.last_activity ? new Date(item.last_activity).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={resetForm} />
            <div className="relative w-full max-w-2xl glass-card p-6 animate-fade-in-up shadow-2xl border border-white/[0.2]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-emerald/10">
                    <Users2 className="w-5 h-5 text-accent-emerald" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-content-primary">Create Universal ID</h2>
                    <p className="text-xs text-content-muted">Initialize a multi-party flow (operator-led)</p>
                  </div>
                </div>
                <button
                  onClick={resetForm}
                  className="p-2 rounded-lg hover:bg-white/[0.05] text-content-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {createDirelaIdMutation.isSuccess ? (
                <div className="py-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-status-success/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-status-success" />
                  </div>
                  <h3 className="text-xl font-semibold text-content-primary mb-2">Universal ID Created</h3>
                  <p className="text-content-secondary mb-4">Share this ID with each party/system</p>
                  <div className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-accent-emerald/10 border border-accent-emerald/20 mb-6">
                    <span className="text-lg font-mono font-semibold text-accent-emerald">
                      {createDirelaIdMutation.data?.direla_id}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!createDirelaIdMutation.data?.direla_id) return
                        try {
                          await navigator.clipboard.writeText(createDirelaIdMutation.data.direla_id)
                          setDidCopyUniversalId(true)
                          setTimeout(() => setDidCopyUniversalId(false), 2000)
                        } catch {
                          // noop – clipboard might be unavailable
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-accent-emerald/20 text-accent-emerald hover:bg-accent-emerald/30 transition-colors"
                    >
                      {didCopyUniversalId ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <button onClick={resetForm} className="btn-primary">
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-content-secondary mb-2">
                        Source System
                      </label>
                      <input
                        type="text"
                        className="input-field w-full"
                        value={newTransaction.source_system}
                        onChange={(e) =>
                          setNewTransaction({ ...newTransaction, source_system: e.target.value })
                        }
                        placeholder="e.g., Lesaka_POS"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-content-secondary mb-2">
                        Reference ID
                      </label>
                      <input
                        type="text"
                        className="input-field w-full"
                        value={newTransaction.source_ref_id}
                        onChange={(e) =>
                          setNewTransaction({ ...newTransaction, source_ref_id: e.target.value })
                        }
                        placeholder="TX-12345"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-content-secondary mb-2">
                        Custom Universal ID <span className="text-content-muted">(optional)</span>
                      </label>
                      <input
                        type="text"
                        className="input-field w-full font-mono text-xs"
                        value={newTransaction.direla_id}
                        onChange={(e) =>
                          setNewTransaction({ ...newTransaction, direla_id: e.target.value })
                        }
                        placeholder="DIRELA-20260114-ABC123-000001"
                      />
                      <p className="mt-1 text-[11px] text-content-muted">
                        Leave blank to auto-generate. If provided, this exact ID will be used (no uniqueness checks).
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-content-secondary mb-2">
                        Party Type
                      </label>
                      <select
                        className="select-field w-full"
                        value={newTransaction.party_type}
                        onChange={(e) => setNewTransaction({ ...newTransaction, party_type: e.target.value })}
                      >
                        <option value="MERCHANT">Merchant</option>
                        <option value="POS_PROVIDER">POS Provider</option>
                        <option value="TELCO">Telco</option>
                        <option value="BANK">Bank</option>
                        <option value="UTILITY">Utility</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-content-secondary mb-2">
                        Phone Number <span className="text-content-muted">(optional)</span>
                      </label>
                      <input
                        type="text"
                        className="input-field w-full"
                        value={newTransaction.phone_number}
                        onChange={(e) =>
                          setNewTransaction({ ...newTransaction, phone_number: e.target.value })
                        }
                        placeholder="082-712-3456"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-content-secondary mb-2">
                        Product Type
                      </label>
                      <select
                        className="select-field w-full"
                        value={newTransaction.product_type}
                        onChange={(e) =>
                          setNewTransaction({ ...newTransaction, product_type: e.target.value })
                        }
                      >
                        <option value="">Select Product</option>
                        <option value="MTN_AIRTIME">MTN Airtime</option>
                        <option value="VODACOM_AIRTIME">Vodacom Airtime</option>
                        <option value="CELL_C_AIRTIME">Cell C Airtime</option>
                        <option value="ESKOM_ELECTRICITY">Eskom Electricity</option>
                        <option value="MUNICIPAL_ELECTRICITY">Municipal Electricity</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.15]">
                    <button onClick={resetForm} className="btn-secondary">
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateDirelaId}
                      disabled={
                        createDirelaIdMutation.isPending ||
                        !newTransaction.source_system
                      }
                      className="btn-primary flex items-center gap-2 disabled:opacity-50"
                    >
                      {createDirelaIdMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          Create Universal ID
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Modals */}
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setActiveModal(null)}
            />
            <div className="relative w-full max-w-3xl glass-card p-6 animate-fade-in-up shadow-2xl border border-white/[0.2]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-content-primary">
                  {activeModal === 'confidence'
                    ? 'Confidence Distribution'
                    : activeModal === 'auto'
                      ? 'Recent Auto-Settled Transactions'
                      : 'Recent Manual Review Transactions'}
                </h2>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-2 rounded-lg hover:bg-white/[0.05] text-content-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isLoadingInsights ? (
                <div className="flex items-center justify-center py-10 text-content-muted text-sm gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : activeModal === 'confidence' ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-content-tertiary">
                      Distribution computed from recent transactions with confidence scores.
                    </p>
                    <span className="text-xs text-content-muted">
                      Avg: {insights?.avg_confidence ? Number(insights.avg_confidence).toFixed(1) : '—'}%
                    </span>
                  </div>

                  <div className="space-y-3">
                    {(insights?.confidence_buckets ?? []).map((b: any) => {
                      const pct = maxBucket > 0 ? Math.round(((b.count ?? 0) / maxBucket) * 100) : 0
                      return (
                        <div key={b.label} className="flex items-center gap-3">
                          <div className="w-20 text-xs text-content-muted">{b.label}</div>
                          <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-accent-emerald/70"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="w-12 text-right text-xs text-content-secondary">{b.count ?? 0}</div>
                        </div>
                      )
                    })}
                    {(!insights?.confidence_buckets || insights.confidence_buckets.length === 0) && (
                      <div className="py-8 text-center text-content-tertiary text-sm">
                        No confidence scores available yet.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-content-tertiary">
                      <tr>
                        <th className="px-4 py-3 font-medium">Time</th>
                        <th className="px-4 py-3 font-medium">Source</th>
                        <th className="px-4 py-3 font-medium">Ref</th>
                        <th className="px-4 py-3 font-medium">Amount</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeModal === 'auto'
                        ? insights?.auto_settled_recent
                        : insights?.manual_review_recent
                      )?.map((t: any) => (
                        <tr
                          key={t.transaction_uuid}
                          className="border-t border-white/[0.04] hover:bg-white/[0.04] transition-colors"
                        >
                          <td className="px-4 py-3 text-content-secondary">
                            {t.transaction_datetime_utc
                              ? new Date(t.transaction_datetime_utc).toLocaleString()
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-content-secondary">{t.source_system}</td>
                          <td className="px-4 py-3 text-content-secondary">{t.source_ref_id}</td>
                          <td className="px-4 py-3 text-content-secondary">
                            {Number(t.amount_local).toLocaleString('en-ZA', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            {t.currency_code_iso}
                          </td>
                          <td className="px-4 py-3 text-content-secondary">{t.match_status ?? '—'}</td>
                        </tr>
                      ))}
                      {(!((activeModal === 'auto'
                        ? insights?.auto_settled_recent
                        : insights?.manual_review_recent
                      ) ?? []).length) && (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-content-tertiary text-sm">
                            No recent transactions found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

