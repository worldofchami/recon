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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Data Source Configuration</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Source Systems</h2>
            <div className="space-y-2">
              {['BANK_ABS', 'POS_INTERNAL', 'PAYMENT_GATEWAY'].map((source) => (
                <button
                  key={source}
                  onClick={() => handleSourceSelect(source)}
                  className={`w-full text-left px-4 py-2 rounded-md ${
                    selectedSource === source
                      ? 'bg-primary-100 text-primary-900'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>
            <button className="mt-4 w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
              <Plus className="w-4 h-4 mr-2" />
              Add Source
            </button>
          </div>

          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            {!selectedSource ? (
              <div className="text-center text-gray-500 py-12">
                Select a source system to view/edit its configuration
              </div>
            ) : isLoading ? (
              <div className="text-center text-gray-500 py-12">Loading configuration...</div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Field Mapping: {selectedSource}
                  </h2>
                  {!editing ? (
                    <button
                      onClick={() => {
                        setConfig(mappingConfig || { field_mapping: {}, transformations: {} })
                        setEditing(true)
                      }}
                      className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                    >
                      Edit
                    </button>
                  ) : (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setEditing(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saveMutation.isPending}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 flex items-center disabled:opacity-50"
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Field Mapping (JSON)
                      </label>
                      <textarea
                        className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm"
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
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Field Mapping</h3>
                      <pre className="bg-gray-50 p-4 rounded-md text-sm overflow-x-auto">
                        {JSON.stringify(mappingConfig?.field_mapping || {}, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Transformations</h3>
                      <pre className="bg-gray-50 p-4 rounded-md text-sm overflow-x-auto">
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

