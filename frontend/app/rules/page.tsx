'use client'

import { useState } from 'react'
import { Save, Plus, Trash2 } from 'lucide-react'

export default function RulesPage() {
  const [rules, setRules] = useState([
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
  const [newRule, setNewRule] = useState<any>({
    name: '',
    type: '1:1',
    priority: 1,
    criteria: {},
    enabled: true,
  })

  const handleSave = (ruleId: string) => {
    // In a real implementation, this would save to Firestore
    console.log('Saving rule:', ruleId)
    setEditing(null)
  }

  const handleAddRule = () => {
    // In a real implementation, this would add to Firestore
    setRules([...rules, { ...newRule, id: Date.now().toString() }])
    setNewRule({ name: '', type: '1:1', priority: 1, criteria: {}, enabled: true })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Rule Editor</h1>
          <p className="text-slate-600">Create and manage matching rules for reconciliation</p>
        </div>
        <div className="bg-white rounded-xl shadow-finance p-6 mb-6 border border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Add New Rule</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Rule Name"
              className="border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={newRule.name}
              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
            />
            <select
              className="border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={newRule.type}
              onChange={(e) => setNewRule({ ...newRule, type: e.target.value })}
            >
              <option value="1:1">1:1 Match</option>
              <option value="N:1">N:1 Match</option>
              <option value="FUZZY">Fuzzy Match</option>
            </select>
            <input
              type="number"
              placeholder="Priority"
              className="border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={newRule.priority}
              onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) })}
            />
            <button
              onClick={handleAddRule}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center transition-colors font-medium"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Rule
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-finance overflow-hidden border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-lg font-semibold text-slate-900">Matching Rules</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {rules.map((rule) => (
              <div key={rule.id} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{rule.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Type: {rule.type} | Priority: {rule.priority} |{' '}
                      {rule.enabled ? (
                        <span className="text-green-600 font-medium">Enabled</span>
                      ) : (
                        <span className="text-slate-400">Disabled</span>
                      )}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    {editing === rule.id ? (
                      <button
                        onClick={() => handleSave(rule.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center transition-colors font-medium"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditing(rule.id)}
                        className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Edit
                      </button>
                    )}
                    <button className="px-4 py-2 border border-red-300 rounded-lg text-red-700 hover:bg-red-50 flex items-center transition-colors">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </button>
                  </div>
                </div>
                {editing === rule.id ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Criteria (JSON)
                      </label>
                      <textarea
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={6}
                        value={JSON.stringify(rule.criteria, null, 2)}
                        onChange={(e) => {
                          try {
                            const updatedRule = { ...rule, criteria: JSON.parse(e.target.value) }
                            setRules(rules.map((r) => (r.id === rule.id ? updatedRule : r)))
                          } catch {
                            // Invalid JSON
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <pre className="text-sm text-slate-700">{JSON.stringify(rule.criteria, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

