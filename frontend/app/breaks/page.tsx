'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient, BreakSearchRequest } from '@/lib/api'
import { format } from 'date-fns'
import { 
  Search, 
  Filter, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  MoreHorizontal,
  SlidersHorizontal
} from 'lucide-react'

export default function BreaksPage() {
  const [filters, setFilters] = useState<BreakSearchRequest>({
    page: 1,
    page_size: 50,
  })
  const [searchParams, setSearchParams] = useState<BreakSearchRequest>(filters)
  const [showFilters, setShowFilters] = useState(true)

  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['breaks-search', searchParams],
    queryFn: () => apiClient.searchBreaks(searchParams),
  })

  const resolveMutation = useMutation({
    mutationFn: ({ uuid, resolution }: { uuid: string; resolution: string }) => 
      apiClient.resolveBreak(uuid, resolution),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['breaks-search'] })
    },
  })

  const handleSearch = () => {
    setSearchParams({ ...filters, page: 1 })
  }

  const handlePageChange = (newPage: number) => {
    setSearchParams({ ...searchParams, page: newPage })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 opacity-0 animate-fade-in-up">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-content-primary mb-2">
              Exception Resolution
            </h1>
            <p className="text-content-secondary">
              Search, investigate, and resolve reconciliation breaks
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 ${showFilters ? 'bg-white/[0.08]' : ''}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="glass-card p-6 mb-6 opacity-0 animate-fade-in-down delay-100">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-2">
                  Source System
                </label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={filters.source_system || ''}
                  onChange={(e) => setFilters({ ...filters, source_system: e.target.value || undefined })}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., BANK_ABS"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-2">
                  Match Status
                </label>
                <select
                  className="select-field w-full"
                  value={filters.match_status || ''}
                  onChange={(e) => setFilters({ ...filters, match_status: e.target.value || undefined })}
                >
                  <option value="">All Statuses</option>
                  <option value="UNMATCHED">Unmatched</option>
                  <option value="MATCHED_1_1">Matched</option>
                  <option value="BREAK_TIMING">Break Timing</option>
                  <option value="MANUAL_ADJ">Manual Adjustment</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-2">
                  Break Category
                </label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={filters.break_category || ''}
                  onChange={(e) => setFilters({ ...filters, break_category: e.target.value || undefined })}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., SETTLEMENT_GAP"
                />
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={handleSearch}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  Search
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results Table */}
        <div className="glass-card overflow-hidden opacity-0 animate-fade-in-up delay-200">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent-rose/10">
                <AlertTriangle className="w-4 h-4 text-accent-rose" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-content-primary">
                  Breaks
                </h2>
                <p className="text-xs text-content-muted">
                  {data?.total || 0} total records
                </p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12">
              <div className="flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-2 border-accent-emerald/20 border-t-accent-emerald rounded-full animate-spin mb-4" />
                <p className="text-content-tertiary text-sm">Loading breaks...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Source System</th>
                      <th>Reference ID</th>
                      <th>Date/Time</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Category</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.breaks?.map((break_item) => (
                      <tr key={break_item.transaction_uuid}>
                        <td>
                          <span className="font-medium text-content-primary">
                            {break_item.source_system}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono text-xs text-content-secondary">
                            {break_item.source_ref_id}
                          </span>
                        </td>
                        <td>
                          <span className="text-content-secondary">
                            {format(new Date(break_item.transaction_datetime_utc), 'MMM d, yyyy HH:mm')}
                          </span>
                        </td>
                        <td>
                          <span className="font-semibold text-content-primary tabular-nums">
                            {Number(break_item.amount_local).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-content-muted ml-1 text-xs">
                            {break_item.currency_code_iso}
                          </span>
                        </td>
                        <td>
                          <span className={`
                            badge
                            ${break_item.match_status === 'MATCHED_1_1' ? 'badge-success' : ''}
                            ${break_item.match_status === 'UNMATCHED' || !break_item.match_status ? 'badge-error' : ''}
                            ${break_item.match_status === 'BREAK_TIMING' || break_item.match_status === 'MANUAL_ADJ' ? 'badge-warning' : ''}
                          `}>
                            {(break_item.match_status || 'UNMATCHED').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          <span className="text-content-tertiary text-sm">
                            {break_item.break_category?.replace(/_/g, ' ') || '—'}
                          </span>
                        </td>
                        <td>
                          {break_item.match_status === 'UNMATCHED' && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => resolveMutation.mutate({ 
                                  uuid: break_item.transaction_uuid, 
                                  resolution: 'MANUAL_MATCH' 
                                })}
                                disabled={resolveMutation.isPending}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-status-success/10 text-status-success border border-status-success/20 hover:bg-status-success/20 transition-colors disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Match
                              </button>
                              <button
                                onClick={() => resolveMutation.mutate({ 
                                  uuid: break_item.transaction_uuid, 
                                  resolution: 'WRITE_OFF' 
                                })}
                                disabled={resolveMutation.isPending}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-status-error/10 text-status-error border border-status-error/20 hover:bg-status-error/20 transition-colors disabled:opacity-50"
                              >
                                <X className="w-3.5 h-3.5" />
                                Write Off
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    
                    {(!data?.breaks || data.breaks.length === 0) && (
                      <tr>
                        <td colSpan={7} className="text-center py-12">
                          <div className="flex flex-col items-center">
                            <div className="w-12 h-12 rounded-xl bg-white/[0.03] flex items-center justify-center mb-3">
                              <Search className="w-5 h-5 text-content-muted" />
                            </div>
                            <p className="text-content-secondary font-medium mb-1">No breaks found</p>
                            <p className="text-content-muted text-sm">Try adjusting your search filters</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data && data.total > 0 && (
                <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between">
                  <div className="text-sm text-content-tertiary">
                    Showing{' '}
                    <span className="font-medium text-content-secondary">
                      {(data.page - 1) * data.page_size + 1}
                    </span>
                    {' '}to{' '}
                    <span className="font-medium text-content-secondary">
                      {Math.min(data.page * data.page_size, data.total)}
                    </span>
                    {' '}of{' '}
                    <span className="font-medium text-content-secondary">{data.total}</span>
                    {' '}results
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(data.page - 1)}
                      disabled={data.page === 1}
                      className="btn-secondary p-2 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {[...Array(Math.min(5, Math.ceil(data.total / data.page_size)))].map((_, i) => {
                        const pageNum = i + 1
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`
                              w-8 h-8 rounded-lg text-sm font-medium transition-colors
                              ${data.page === pageNum 
                                ? 'bg-accent-emerald/20 text-accent-emerald' 
                                : 'text-content-secondary hover:bg-white/[0.05]'
                              }
                            `}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(data.page + 1)}
                      disabled={data.page * data.page_size >= data.total}
                      className="btn-secondary p-2 disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
