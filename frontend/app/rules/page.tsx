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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Rule Editor</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Rule</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Rule Name"
              className="border border-gray-300 rounded-md px-3 py-2"
              value={newRule.name}
              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
            />
            <select
              className="border border-gray-300 rounded-md px-3 py-2"
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
              className="border border-gray-300 rounded-md px-3 py-2"
              value={newRule.priority}
              onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) })}
            />
            <button
              onClick={handleAddRule}
              className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 flex items-center justify-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Rule
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Matching Rules</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {rules.map((rule) => (
              <div key={rule.id} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{rule.name}</h3>
                    <p className="text-sm text-gray-500">
                      Type: {rule.type} | Priority: {rule.priority} |{' '}
                      {rule.enabled ? (
                        <span className="text-green-600">Enabled</span>
                      ) : (
                        <span className="text-gray-400">Disabled</span>
                      )}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    {editing === rule.id ? (
                      <button
                        onClick={() => handleSave(rule.id)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 flex items-center"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditing(rule.id)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                    )}
                    <button className="px-4 py-2 border border-red-300 rounded-md text-red-700 hover:bg-red-50 flex items-center">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </button>
                  </div>
                </div>
                {editing === rule.id ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Criteria (JSON)
                      </label>
                      <textarea
                        className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm"
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
                  <div className="bg-gray-50 p-4 rounded-md">
                    <pre className="text-sm">{JSON.stringify(rule.criteria, null, 2)}</pre>
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

