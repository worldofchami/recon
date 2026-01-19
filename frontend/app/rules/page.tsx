'use client'

import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, FileCode, Power, PowerOff, ChevronDown, X, AlertCircle } from 'lucide-react'
import { apiClient } from '@/lib/api'

interface Rule {
  rule_id: string
  name: string
  type: string
  priority: number
  criteria: Record<string, any>
  is_active: string
  break_category?: string
}

interface CriteriaForm {
  target_system?: string
  time_window_minutes?: number
  amount_tolerance?: number
  amount_field?: string
  grouping_field?: string
  similarity_threshold?: number
  match_fields?: string[]
  match_on_ids?: {
    source_ref_id?: boolean
    direla_id?: boolean
    phone_number?: boolean
    product_type?: boolean
  }
  exact_match_fields?: string[]
}

const AVAILABLE_FIELDS = [
  { value: 'source_ref_id', label: 'Source Reference ID' },
  { value: 'direla_id', label: 'Direla ID' },
  { value: 'phone_number', label: 'Phone Number' },
  { value: 'product_type', label: 'Product Type' },
  { value: 'party_type', label: 'Party Type' },
  { value: 'currency_code_iso', label: 'Currency' },
]

const AMOUNT_FIELDS = [
  { value: 'amount_local', label: 'Amount Local' },
  { value: 'merchant_payout', label: 'Merchant Payout' },
  { value: 'commission_amount', label: 'Commission Amount' },
]

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [sources, setSources] = useState<string[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newRule, setNewRule] = useState<Omit<Rule, 'rule_id'>>({
    name: '',
    type: '1:1',
    priority: 1,
    criteria: {},
    is_active: 'true',
  })
  const [criteriaForm, setCriteriaForm] = useState<CriteriaForm>({})

  useEffect(() => {
    loadRules()
    loadSources()
  }, [])

  const loadRules = async () => {
    try {
      setLoading(true)
      const data = await apiClient.getRules()
      setRules(data)
      if (data.length > 0) {
        setExpanded(data[0].rule_id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load rules')
    } finally {
      setLoading(false)
    }
  }

  const loadSources = async () => {
    try {
      const data = await apiClient.getAllSources()
      setSources(data)
    } catch (err) {
      console.error('Failed to load sources:', err)
    }
  }

  const handleAddRule = async () => {
    if (!newRule.name.trim()) {
      setError('Rule name is required')
      return
    }

    try {
      setError(null)
      const criteria = buildCriteriaFromForm(criteriaForm, newRule.type)
      const ruleToCreate = {
        ...newRule,
        criteria,
      }
      
      const result = await apiClient.createRule(ruleToCreate)
      await loadRules()
      setShowCreateForm(false)
      setNewRule({ name: '', type: '1:1', priority: 1, criteria: {}, is_active: 'true' })
      setCriteriaForm({})
      setExpanded(result.rule_id)
    } catch (err: any) {
      setError(err.message || 'Failed to create rule')
    }
  }

  const handleSave = async (ruleId: string) => {
    const rule = rules.find(r => r.rule_id === ruleId)
    if (!rule) return

    try {
      setError(null)
      const criteria = buildCriteriaFromForm(criteriaForm, rule.type)
      const updatedRule = {
        ...rule,
        criteria,
      }
      
      await apiClient.updateRule(ruleId, updatedRule)
      await loadRules()
      setEditing(null)
      setCriteriaForm({})
    } catch (err: any) {
      setError(err.message || 'Failed to update rule')
    }
  }

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return

    try {
      setError(null)
      await apiClient.deleteRule(ruleId)
      await loadRules()
    } catch (err: any) {
      setError(err.message || 'Failed to delete rule')
    }
  }

  const toggleEnabled = async (ruleId: string) => {
    const rule = rules.find(r => r.rule_id === ruleId)
    if (!rule) return

    try {
      setError(null)
      const updatedRule = {
        ...rule,
        is_active: rule.is_active === 'true' ? 'false' : 'true',
      }
      await apiClient.updateRule(ruleId, updatedRule)
      await loadRules()
    } catch (err: any) {
      setError(err.message || 'Failed to update rule')
    }
  }

  const toggleExpanded = (ruleId: string) => {
    setExpanded(expanded === ruleId ? null : ruleId)
  }

  const startEditing = (rule: Rule) => {
    setEditing(rule.rule_id)
    setCriteriaForm(parseCriteriaToForm(rule.criteria, rule.type))
  }

  const cancelEditing = () => {
    setEditing(null)
    setCriteriaForm({})
  }

  const buildCriteriaFromForm = (form: CriteriaForm, ruleType: string): Record<string, any> => {
    const criteria: Record<string, any> = {}
    
    if (form.target_system) criteria.target_system = form.target_system
    if (form.time_window_minutes !== undefined) criteria.time_window_minutes = form.time_window_minutes
    if (form.amount_tolerance !== undefined) criteria.amount_tolerance = form.amount_tolerance
    if (form.amount_field) criteria.amount_field = form.amount_field
    if (form.similarity_threshold !== undefined) criteria.similarity_threshold = form.similarity_threshold
    
    if (ruleType === 'N:1' && form.grouping_field) {
      criteria.grouping_field = form.grouping_field
    }
    
    if (form.match_fields && form.match_fields.length > 0) {
      criteria.match_fields = form.match_fields
    }
    
    if (form.match_on_ids) {
      criteria.match_on_ids = form.match_on_ids
    }
    
    if (form.exact_match_fields && form.exact_match_fields.length > 0) {
      criteria.exact_match_fields = form.exact_match_fields
    }
    
    return criteria
  }

  const parseCriteriaToForm = (criteria: Record<string, any>, ruleType: string): CriteriaForm => {
    return {
      target_system: criteria.target_system || '',
      time_window_minutes: criteria.time_window_minutes || 60,
      amount_tolerance: criteria.amount_tolerance || 0.01,
      amount_field: criteria.amount_field || 'amount_local',
      grouping_field: criteria.grouping_field || '',
      similarity_threshold: criteria.similarity_threshold || 80,
      match_fields: criteria.match_fields || [],
      match_on_ids: criteria.match_on_ids || {},
      exact_match_fields: criteria.exact_match_fields || [],
    }
  }

  const ruleTypeColors: Record<string, { bg: string; text: string }> = {
    '1:1': { bg: 'bg-accent-emerald/10', text: 'text-accent-emerald' },
    'N:1': { bg: 'bg-accent-sky/10', text: 'text-accent-sky' },
    'FUZZY': { bg: 'bg-accent-violet/10', text: 'text-accent-violet' },
  }

  const renderCriteriaEditor = (rule: Rule) => {
    const form = editing === rule.rule_id ? criteriaForm : parseCriteriaToForm(rule.criteria, rule.type)
    const isEditing = editing === rule.rule_id

    return (
      <div className="space-y-4">
        {/* Target System */}
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-2">
            Target System *
          </label>
          <select
            className="select-field w-full"
            value={form.target_system || ''}
            onChange={(e) => {
              if (isEditing) {
                setCriteriaForm({ ...form, target_system: e.target.value })
              }
            }}
            disabled={!isEditing}
          >
            <option value="">Select target system...</option>
            {sources.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>

        {/* Time Window */}
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-2">
            Time Window (minutes)
          </label>
          <input
            type="number"
            className="input-field w-full"
            value={form.time_window_minutes || 60}
            onChange={(e) => {
              if (isEditing) {
                setCriteriaForm({ ...form, time_window_minutes: parseInt(e.target.value) || 60 })
              }
            }}
            disabled={!isEditing}
            min="1"
          />
        </div>

        {/* Amount Tolerance */}
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-2">
            Amount Tolerance
          </label>
          <input
            type="number"
            step="0.01"
            className="input-field w-full"
            value={form.amount_tolerance || 0.01}
            onChange={(e) => {
              if (isEditing) {
                setCriteriaForm({ ...form, amount_tolerance: parseFloat(e.target.value) || 0.01 })
              }
            }}
            disabled={!isEditing}
            min="0"
          />
        </div>

        {/* Amount Field (for 1:1) */}
        {rule.type === '1:1' && (
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-2">
              Amount Field
            </label>
            <select
              className="select-field w-full"
              value={form.amount_field || 'amount_local'}
              onChange={(e) => {
                if (isEditing) {
                  setCriteriaForm({ ...form, amount_field: e.target.value })
                }
              }}
              disabled={!isEditing}
            >
              {AMOUNT_FIELDS.map(field => (
                <option key={field.value} value={field.value}>{field.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Grouping Field (for N:1) */}
        {rule.type === 'N:1' && (
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-2">
              Grouping Field *
            </label>
            <select
              className="select-field w-full"
              value={form.grouping_field || ''}
              onChange={(e) => {
                if (isEditing) {
                  setCriteriaForm({ ...form, grouping_field: e.target.value })
                }
              }}
              disabled={!isEditing}
            >
              <option value="">Select grouping field...</option>
              {AVAILABLE_FIELDS.map(field => (
                <option key={field.value} value={field.value}>{field.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Similarity Threshold (for FUZZY) */}
        {rule.type === 'FUZZY' && (
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-2">
              Similarity Threshold (%)
            </label>
            <input
              type="number"
              className="input-field w-full"
              value={form.similarity_threshold || 80}
              onChange={(e) => {
                if (isEditing) {
                  setCriteriaForm({ ...form, similarity_threshold: parseInt(e.target.value) || 80 })
                }
              }}
              disabled={!isEditing}
              min="0"
              max="100"
            />
          </div>
        )}

        {/* Match on IDs */}
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-2">
            Match on IDs
          </label>
          <div className="space-y-2">
            {[
              { key: 'source_ref_id', label: 'Source Reference ID' },
              { key: 'direla_id', label: 'Direla ID' },
              { key: 'phone_number', label: 'Phone Number' },
              { key: 'product_type', label: 'Product Type' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.match_on_ids?.[key as keyof typeof form.match_on_ids] || false}
                  onChange={(e) => {
                    if (isEditing) {
                      setCriteriaForm({
                        ...form,
                        match_on_ids: {
                          ...form.match_on_ids,
                          [key]: e.target.checked,
                        },
                      })
                    }
                  }}
                  disabled={!isEditing}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 checked:bg-accent-amber"
                />
                <span className="text-sm text-content-secondary">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Exact Match Fields */}
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-2">
            Exact Match Fields
          </label>
          <div className="space-y-2">
            {AVAILABLE_FIELDS.map(field => (
              <label key={field.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.exact_match_fields?.includes(field.value) || false}
                  onChange={(e) => {
                    if (isEditing) {
                      const current = form.exact_match_fields || []
                      const updated = e.target.checked
                        ? [...current, field.value]
                        : current.filter(f => f !== field.value)
                      setCriteriaForm({ ...form, exact_match_fields: updated })
                    }
                  }}
                  disabled={!isEditing}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 checked:bg-accent-amber"
                />
                <span className="text-sm text-content-secondary">{field.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-content-secondary">Loading rules...</div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 opacity-0 animate-fade-in-up">
          <h1 className="text-3xl font-bold tracking-tight text-content-primary mb-2">
            Rule Editor
          </h1>
          <p className="text-content-secondary">
            Create and manage matching rules for reconciliation
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="glass-card p-4 mb-6 bg-status-error/10 border border-status-error/20 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-status-error" />
            <span className="text-status-error">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto p-1 hover:bg-white/10 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Add New Rule */}
        {!showCreateForm ? (
          <div className="glass-card p-6 mb-6 opacity-0 animate-fade-in-up delay-100">
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create New Rule
            </button>
          </div>
        ) : (
          <div className="glass-card p-6 mb-6 opacity-0 animate-fade-in-up delay-100">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-content-primary">Create New Rule</h2>
              <button
                onClick={() => {
                  setShowCreateForm(false)
                  setNewRule({ name: '', type: '1:1', priority: 1, criteria: {}, is_active: 'true' })
                  setCriteriaForm({})
                }}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-2">
                    Rule Name *
                  </label>
                  <input
                    type="text"
                    placeholder="Rule name..."
                    className="input-field w-full"
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-2">
                    Type
                  </label>
                  <select
                    className="select-field w-full"
                    value={newRule.type}
                    onChange={(e) => {
                      setNewRule({ ...newRule, type: e.target.value })
                      setCriteriaForm({})
                    }}
                  >
                    <option value="1:1">1:1 Match</option>
                    <option value="N:1">N:1 Match</option>
                    <option value="FUZZY">Fuzzy Match</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-2">
                    Priority
                  </label>
                  <input
                    type="number"
                    placeholder="Priority"
                    className="input-field w-full"
                    value={newRule.priority}
                    onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 1 })}
                    min="1"
                  />
                </div>
              </div>

              <div className="border-t border-white/15 pt-4">
                <h3 className="text-sm font-medium text-content-secondary mb-4">Matching Criteria</h3>
                {renderCriteriaEditor({ ...newRule, rule_id: 'new' } as Rule)}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-white/15">
                <button
                  onClick={handleAddRule}
                  disabled={!newRule.name.trim()}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  Create Rule
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false)
                    setNewRule({ name: '', type: '1:1', priority: 1, criteria: {}, is_active: 'true' })
                    setCriteriaForm({})
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rules List */}
        <div className="space-y-3 opacity-0 animate-fade-in-up delay-200">
          {rules.map((rule, index) => {
            const colors = ruleTypeColors[rule.type] || ruleTypeColors['1:1']
            const isExpanded = expanded === rule.rule_id
            const isEditing = editing === rule.rule_id
            const isEnabled = rule.is_active === 'true'
            
            return (
              <div 
                key={rule.rule_id}
                className={`
                  glass-card overflow-hidden transition-all duration-300
                  ${!isEnabled ? 'opacity-60' : ''}
                `}
                style={{ animationDelay: `${200 + index * 50}ms` }}
              >
                {/* Rule Header */}
                <div 
                  className="p-5 cursor-pointer hover:bg-white/[0.06] transition-colors"
                  onClick={() => toggleExpanded(rule.rule_id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.03]">
                        <FileCode className="w-5 h-5 text-content-secondary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-base font-semibold text-content-primary">{rule.name}</h3>
                          <span className={`badge ${colors.bg} ${colors.text} border-0`}>
                            {rule.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-content-tertiary">
                          <span>Priority: {rule.priority}</span>
                          <span className="text-content-muted">•</span>
                          <span className={isEnabled ? 'text-status-success' : 'text-content-muted'}>
                            {isEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                          {rule.criteria.target_system && (
                            <>
                              <span className="text-content-muted">•</span>
                              <span>Target: {rule.criteria.target_system}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleEnabled(rule.rule_id)
                        }}
                        className={`
                          p-2 rounded-lg transition-colors
                          ${isEnabled 
                            ? 'bg-status-success/10 text-status-success hover:bg-status-success/20' 
                            : 'bg-white/[0.03] text-content-muted hover:bg-white/[0.06]'
                          }
                        `}
                      >
                        {isEnabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(rule.rule_id)
                        }}
                        className="p-2 rounded-lg bg-white/[0.03] text-content-muted hover:bg-status-error/10 hover:text-status-error transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      <div className={`
                        p-2 rounded-lg bg-white/[0.03] text-content-muted
                        transition-transform duration-200
                        ${isExpanded ? 'rotate-180' : ''}
                      `}>
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Rule Details (Expandable) */}
                <div className={`
                  overflow-hidden transition-all duration-300
                  ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
                `}>
                  <div className="px-5 pb-5 pt-2 border-t border-white/[0.15]">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-medium text-content-secondary">
                        Rule Criteria
                      </h4>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={cancelEditing}
                            className="btn-secondary text-sm py-1.5 px-3"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSave(rule.rule_id)}
                            className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            startEditing(rule)
                          }}
                          className="btn-secondary text-sm py-1.5 px-3"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    
                    {renderCriteriaEditor(rule)}
                  </div>
                </div>
              </div>
            )
          })}
          
          {rules.length === 0 && !showCreateForm && (
            <div className="glass-card p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
                <FileCode className="w-7 h-7 text-content-muted" />
              </div>
              <p className="text-content-secondary font-medium mb-1">No rules configured</p>
              <p className="text-content-muted text-sm">Create your first matching rule above</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
