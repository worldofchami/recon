'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, FileText } from 'lucide-react'

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: apiClient.getDashboardSummary,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading dashboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-red-600">Error loading dashboard</div>
      </div>
    )
  }

  const matchRate = data?.total_transactions
    ? ((data.matched_count / data.total_transactions) * 100).toFixed(1)
    : '0'

  const pieData = Object.entries(data?.breaks_by_category || {}).map(([name, value]) => ({
    name,
    value,
  }))

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard Overview</h1>
          <p className="text-slate-600">Real-time reconciliation metrics and insights</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-finance p-6 border border-slate-100 hover:shadow-finance-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Total Transactions</p>
                <p className="text-3xl font-bold text-slate-900">{data?.total_transactions || 0}</p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-finance p-6 border border-slate-100 hover:shadow-finance-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Matched</p>
                <p className="text-3xl font-bold text-green-600">{data?.matched_count || 0}</p>
                <p className="text-xs text-slate-500 mt-1">{matchRate}% match rate</p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-finance p-6 border border-slate-100 hover:shadow-finance-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Unmatched</p>
                <p className="text-3xl font-bold text-red-600">{data?.unmatched_count || 0}</p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-finance p-6 border border-slate-100 hover:shadow-finance-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Break Categories</p>
                <p className="text-3xl font-bold text-slate-900">
                  {Object.keys(data?.breaks_by_category || {}).length}
                </p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-finance p-6 border border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Breaks by Category</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-finance p-6 border border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
            <div className="space-y-3">
              {data?.recent_activity?.slice(0, 5).map((activity: any) => (
                <div key={activity.transaction_uuid} className="border-b border-slate-100 pb-3 last:border-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {activity.source_system} - {activity.source_ref_id}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(activity.transaction_datetime_utc).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {activity.amount_local} {activity.currency_code_iso}
                      </p>
                      <div className="flex flex-col items-end space-y-1">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          activity.match_status === 'DIRELA_VERIFIED'
                            ? 'bg-blue-100 text-blue-800'
                            : activity.match_status === 'MATCHED_1_1'
                            ? 'bg-green-100 text-green-800'
                            : activity.match_status === 'DIRELA_REVIEW_REQUIRED'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {activity.match_status || 'UNMATCHED'}
                        </span>
                        {activity.confidence_score && (
                          <span className="text-xs text-slate-500">
                            {activity.confidence_score}% confidence
                          </span>
                        )}
                        {activity.direla_id && (
                          <span className="text-xs text-blue-600 font-mono">
                            {activity.direla_id}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

