'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import { Save, Plus, Database, Code2, Check, Loader2 } from 'lucide-react'

export default function ConfigPage() {
  const [selectedSource, setSelectedSource] = useState<string>('')
  const [config, setConfig] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const { data: sources = [], isLoading: isLoadingSources } = useQuery({
    queryKey: ['sources'],
    queryFn: () => apiClient.getAllSources(),
  })

  const { data: mappingConfig, isLoading } = useQuery({
    queryKey: ['mapping-config', selectedSource],
    queryFn: () => apiClient.getMappingConfig(selectedSource),
    enabled: !!selectedSource && !editing,
  })

  const saveMutation = useMutation({
    mutationFn: (config: any) => apiClient.saveMappingConfig(selectedSource, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mapping-config', selectedSource] })
      setEditing(false)
      setJsonError(null)
    },
  })

  const handleSave = () => {
    if (config) {
      saveMutation.mutate(config)
    }
  }

  const handleSourceSelect = (sourceId: string) => {
    setSelectedSource(sourceId)
    setEditing(false)
    setJsonError(null)
  }

  const handleJsonChange = (value: string) => {
    try {
      const parsed = JSON.parse(value)
      setConfig(parsed)
      setJsonError(null)
    } catch (e) {
      setJsonError('Invalid JSON syntax')
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 opacity-0 animate-fade-in-up">
          <h1 className="text-3xl font-bold tracking-tight text-content-primary mb-2">
            Configuration
          </h1>
          <p className="text-content-secondary">
            Manage field mappings and transformations for source systems
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Source Systems Sidebar */}
          <div className="lg:col-span-3">
            <div className="glass-card p-5 opacity-0 animate-fade-in-up delay-100">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent-violet/10">
                  <Database className="w-4 h-4 text-accent-violet" />
                </div>
                <h2 className="text-base font-semibold text-content-primary">Sources</h2>
              </div>
              
              {isLoadingSources ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="skeleton h-10 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {sources.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-content-tertiary text-sm">No sources configured</p>
                    </div>
                  ) : (
                    sources.map((source) => (
                      <button
                        key={source}
                        onClick={() => handleSourceSelect(source)}
                        className={`
                          w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium
                          transition-all duration-200
                          ${selectedSource === source
                            ? 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20'
                            : 'text-content-secondary hover:bg-white/[0.04] border border-transparent hover:text-content-primary'
                          }
                        `}
                      >
                        <div className="flex items-center gap-2">
                          {selectedSource === source && (
                            <div className="w-1.5 h-1.5 rounded-full bg-accent-emerald" />
                          )}
                          {source}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
              
              <button className="mt-4 w-full btn-secondary flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                Add Source
              </button>
            </div>
          </div>

          {/* Configuration Editor */}
          <div className="lg:col-span-9">
            <div className="glass-card p-6 opacity-0 animate-fade-in-up delay-200">
              {!selectedSource ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                    <Code2 className="w-7 h-7 text-content-muted" />
                  </div>
                  <p className="text-content-secondary font-medium mb-1">No source selected</p>
                  <p className="text-content-muted text-sm">Select a source system to view its configuration</p>
                </div>
              ) : isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-accent-emerald animate-spin mb-4" />
                  <p className="text-content-tertiary text-sm">Loading configuration...</p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/[0.15]">
                    <div>
                      <h2 className="text-lg font-semibold text-content-primary mb-1">
                        {selectedSource}
                      </h2>
                      <p className="text-sm text-content-tertiary">
                        Field mapping and transformation rules
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {editing ? (
                        <>
                          <button
                            onClick={() => {
                              setEditing(false)
                              setJsonError(null)
                            }}
                            className="btn-secondary"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSave}
                            disabled={saveMutation.isPending || !!jsonError}
                            className="btn-primary flex items-center gap-2 disabled:opacity-50"
                          >
                            {saveMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            Save Changes
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setConfig(mappingConfig || { field_mapping: {}, transformations: {} })
                            setEditing(true)
                          }}
                          className="btn-primary"
                        >
                          Edit Configuration
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  {editing && config ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-content-secondary">
                          Configuration JSON
                        </label>
                        {jsonError && (
                          <span className="text-xs text-status-error">{jsonError}</span>
                        )}
                      </div>
                      <div className="relative">
                        <textarea
                          className="input-field w-full font-mono text-sm leading-relaxed resize-none"
                          rows={20}
                          defaultValue={JSON.stringify(config, null, 2)}
                          onChange={(e) => handleJsonChange(e.target.value)}
                          spellCheck={false}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Field Mapping Section */}
                      <div>
                        <h3 className="text-sm font-medium text-content-secondary mb-3 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald" />
                          Field Mapping
                        </h3>
                        <div className="bg-surface-secondary/50 rounded-xl p-4 border border-white/[0.12]">
                          <pre className="text-sm text-content-secondary font-mono whitespace-pre-wrap break-all">
                            {JSON.stringify(mappingConfig?.field_mapping || {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                      
                      {/* Transformations Section */}
                      <div>
                        <h3 className="text-sm font-medium text-content-secondary mb-3 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-violet" />
                          Transformations
                        </h3>
                        <div className="bg-surface-secondary/50 rounded-xl p-4 border border-white/[0.12]">
                          <pre className="text-sm text-content-secondary font-mono whitespace-pre-wrap break-all">
                            {JSON.stringify(mappingConfig?.transformations || {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Success message */}
                  {saveMutation.isSuccess && (
                    <div className="mt-6 p-4 rounded-xl bg-status-success/10 border border-status-success/20 flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-status-success/20">
                        <Check className="w-4 h-4 text-status-success" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-status-success">Configuration saved</p>
                        <p className="text-xs text-status-success/70">Changes have been applied successfully</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
