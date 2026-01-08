'use client'

import { useState } from 'react'
import { Save, Plus, Trash2, FileCode, Power, PowerOff, ChevronDown, ChevronUp } from 'lucide-react'

interface Rule {
  id: string
  name: string
  type: string
  priority: number
  criteria: Record<string, any>
  enabled: boolean
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([
    {
      id: '1',
      name: '1:1 Bank Match',
      type: '1:1',
      priority: 1,
      criteria: {
        target_system: 'BANK_ABS',
        time_window_minutes: 60,
        amount_tolerance: 0.01,
      },
      enabled: true,
    },
  ])

  const [editing, setEditing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>('1')
  const [newRule, setNewRule] = useState<Omit<Rule, 'id'>>({
    name: '',
    type: '1:1',
    priority: 1,
    criteria: {},
    enabled: true,
  })

  const handleSave = (ruleId: string) => {
    console.log('Saving rule:', ruleId)
    setEditing(null)
  }

  const handleAddRule = () => {
    if (!newRule.name.trim()) return
    
    const newId = Date.now().toString()
    setRules([...rules, { ...newRule, id: newId }])
    setNewRule({ name: '', type: '1:1', priority: 1, criteria: {}, enabled: true })
    setExpanded(newId)
  }

  const handleDelete = (ruleId: string) => {
    setRules(rules.filter(r => r.id !== ruleId))
  }

  const toggleEnabled = (ruleId: string) => {
    setRules(rules.map(r => 
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    ))
  }

  const toggleExpanded = (ruleId: string) => {
    setExpanded(expanded === ruleId ? null : ruleId)
  }

  const ruleTypeColors: Record<string, { bg: string; text: string }> = {
    '1:1': { bg: 'bg-accent-emerald/10', text: 'text-accent-emerald' },
    'N:1': { bg: 'bg-accent-sky/10', text: 'text-accent-sky' },
    'FUZZY': { bg: 'bg-accent-violet/10', text: 'text-accent-violet' },
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 opacity-0 animate-fade-in-up">
          <h1 className="text-3xl font-bold tracking-tight text-content-primary mb-2">
            Rule Editor
          </h1>
          <p className="text-content-secondary">
            Create and manage matching rules for reconciliation
          </p>
        </div>

        {/* Add New Rule */}
        <div className="glass-card p-6 mb-6 opacity-0 animate-fade-in-up delay-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent-amber/10">
              <Plus className="w-4 h-4 text-accent-amber" />
            </div>
            <h2 className="text-base font-semibold text-content-primary">Create New Rule</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <input
                type="text"
                placeholder="Rule name..."
                className="input-field w-full"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleAddRule()}
              />
            </div>
            <div className="md:col-span-3">
              <select
                className="select-field w-full"
                value={newRule.type}
                onChange={(e) => setNewRule({ ...newRule, type: e.target.value })}
              >
                <option value="1:1">1:1 Match</option>
                <option value="N:1">N:1 Match</option>
                <option value="FUZZY">Fuzzy Match</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <input
                type="number"
                placeholder="Priority"
                className="input-field w-full"
                value={newRule.priority}
                onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="md:col-span-2">
              <button
                onClick={handleAddRule}
                disabled={!newRule.name.trim()}
                className="btn-primary w-full h-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Rules List */}
        <div className="space-y-3 opacity-0 animate-fade-in-up delay-200">
          {rules.map((rule, index) => {
            const colors = ruleTypeColors[rule.type] || ruleTypeColors['1:1']
            const isExpanded = expanded === rule.id
            const isEditing = editing === rule.id
            
            return (
              <div 
                key={rule.id}
                className={`
                  glass-card overflow-hidden transition-all duration-300
                  ${!rule.enabled ? 'opacity-60' : ''}
                `}
                style={{ animationDelay: `${200 + index * 50}ms` }}
              >
                {/* Rule Header */}
                <div 
                  className="p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => toggleExpanded(rule.id)}
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
                          <span className={rule.enabled ? 'text-status-success' : 'text-content-muted'}>
                            {rule.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleEnabled(rule.id)
                        }}
                        className={`
                          p-2 rounded-lg transition-colors
                          ${rule.enabled 
                            ? 'bg-status-success/10 text-status-success hover:bg-status-success/20' 
                            : 'bg-white/[0.03] text-content-muted hover:bg-white/[0.06]'
                          }
                        `}
                      >
                        {rule.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(rule.id)
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
                  ${isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}
                `}>
                  <div className="px-5 pb-5 pt-2 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-medium text-content-secondary">
                        Rule Criteria
                      </h4>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditing(null)}
                            className="btn-secondary text-sm py-1.5 px-3"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSave(rule.id)}
                            className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditing(rule.id)}
                          className="btn-secondary text-sm py-1.5 px-3"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    
                    {isEditing ? (
                      <textarea
                        className="input-field w-full font-mono text-sm resize-none"
                        rows={8}
                        value={JSON.stringify(rule.criteria, null, 2)}
                        onChange={(e) => {
                          try {
                            const updatedRule = { ...rule, criteria: JSON.parse(e.target.value) }
                            setRules(rules.map((r) => (r.id === rule.id ? updatedRule : r)))
                          } catch {
                            // Invalid JSON - keep as is
                          }
                        }}
                        spellCheck={false}
                      />
                    ) : (
                      <div className="bg-surface-secondary/50 rounded-xl p-4 border border-white/[0.04]">
                        <pre className="text-sm text-content-secondary font-mono">
                          {JSON.stringify(rule.criteria, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          
          {rules.length === 0 && (
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
