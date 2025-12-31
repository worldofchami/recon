'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import { Save, Plus } from 'lucide-react'

export default function ConfigPage() {
  const [selectedSource, setSelectedSource] = useState<string>('')
  const [config, setConfig] = useState<any>(null)
  const [editing, setEditing] = useState(false)

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
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Data Source Configuration</h1>
          <p className="text-slate-600">Manage field mappings and transformations for source systems</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-finance p-6 border border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Source Systems</h2>
            {isLoadingSources ? (
              <div className="text-center text-slate-500 py-4">Loading sources...</div>
            ) : (
              <div className="space-y-2">
                {sources.length === 0 ? (
                  <div className="text-center text-slate-500 py-4">No sources found</div>
                ) : (
                  sources.map((source) => (
                    <button
                      key={source}
                      onClick={() => handleSourceSelect(source)}
                      className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                        selectedSource === source
                          ? 'bg-blue-50 text-blue-900 border border-blue-200 font-medium'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-transparent'
                      }`}
                    >
                      {source}
                    </button>
                  ))
                )}
              </div>
            )}
            <button className="mt-4 w-full flex items-center justify-center px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors">
              <Plus className="w-4 h-4 mr-2" />
              Add Source
            </button>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl shadow-finance p-6 border border-slate-100">
            {!selectedSource ? (
              <div className="text-center text-slate-500 py-12">
                Select a source system to view/edit its configuration
              </div>
            ) : isLoading ? (
              <div className="text-center text-slate-500 py-12">Loading configuration...</div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Field Mapping: {selectedSource}
                  </h2>
                  {!editing ? (
                    <button
                      onClick={() => {
                        setConfig(mappingConfig || { field_mapping: {}, transformations: {} })
                        setEditing(true)
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Edit
                    </button>
                  ) : (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setEditing(false)}
                        className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saveMutation.isPending}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center disabled:opacity-50 transition-colors font-medium"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </button>
                    </div>
                  )}
                </div>

                {editing && config ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Field Mapping (JSON)
                      </label>
                      <textarea
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={10}
                        value={JSON.stringify(config, null, 2)}
                        onChange={(e) => {
                          try {
                            setConfig(JSON.parse(e.target.value))
                          } catch {
                            // Invalid JSON, keep as is
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-slate-700 mb-2">Field Mapping</h3>
                      <pre className="bg-slate-50 p-4 rounded-lg text-sm overflow-x-auto border border-slate-200">
                        {JSON.stringify(mappingConfig?.field_mapping || {}, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-700 mb-2">Transformations</h3>
                      <pre className="bg-slate-50 p-4 rounded-lg text-sm overflow-x-auto border border-slate-200">
                        {JSON.stringify(mappingConfig?.transformations || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

