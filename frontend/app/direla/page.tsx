'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import { Plus, Users, Clock, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react'

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

  // Get SA rules
  const { data: saRules } = useQuery({
    queryKey: ['sa-rules'],
    queryFn: apiClient.getSouthAfricanRules,
  })

  // Create Direla ID mutation
  const createDirelaIdMutation = useMutation({
    mutationFn: apiClient.createDirelaId,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setShowCreateForm(false)
      setNewTransaction({
        source_system: '',
        amount_local: '',
        source_ref_id: '',
        party_type: 'MERCHANT',
        phone_number: '',
        product_type: ''
      })
    },
  })

  const handleCreateDirelaId = () => {
    createDirelaIdMutation.mutate({
      ...newTransaction,
      amount_local: parseFloat(newTransaction.amount_local),
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Direla Multi-Party Reconciliation</h1>
          <p className="text-slate-600">Manage real-time multi-party transaction matching for South African payment flows</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-finance p-6 border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Active Direla IDs</p>
                <p className="text-3xl font-bold text-blue-600">24</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-finance p-6 border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Average Confidence</p>
                <p className="text-3xl font-bold text-green-600">94.2%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-finance p-6 border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Auto-Settled</p>
                <p className="text-3xl font-bold text-green-600">18</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-finance p-6 border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Manual Review</p>
                <p className="text-3xl font-bold text-yellow-600">6</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* South African Rules */}
        <div className="bg-white rounded-xl shadow-finance mb-6 p-6 border border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Pre-configured SA Matching Rules</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {saRules && Object.entries(saRules).map(([key, rule]: [string, any]) => (
              <div key={key} className="border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 mb-2">{rule.name}</h3>
                <div className="space-y-1 text-sm text-slate-600">
                  <div>Type: <span className="font-medium">{rule.type}</span></div>
                  <div>Parties: <span className="font-medium">{rule.min_parties}-{rule.max_parties}</span></div>
                  <div>Time Window: <span className="font-medium">{rule.criteria.time_window_minutes}min</span></div>
                  <div>Min Confidence: <span className="font-medium">{rule.criteria.min_confidence}%</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create New Transaction Flow */}
        <div className="bg-white rounded-xl shadow-finance p-6 border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Create New Multi-Party Transaction</h2>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Direla ID
            </button>
          </div>

          {showCreateForm && (
            <div className="border-t border-slate-200 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Source System
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newTransaction.source_system}
                    onChange={(e) => setNewTransaction({ ...newTransaction, source_system: e.target.value })}
                    placeholder="e.g., Lesaka_POS"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Amount (ZAR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newTransaction.amount_local}
                    onChange={(e) => setNewTransaction({ ...newTransaction, amount_local: e.target.value })}
                    placeholder="100.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Reference ID
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newTransaction.source_ref_id}
                    onChange={(e) => setNewTransaction({ ...newTransaction, source_ref_id: e.target.value })}
                    placeholder="TX-12345"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Party Type
                  </label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newTransaction.phone_number}
                    onChange={(e) => setNewTransaction({ ...newTransaction, phone_number: e.target.value })}
                    placeholder="082-712-3456"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Product Type
                  </label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDirelaId}
                  disabled={createDirelaIdMutation.isPending}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {createDirelaIdMutation.isPending ? 'Creating...' : 'Create Universal ID'}
                </button>
              </div>

              {createDirelaIdMutation.isSuccess && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium">
                    ✅ Direla ID created: {createDirelaIdMutation.data?.direla_id}
                  </p>
                  <p className="text-green-600 text-sm mt-1">
                    All parties can now use this ID to link their transaction records.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}