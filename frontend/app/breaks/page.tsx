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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Exception Resolution</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source System
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                value={filters.source_system || ''}
                onChange={(e) => setFilters({ ...filters, source_system: e.target.value || undefined })}
                placeholder="e.g., BANK_ABS"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Match Status
              </label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Break Category
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                value={filters.break_category || ''}
                onChange={(e) => setFilters({ ...filters, break_category: e.target.value || undefined })}
                placeholder="e.g., SETTLEMENT_GAP"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleSearch}
                className="w-full bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 flex items-center justify-center"
              >
                <Search className="w-4 h-4 mr-2" />
                Search
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Breaks ({data?.total || 0})
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-600">Loading breaks...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Source System
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reference ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date/Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data?.breaks?.map((break_item) => (
                      <tr key={break_item.transaction_uuid} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {break_item.source_system}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {break_item.source_ref_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(new Date(break_item.transaction_datetime_utc), 'yyyy-MM-dd HH:mm')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {break_item.amount_local} {break_item.currency_code_iso}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            break_item.match_status === 'MATCHED_1_1'
                              ? 'bg-green-100 text-green-800'
                              : break_item.match_status === 'UNMATCHED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {break_item.match_status || 'UNMATCHED'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {break_item.break_category || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {break_item.match_status === 'UNMATCHED' && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => apiClient.resolveBreak(break_item.transaction_uuid, 'MANUAL_MATCH')}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                Match
                              </button>
                              <button
                                onClick={() => apiClient.resolveBreak(break_item.transaction_uuid, 'WRITE_OFF')}
                                className="text-red-600 hover:text-red-800"
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
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {(data.page - 1) * data.page_size + 1} to{' '}
                    {Math.min(data.page * data.page_size, data.total)} of {data.total} results
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handlePageChange(data.page - 1)}
                      disabled={data.page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => handlePageChange(data.page + 1)}
                      disabled={data.page * data.page_size >= data.total}
                      className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50"
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

