import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface DashboardSummary {
  total_transactions: number
  matched_count: number
  unmatched_count: number
  breaks_by_category: Record<string, number>
  recent_activity: any[]
}

export interface Break {
  transaction_uuid: string
  source_system: string
  source_ref_id: string
  transaction_datetime_utc: string
  amount_local: number
  currency_code_iso: string
  match_status: string
  break_category: string
}

export interface BreakSearchRequest {
  source_system?: string
  match_status?: string
  break_category?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

export interface BreakSearchResponse {
  breaks: Break[]
  total: number
  page: number
  page_size: number
}

export const apiClient = {
  getDashboardSummary: async (): Promise<DashboardSummary> => {
    const response = await api.get('/dashboard/summary')
    return response.data
  },

  searchBreaks: async (request: BreakSearchRequest): Promise<BreakSearchResponse> => {
    const response = await api.post('/breaks/search', request)
    return response.data
  },

  getAllSources: async (): Promise<string[]> => {
    const response = await api.get('/config/sources')
    return response.data.sources
  },

  getMappingConfig: async (sourceId: string): Promise<any> => {
    const response = await api.get(`/config/mapping/${sourceId}`)
    return response.data
  },

  saveMappingConfig: async (sourceId: string, config: any): Promise<void> => {
    await api.post(`/config/mapping/${sourceId}`, config)
  },

  resolveBreak: async (transactionUuid: string, action: string): Promise<void> => {
    await api.post('/breaks/resolve', null, {
      params: { transaction_uuid: transactionUuid, action },
    })
  },
}

