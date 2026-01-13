'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import { 
  Plus, 
  Users2, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp,
  Zap,
  ArrowRight,
  X,
  Loader2
} from 'lucide-react'

export default function DirelaPage() {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTransaction, setNewTransaction] = useState({
    source_system: '',
    amount_local: '',
    source_ref_id: '',
    party_type: 'MERCHANT',
    phone_number: '',
    product_type: ''
  })

  const queryClient = useQueryClient()

  const { data: saRules } = useQuery({
    queryKey: ['sa-rules'],
    queryFn: apiClient.getSouthAfricanRules,
  })

  const createDirelaIdMutation = useMutation({
    mutationFn: apiClient.createDirelaId,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
    },
  })

  const handleCreateDirelaId = () => {
    createDirelaIdMutation.mutate({
      ...newTransaction,
      amount_local: parseFloat(newTransaction.amount_local),
    })
  }

  const resetForm = () => {
    setShowCreateForm(false)
    setNewTransaction({
      source_system: '',
      amount_local: '',
      source_ref_id: '',
      party_type: 'MERCHANT',
      phone_number: '',
      product_type: ''
    })
    createDirelaIdMutation.reset()
  }

  const stats = [
    { 
      label: 'Active Direla IDs', 
      value: '24', 
      icon: Users2, 
      color: 'sky',
      change: '+3 today'
    },
    { 
      label: 'Avg. Confidence', 
      value: '94.2%', 
      icon: TrendingUp, 
      color: 'emerald',
      change: '+1.2%'
    },
    { 
      label: 'Auto-Settled', 
      value: '18', 
      icon: CheckCircle2, 
      color: 'emerald',
      change: '75%'
    },
    { 
      label: 'Manual Review', 
      value: '6', 
      icon: AlertCircle, 
      color: 'amber',
      change: '25%'
    },
  ]

  const colorMap: Record<string, { bg: string; text: string; glow: string }> = {
    sky: { bg: 'bg-accent-sky/10', text: 'text-accent-sky', glow: 'shadow-[0_0_40px_rgba(56,189,248,0.08)]' },
    emerald: { bg: 'bg-accent-emerald/10', text: 'text-accent-emerald', glow: 'shadow-[0_0_40px_rgba(52,211,153,0.08)]' },
    amber: { bg: 'bg-accent-amber/10', text: 'text-accent-amber', glow: 'shadow-[0_0_40px_rgba(251,191,36,0.08)]' },
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 opacity-0 animate-fade-in-up">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-content-primary mb-2">
                Direla Multi-Party
              </h1>
              <p className="text-content-secondary">
                Real-time multi-party transaction matching for South African payment flows
              </p>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Direla ID
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon
            const colors = colorMap[stat.color]
            
            return (
              <div 
                key={stat.label}
                className={`glass-card stat-card p-5 opacity-0 animate-fade-in-up ${colors.glow}`}
                style={{ animationDelay: `${100 + index * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${colors.bg}`}>
                    <Icon className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <span className="text-xs font-medium text-content-muted">{stat.change}</span>
                </div>
                <p className="text-sm font-medium text-content-tertiary mb-1">{stat.label}</p>
                <p className={`text-2xl font-bold tracking-tight ${colors.text}`}>{stat.value}</p>
              </div>
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
              <p className="text-xs text-content-muted">Pre-configured rules for South African payment flows</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {saRules && Object.entries(saRules).map(([key, rule]: [string, any], index) => (
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
                    <span className="text-content-secondary font-medium">{rule.min_parties}–{rule.max_parties}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-content-muted">Time Window</span>
                    <span className="text-content-secondary font-medium">{rule.criteria.time_window_minutes}min</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-content-muted">Min Confidence</span>
                    <span className="text-accent-emerald font-medium">{rule.criteria.min_confidence}%</span>
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

        {/* Create Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={resetForm}
            />
            
            {/* Modal */}
            <div className="relative w-full max-w-2xl glass-card p-6 animate-fade-in-up shadow-2xl border border-white/[0.2]">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-emerald/10">
                    <Users2 className="w-5 h-5 text-accent-emerald" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-content-primary">Create Direla ID</h2>
                    <p className="text-xs text-content-muted">Initialize a new multi-party transaction</p>
                  </div>
                </div>
                <button
                  onClick={resetForm}
                  className="p-2 rounded-lg hover:bg-white/[0.05] text-content-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Success State */}
              {createDirelaIdMutation.isSuccess ? (
                <div className="py-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-status-success/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-status-success" />
                  </div>
                  <h3 className="text-xl font-semibold text-content-primary mb-2">Direla ID Created</h3>
                  <p className="text-content-secondary mb-4">
                    Your universal transaction ID is ready
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-accent-emerald/10 border border-accent-emerald/20 mb-6">
                    <span className="text-lg font-mono font-semibold text-accent-emerald">
                      {createDirelaIdMutation.data?.direla_id}
                    </span>
                  </div>
                  <p className="text-sm text-content-muted mb-6">
                    All parties can now use this ID to link their transaction records
                  </p>
                  <button onClick={resetForm} className="btn-primary">
                    Done
                  </button>
                </div>
              ) : (
                <>
                  {/* Form */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-content-secondary mb-2">
                        Source System
                      </label>
                      <input
                        type="text"
                        className="input-field w-full"
                        value={newTransaction.source_system}
                        onChange={(e) => setNewTransaction({ ...newTransaction, source_system: e.target.value })}
                        placeholder="e.g., Lesaka_POS"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-content-secondary mb-2">
                        Amount (ZAR)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="input-field w-full"
                        value={newTransaction.amount_local}
                        onChange={(e) => setNewTransaction({ ...newTransaction, amount_local: e.target.value })}
                        placeholder="100.00"
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
                        onChange={(e) => setNewTransaction({ ...newTransaction, source_ref_id: e.target.value })}
                        placeholder="TX-12345"
                      />
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
                        onChange={(e) => setNewTransaction({ ...newTransaction, phone_number: e.target.value })}
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
                        onChange={(e) => setNewTransaction({ ...newTransaction, product_type: e.target.value })}
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

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.15]">
                    <button
                      onClick={resetForm}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateDirelaId}
                      disabled={createDirelaIdMutation.isPending || !newTransaction.source_system || !newTransaction.amount_local}
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
      </div>
    </div>
  )
}
