import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

const API_URL = process.env.NODE_ENV === "production" ? "https://recon-638214892937.europe-west3.run.app" : 'http://localhost:8000'
const INGEST_URL = process.env.NEXT_PUBLIC_INGEST_URL || 'http://localhost:8001'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

const ingestApi = axios.create({
  baseURL: INGEST_URL,
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
  direla_id?: string
  source_system: string
  source_ref_id: string
  transaction_datetime_utc: string
  amount_local: number
  currency_code_iso: string
  party_type?: string
  phone_number?: string
  product_type?: string
  commission_amount?: number
  merchant_payout?: number
  party_signature?: string
  confidence_score?: number
  match_status: string
  break_category: string
  raw_data_uri?: string
  break_metadata?: {
    failure_reasons?: string[]
    rules_attempted?: Array<{ name: string; type: string }>
    candidates?: Array<{
      transaction_uuid: string
      source_system: string
      source_ref_id: string
      amount: number
      currency: string
      datetime: string
      similarity_score?: number
    }>
    timestamp?: string
    transaction_details?: any
  }
}

export interface BreakContext {
  transaction: Break
  match_peers: Break[]
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

export interface RawTransaction {
  transaction_uuid: string
  raw_uri: string
  content_type?: string
  raw_text: string
}

export interface IngestRequest {
  source_system: string
  source_ref_id: string
  transaction_datetime: string
  amount: number
  currency: string
  raw_data: Record<string, any>
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

  resolveBreak: async (transactionUuid: string, action: string, candidateUuid?: string): Promise<void> => {
    await api.post('/breaks/resolve', null, {
      params: { 
        transaction_uuid: transactionUuid, 
        action,
        ...(candidateUuid && { candidate_uuid: candidateUuid }),
      },
    })
  },

  // Direla-specific endpoints
  createDirelaId: async (transactionData: any): Promise<{ direla_id: string }> => {
    const response = await api.post('/direla/create-id', transactionData)
    return response.data
  },

  getSouthAfricanRules: async (): Promise<any> => {
    const response = await api.get('/direla/rules/sa')
    return response.data
  },

  getDirelaIds: async (): Promise<any[]> => {
    const response = await api.get('/direla/ids')
    return response.data
  },

  getConsoleInsights: async (): Promise<any> => {
    const response = await api.get('/console/insights')
    return response.data
  },

  getRules: async (): Promise<any[]> => {
    const response = await api.get('/rules')
    return response.data.rules || []
  },

  getRule: async (ruleId: string): Promise<any> => {
    const response = await api.get(`/rules/${ruleId}`)
    return response.data
  },

  createRule: async (rule: any): Promise<{ rule_id: string }> => {
    const response = await api.post('/rules', rule)
    return response.data
  },

  updateRule: async (ruleId: string, rule: any): Promise<{ rule_id: string }> => {
    const response = await api.put(`/rules/${ruleId}`, rule)
    return response.data
  },

  deleteRule: async (ruleId: string): Promise<void> => {
    await api.delete(`/rules/${ruleId}`)
  },

  reprocessTransaction: async (transactionUuid: string): Promise<void> => {
    await api.post(`http://localhost:8002/reprocess/${transactionUuid}`)
  },

  getBreakContext: async (transactionUuid: string): Promise<BreakContext> => {
    const response = await api.get(`/breaks/${transactionUuid}/context`)
    return response.data
  },

  getRawTransaction: async (transactionUuid: string): Promise<RawTransaction> => {
    const response = await api.get(`/breaks/${transactionUuid}/raw`)
    return response.data
  },

  ingestTransaction: async (payload: IngestRequest): Promise<{ status: string; transaction_uuid: string }> => {
    const response = await ingestApi.post('/ingest', payload)
    return response.data
  },

  ingestIso20022: async (payload: any): Promise<{ status: string; transaction_uuid: string }> => {
    const response = await ingestApi.post('/ingest/iso20022', payload)
    return response.data
  },
}

