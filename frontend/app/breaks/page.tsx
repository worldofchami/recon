'use client'

import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient, BreakSearchRequest, Break, BreakContext } from '@/lib/api'
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
  SlidersHorizontal,
  XCircle,
  ArrowRight,
  Info
} from 'lucide-react'

export default function BreaksPage() {
  const urlSearchParams = useSearchParams()
  const initialFilters = useMemo<BreakSearchRequest>(() => ({
    page: 1,
    page_size: 50,
    match_status: urlSearchParams.get('match_status') || undefined,
    break_category: urlSearchParams.get('break_category') || undefined,
  }), [urlSearchParams])

  const [filters, setFilters] = useState<BreakSearchRequest>(initialFilters)
  const [searchParams, setSearchParams] = useState<BreakSearchRequest>(initialFilters)
  const [showFilters, setShowFilters] = useState(true)
  const [selectedBreak, setSelectedBreak] = useState<Break | null>(null)
  const [breakContext, setBreakContext] = useState<BreakContext | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    breakItem: Break
  } | null>(null)
  const [rawModal, setRawModal] = useState<{
    open: boolean
    loading: boolean
    error: string | null
    content: string | null
    uri: string | null
    transactionId: string | null
  }>({
    open: false,
    loading: false,
    error: null,
    content: null,
    uri: null,
    transactionId: null,
  })

  const queryClient = useQueryClient()

  // Fetch break context when a break is selected
  const { data: contextData, isLoading: isContextLoading } = useQuery({
    queryKey: ['break-context', selectedBreak?.transaction_uuid],
    queryFn: () => apiClient.getBreakContext(selectedBreak!.transaction_uuid),
    enabled: !!selectedBreak,
  })

  useEffect(() => {
    if (contextData) {
      setBreakContext(contextData)
    }
  }, [contextData])

  const { data, isLoading } = useQuery({
    queryKey: ['breaks-search', searchParams],
    queryFn: () => apiClient.searchBreaks(searchParams),
  })

  const resolveMutation = useMutation({
    mutationFn: ({ uuid, resolution, candidateUuid }: { uuid: string; resolution: string; candidateUuid?: string }) => 
      apiClient.resolveBreak(uuid, resolution, candidateUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['breaks-search'] })
      queryClient.invalidateQueries({ queryKey: ['break-context', selectedBreak?.transaction_uuid] })
      // Refresh the selected break data
      if (selectedBreak) {
        setSelectedBreak(null)
        setTimeout(() => {
          setSelectedBreak({ ...selectedBreak } as Break)
        }, 100)
      }
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

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedBreak(null)
        setBreakContext(null)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  const closeModal = () => {
    setSelectedBreak(null)
    setBreakContext(null)
  }

  const closeContextMenu = () => {
    setContextMenu(null)
  }

  const openRawModalForTransaction = async (transactionUuid: string) => {
    setRawModal({
      open: true,
      loading: true,
      error: null,
      content: null,
      uri: null,
      transactionId: transactionUuid,
    })
    try {
      const raw = await apiClient.getRawTransaction(transactionUuid)
      setRawModal({
        open: true,
        loading: false,
        error: null,
        content: raw.raw_text,
        uri: raw.raw_uri,
        transactionId: transactionUuid,
      })
    } catch (err: any) {
      setRawModal({
        open: true,
        loading: false,
        error: err?.response?.data?.detail || 'Failed to load raw transaction data',
        content: null,
        uri: null,
        transactionId: transactionUuid,
      })
    }
  }

  const formatRawContent = (text: string) => {
    try {
      const parsed = JSON.parse(text)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return text
    }
  }

  const handleCopyRawUrl = async () => {
    if (!rawModal.uri) return
    try {
      await navigator.clipboard.writeText(rawModal.uri)
    } catch {
      // Silently ignore clipboard errors
    }
  }

  const handleDownloadRawJson = () => {
    if (!rawModal.content) return
    const pretty = formatRawContent(rawModal.content)
    const blob = new Blob([pretty], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const filename = `transaction-${rawModal.transactionId || 'raw'}.json`
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    setFilters(initialFilters)
    setSearchParams(initialFilters)
  }, [initialFilters])

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
                  <option value="MATCHED">Matched (all types)</option>
                  <option value="UNMATCHED">Unmatched</option>
                  <option value="MATCHED_1_1">Matched 1:1</option>
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
          <div className="px-6 py-4 border-b border-white/[0.15] flex items-center justify-between">
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
                      <tr 
                        key={break_item.transaction_uuid}
                        onClick={() => setSelectedBreak(break_item)}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            breakItem: break_item,
                          })
                        }}
                        className="cursor-pointer hover:bg-white/[0.03] transition-colors"
                      >
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
                        <td onClick={(e) => e.stopPropagation()}>
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
                <div className="px-6 py-4 border-t border-white/[0.15] flex items-center justify-between">
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

      {/* Right-click context menu for transactions */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={closeContextMenu}
        >
          <div
            className="absolute min-w-[180px] rounded-lg bg-surface-elevated border border-white/10 shadow-xl py-1 text-sm"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full text-left px-3 py-2 hover:bg-white/[0.06] text-content-primary flex items-center gap-2"
              onClick={() => {
                openRawModalForTransaction(contextMenu.breakItem.transaction_uuid)
                closeContextMenu()
              }}
            >
              View raw transaction
            </button>
          </div>
        </div>
      )}

      {/* Raw transaction modal */}
      {rawModal.open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          onClick={() =>
            setRawModal({
              open: false,
              loading: false,
              error: null,
              content: null,
              uri: null,
              transactionId: null,
            })
          }
        >
          <div
            className="glass-card max-w-4xl w-full max-h-[90vh] overflow-hidden rounded-2xl border border-white/[0.2] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.15]">
              <div>
                <h2 className="text-base font-semibold text-content-primary">
                  Raw Transaction Data
                </h2>
                {rawModal.uri && (
                  <p className="text-[11px] text-content-muted truncate max-w-[32rem]">
                    Source: {rawModal.uri}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {rawModal.uri && (
                  <button
                    type="button"
                    onClick={handleCopyRawUrl}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    Copy URL
                  </button>
                )}
                {rawModal.content && (
                  <button
                    type="button"
                    onClick={handleDownloadRawJson}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    Download JSON
                  </button>
                )}
                <button
                  className="btn-secondary p-2 hover:bg-white/[0.1] transition-colors"
                  onClick={() =>
                    setRawModal({
                      open: false,
                      loading: false,
                      error: null,
                      content: null,
                      uri: null,
                      transactionId: null,
                    })
                  }
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto bg-black/40">
              {rawModal.loading && (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="w-7 h-7 border-2 border-accent-emerald/20 border-t-accent-emerald rounded-full animate-spin mb-3" />
                  <p className="text-xs text-content-tertiary">Loading raw data...</p>
                </div>
              )}
              {!rawModal.loading && rawModal.error && (
                <p className="text-xs text-status-error font-mono whitespace-pre-wrap">
                  {rawModal.error}
                </p>
              )}
              {!rawModal.loading && !rawModal.error && rawModal.content && (
                <pre className="text-xs text-content-primary font-mono whitespace-pre-wrap">
                  {formatRawContent(rawModal.content)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Break Details Modal */}
      {selectedBreak && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          onClick={closeModal}
        >
          <div 
            className="glass-card max-w-6xl w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.2] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 px-6 py-4 border-b border-white/[0.2] bg-surface-primary/95 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-rose/10">
                  <AlertTriangle className="w-5 h-5 text-accent-rose" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-content-primary">
                    Break Details
                  </h2>
                  <p className="text-xs text-content-muted">
                    Transaction UUID: {selectedBreak.transaction_uuid.slice(0, 8)}...
                  </p>
                  <button
                    type="button"
                    onClick={() => openRawModalForTransaction(selectedBreak.transaction_uuid)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-[11px] text-content-secondary border border-white/[0.12]"
                  >
                    View raw transaction
                  </button>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="btn-secondary p-2 hover:bg-white/[0.1] transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-content-secondary uppercase tracking-wider mb-4">
                    Basic Information
                  </h3>
                  
                  <div>
                    <label className="text-xs font-medium text-content-secondary mb-1 block">
                      Source System
                    </label>
                    <p className="text-content-primary font-medium">
                      {selectedBreak.source_system}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-content-secondary mb-1 block">
                      Reference ID
                    </label>
                    <p className="text-content-primary font-mono text-sm">
                      {selectedBreak.source_ref_id}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-content-secondary mb-1 block">
                      Transaction Date/Time
                    </label>
                    <p className="text-content-primary">
                      {format(new Date(selectedBreak.transaction_datetime_utc), 'MMM d, yyyy HH:mm:ss')} UTC
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-content-secondary mb-1 block">
                      Amount
                    </label>
                    <p className="text-content-primary font-semibold text-lg tabular-nums">
                      {Number(selectedBreak.amount_local).toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                      <span className="text-content-muted text-sm font-normal">
                        {selectedBreak.currency_code_iso}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Status & Matching */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-content-secondary uppercase tracking-wider mb-4">
                    Status & Matching
                  </h3>
                  
                  <div>
                    <label className="text-xs font-medium text-content-secondary mb-1 block">
                      Match Status
                    </label>
                    <span className={`
                      badge inline-block
                      ${selectedBreak.match_status === 'MATCHED_1_1' ? 'badge-success' : ''}
                      ${selectedBreak.match_status === 'UNMATCHED' || !selectedBreak.match_status ? 'badge-error' : ''}
                      ${selectedBreak.match_status === 'BREAK_TIMING' || selectedBreak.match_status === 'MANUAL_ADJ' ? 'badge-warning' : ''}
                    `}>
                      {(selectedBreak.match_status || 'UNMATCHED').replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-content-secondary mb-1 block">
                      Break Category
                    </label>
                    <p className="text-content-primary">
                      {selectedBreak.break_category?.replace(/_/g, ' ') || '—'}
                    </p>
                  </div>

                  {selectedBreak.direla_id && (
                    <div>
                      <label className="text-xs font-medium text-content-secondary mb-1 block">
                        Direla ID
                      </label>
                      <p className="text-content-primary font-mono text-sm">
                        {selectedBreak.direla_id}
                      </p>
                    </div>
                  )}

                  {selectedBreak.confidence_score !== undefined && (
                    <div>
                      <label className="text-xs font-medium text-content-secondary mb-1 block">
                        Confidence Score
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-accent-emerald transition-all"
                            style={{ width: `${selectedBreak.confidence_score || 0}%` }}
                          />
                        </div>
                        <span className="text-content-primary text-sm font-medium tabular-nums">
                          {selectedBreak.confidence_score || 0}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Additional Details */}
                {(selectedBreak.party_type || selectedBreak.phone_number || selectedBreak.product_type) && (
                  <div className="space-y-4 md:col-span-2">
                    <h3 className="text-sm font-semibold text-content-secondary uppercase tracking-wider mb-4">
                      Additional Details
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {selectedBreak.party_type && (
                        <div>
                          <label className="text-xs font-medium text-content-secondary mb-1 block">
                            Party Type
                          </label>
                          <p className="text-content-primary">
                            {selectedBreak.party_type}
                          </p>
                        </div>
                      )}

                      {selectedBreak.phone_number && (
                        <div>
                          <label className="text-xs font-medium text-content-secondary mb-1 block">
                            Phone Number
                          </label>
                          <p className="text-content-primary font-mono text-sm">
                            {selectedBreak.phone_number}
                          </p>
                        </div>
                      )}

                      {selectedBreak.product_type && (
                        <div>
                          <label className="text-xs font-medium text-content-secondary mb-1 block">
                            Product Type
                          </label>
                          <p className="text-content-primary">
                            {selectedBreak.product_type}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Financial Details */}
                {(selectedBreak.commission_amount !== undefined || selectedBreak.merchant_payout !== undefined) && (
                  <div className="space-y-4 md:col-span-2">
                    <h3 className="text-sm font-semibold text-content-secondary uppercase tracking-wider mb-4">
                      Financial Details
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedBreak.commission_amount !== undefined && (
                        <div>
                          <label className="text-xs font-medium text-content-secondary mb-1 block">
                            Commission Amount
                          </label>
                          <p className="text-content-primary font-semibold tabular-nums">
                            {Number(selectedBreak.commission_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                            <span className="text-content-muted text-sm font-normal">
                              {selectedBreak.currency_code_iso}
                            </span>
                          </p>
                        </div>
                      )}

                      {selectedBreak.merchant_payout !== undefined && (
                        <div>
                          <label className="text-xs font-medium text-content-secondary mb-1 block">
                            Merchant Payout
                          </label>
                          <p className="text-content-primary font-semibold tabular-nums">
                            {Number(selectedBreak.merchant_payout).toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                            <span className="text-content-muted text-sm font-normal">
                              {selectedBreak.currency_code_iso}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Break Reason & Context */}
                {selectedBreak.break_category && (
                  <div className="md:col-span-2 mt-6">
                    <div className="glass-card bg-accent-rose/10 border-accent-rose/30 p-4 rounded-xl">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent-rose/10">
                          <Info className="w-4 h-4 text-accent-rose" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-content-primary mb-1">
                            Why This Transaction Broke
                          </h4>
                          <p className="text-sm text-content-secondary mb-2">
                            {selectedBreak.break_category.replace(/_/g, ' ')}
                          </p>
                          
                          {selectedBreak.break_metadata?.failure_reasons && selectedBreak.break_metadata.failure_reasons.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs font-medium text-content-tertiary mb-2">Attempted Matching:</p>
                              <ul className="space-y-1">
                                {selectedBreak.break_metadata.failure_reasons.map((reason, idx) => (
                                  <li key={idx} className="text-xs text-white flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent-rose/40"></span>
                                    {reason.replace(/_/g, ' ').toLowerCase()}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {selectedBreak.break_metadata?.rules_attempted && selectedBreak.break_metadata.rules_attempted.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs font-medium text-content-tertiary mb-2">Rules Tested:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {selectedBreak.break_metadata.rules_attempted.map((rule, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white/[0.08] border border-white/[0.15] rounded">
                                    {rule.name} <span className="text-content-muted">({rule.type})</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Transaction Comparison - Show candidates that were close but didn't match */}
                {selectedBreak.break_metadata?.candidates && selectedBreak.break_metadata.candidates.length > 0 && (
                  <div className="md:col-span-2 mt-6">
                    <h3 className="text-sm font-semibold text-content-secondary uppercase tracking-wider mb-4">
                      Potential Matches Found (But Not Matched)
                    </h3>
                    <div className="overflow-hidden rounded-xl border border-white/[0.12] bg-white/[0.02]">
                      <table className="min-w-full text-xs">
                        <thead className="bg-white/[0.03] text-left uppercase tracking-wide text-content-tertiary">
                          <tr>
                            <th className="px-3 py-2 font-medium">Source</th>
                            <th className="px-3 py-2 font-medium">Reference ID</th>
                            <th className="px-3 py-2 font-medium">Amount</th>
                            <th className="px-3 py-2 font-medium">Date/Time</th>
                            <th className="px-3 py-2 font-medium">Similarity</th>
                            <th className="px-3 py-2 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBreak.break_metadata.candidates.map((candidate, idx) => (
                            <tr
                              key={idx}
                              className="border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                            >
                              <td className="px-3 py-2 text-content-primary">
                                {candidate.source_system}
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] text-content-secondary">
                                {candidate.source_ref_id}
                              </td>
                              <td className="px-3 py-2 text-content-primary">
                                <span className="font-semibold tabular-nums">
                                  {Number(candidate.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>{' '}
                                <span className="text-content-muted">
                                  {candidate.currency}
                                </span>
                                {Math.abs(Number(candidate.amount) - Number(selectedBreak.amount_local)) > 0.01 && (
                                  <span className="ml-2 text-[11px] text-accent-amber">
                                    Δ {(Number(candidate.amount) - Number(selectedBreak.amount_local)).toFixed(2)}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-content-secondary">
                                {format(new Date(candidate.datetime), 'MMM d, HH:mm')}
                              </td>
                              <td className="px-3 py-2 text-content-secondary">
                                {candidate.similarity_score !== undefined ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-accent-amber"
                                        style={{ width: `${candidate.similarity_score}%` }}
                                      />
                                    </div>
                                    <span className="tabular-nums">
                                      {candidate.similarity_score}%
                                    </span>
                                  </div>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {candidate.transaction_uuid && (
                                    <>
                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-status-success/10 text-status-success border border-status-success/20 hover:bg-status-success/20 text-[11px] font-medium transition-colors disabled:opacity-50"
                                        onClick={() => {
                                          if (candidate.transaction_uuid) {
                                            resolveMutation.mutate({
                                              uuid: selectedBreak.transaction_uuid,
                                              resolution: 'MANUAL_MATCH',
                                              candidateUuid: candidate.transaction_uuid,
                                            })
                                          }
                                        }}
                                        disabled={resolveMutation.isPending}
                                      >
                                        <Check className="w-3 h-3" />
                                        Match
                                      </button>
                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-content-secondary border border-white/[0.12]"
                                        onClick={() => openRawModalForTransaction(candidate.transaction_uuid!)}
                                      >
                                        View raw
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-content-muted mt-3 italic">
                      These transactions were found during matching but did not meet all criteria to be considered a match.
                    </p>
                  </div>
                )}

                {/* Show Matched Peers if this transaction is part of a match */}
                {breakContext && breakContext.match_peers && breakContext.match_peers.length > 0 && (
                  <div className="md:col-span-2 mt-6">
                    <h3 className="text-sm font-semibold text-content-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Check className="w-4 h-4 text-accent-emerald" />
                      Matched Transactions
                    </h3>
                    <div className="space-y-3">
                      {breakContext.match_peers.map((peer, idx) => (
                        <div key={idx} className="glass-card bg-accent-emerald/10 border-accent-emerald/30 p-4 rounded-xl">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <label className="text-xs font-medium text-content-secondary mb-1 block">
                                Source System
                              </label>
                              <p className="text-sm text-content-primary font-medium">
                                {peer.source_system}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-content-secondary mb-1 block">
                                Reference ID
                              </label>
                              <p className="text-xs font-mono text-content-secondary">
                                {peer.source_ref_id}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-content-secondary mb-1 block">
                                Amount
                              </label>
                              <p className="text-sm font-semibold text-content-primary tabular-nums">
                                {Number(peer.amount_local).toLocaleString(undefined, { minimumFractionDigits: 2 })} {peer.currency_code_iso}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-content-secondary mb-1 block">
                                Date/Time
                              </label>
                              <p className="text-xs text-content-secondary">
                                {format(new Date(peer.transaction_datetime_utc), 'MMM d, HH:mm')}
                              </p>
                            </div>
                            <div className="md:col-span-4 flex justify-end">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-content-secondary border border-white/[0.12]"
                                onClick={() => openRawModalForTransaction(peer.transaction_uuid)}
                              >
                                View raw transaction
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transaction UUID */}
                <div className="md:col-span-2 pt-4 border-t border-white/[0.15]">
                  <label className="text-xs font-medium text-content-secondary mb-1 block">
                    Full Transaction UUID
                  </label>
                  <p className="text-content-primary font-mono text-xs break-all">
                    {selectedBreak.transaction_uuid}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            {selectedBreak.match_status === 'UNMATCHED' && (
              <div className="sticky bottom-0 px-6 py-4 border-t border-white/[0.2] bg-surface-primary/95 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    resolveMutation.mutate({ 
                      uuid: selectedBreak.transaction_uuid, 
                      resolution: 'WRITE_OFF' 
                    })
                    closeModal()
                  }}
                  disabled={resolveMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-status-error/10 text-status-error border border-status-error/20 hover:bg-status-error/20 transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Write Off
                </button>
                <button
                  onClick={() => {
                    resolveMutation.mutate({ 
                      uuid: selectedBreak.transaction_uuid, 
                      resolution: 'MANUAL_MATCH' 
                    })
                    closeModal()
                  }}
                  disabled={resolveMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-status-success/10 text-status-success border border-status-success/20 hover:bg-status-success/20 transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Match
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
