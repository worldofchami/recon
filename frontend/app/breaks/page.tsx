'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient, BreakSearchRequest } from '@/lib/api'
import { format } from 'date-fns'
import { Search, Filter, AlertCircle } from 'lucide-react'

export default function BreaksPage() {
  const [filters, setFilters] = useState<BreakSearchRequest>({
    page: 1,
    page_size: 50,
  })
  const [searchParams, setSearchParams] = useState<BreakSearchRequest>(filters)

  const { data, isLoading } = useQuery({
    queryKey: ['breaks-search', searchParams],
    queryFn: () => apiClient.searchBreaks(searchParams),
  })

  const handleSearch = () => {
    setSearchParams({ ...filters, page: 1 })
  }

  const handlePageChange = (newPage: number) => {
    setSearchParams({ ...searchParams, page: newPage })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Exception Resolution</h1>
          <p className="text-slate-600">Search, investigate, and resolve reconciliation breaks</p>
        </div>
        <div className="bg-white rounded-xl shadow-finance mb-6 p-6 border border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Search Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Source System
              </label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={filters.source_system || ''}
                onChange={(e) => setFilters({ ...filters, source_system: e.target.value || undefined })}
                placeholder="e.g., BANK_ABS"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Match Status
              </label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={filters.match_status || ''}
                onChange={(e) => setFilters({ ...filters, match_status: e.target.value || undefined })}
              >
                <option value="">All</option>
                <option value="UNMATCHED">Unmatched</option>
                <option value="MATCHED_1_1">Matched</option>
                <option value="BREAK_TIMING">Break Timing</option>
                <option value="MANUAL_ADJ">Manual Adjustment</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Break Category
              </label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={filters.break_category || ''}
                onChange={(e) => setFilters({ ...filters, break_category: e.target.value || undefined })}
                placeholder="e.g., SETTLEMENT_GAP"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleSearch}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center transition-colors font-medium"
              >
                <Search className="w-4 h-4 mr-2" />
                Search
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-finance overflow-hidden border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-lg font-semibold text-slate-900">
              Breaks ({data?.total || 0})
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-slate-600">Loading breaks...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Source System
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Reference ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Date/Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {data?.breaks?.map((break_item) => (
                      <tr key={break_item.transaction_uuid} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                          {break_item.source_system}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                          {break_item.source_ref_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {format(new Date(break_item.transaction_datetime_utc), 'yyyy-MM-dd HH:mm')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                          {break_item.amount_local} {break_item.currency_code_iso}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                            break_item.match_status === 'MATCHED_1_1'
                              ? 'bg-green-100 text-green-800'
                              : break_item.match_status === 'UNMATCHED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {break_item.match_status || 'UNMATCHED'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {break_item.break_category || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {break_item.match_status === 'UNMATCHED' && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => apiClient.resolveBreak(break_item.transaction_uuid, 'MANUAL_MATCH')}
                                className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                              >
                                Match
                              </button>
                              <button
                                onClick={() => apiClient.resolveBreak(break_item.transaction_uuid, 'WRITE_OFF')}
                                className="text-red-600 hover:text-red-800 font-medium transition-colors"
                              >
                                Write Off
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {data && data.total > 0 && (
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="text-sm text-slate-700">
                    Showing {(data.page - 1) * data.page_size + 1} to{' '}
                    {Math.min(data.page * data.page_size, data.total)} of {data.total} results
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handlePageChange(data.page - 1)}
                      disabled={data.page === 1}
                      className="px-4 py-2 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => handlePageChange(data.page + 1)}
                      disabled={data.page * data.page_size >= data.total}
                      className="px-4 py-2 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

