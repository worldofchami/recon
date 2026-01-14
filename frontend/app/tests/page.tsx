'use client'

import { useState, useMemo, useCallback } from 'react'
import { apiClient, IngestRequest, BreakContext } from '@/lib/api'

type ScenarioResult = {
  status: 'idle' | 'running' | 'pass' | 'fail'
  message?: string
  logs: string[]
}

type Scenario = {
  id: string
  title: string
  description: string
  run: () => Promise<ScenarioResult>
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const defaultResult: ScenarioResult = { status: 'idle', logs: [] }

export default function TestsPage() {
  const [results, setResults] = useState<Record<string, ScenarioResult>>({})
  const [running, setRunning] = useState(false)

  const pollContext = useCallback(async (transactionUuid: string, predicate: (ctx: BreakContext) => boolean, timeoutMs = 12000) => {
    const start = Date.now()
    let lastCtx: BreakContext | null = null
    while (Date.now() - start < timeoutMs) {
      try {
        const ctx = await apiClient.getBreakContext(transactionUuid)
        lastCtx = ctx
        if (predicate(ctx)) return ctx
      } catch (err) {
        // ignore transient 404 while propagation happens
      }
      await delay(500)
    }
    throw new Error(lastCtx ? `Timed out; last status ${lastCtx.transaction.match_status || 'None'}` : 'Timed out waiting for context')
  }, [])

  const ensureMappings = useCallback(async () => {
    await Promise.all([
      apiClient.saveMappingConfig('POS_OS', {
        field_mapping: {
          source_ref_id: 'transaction_id',
          transaction_datetime: 'device_timestamp',
          amount: 'amount',
          currency: 'currency',
        },
        metadata: { schema: 'POS' },
      }),
      apiClient.saveMappingConfig('SWITCH', {
        field_mapping: {
          source_ref_id: 'original_txn_id',
          transaction_datetime: 'processed_at',
          amount: 'amount',
          currency: 'currency',
        },
        metadata: { schema: 'SWITCH' },
      }),
      apiClient.saveMappingConfig('BANK', {
        field_mapping: {
          source_ref_id: 'Ret_Ref_No',
          transaction_datetime: 'Rec_Date',
          amount: 'Amount',
          currency: 'Currency',
        },
        metadata: {
          schema: 'BANK',
          fees: {
            mode: 'percentage',
            rate: 0.03,
          },
        },
      }),
      apiClient.saveMappingConfig('VENDOR', {
        field_mapping: {
          source_ref_id: 'Ref',
          transaction_datetime: 'Timestamp_iso',
          amount: 'Amount',
          currency: 'Currency',
        },
        metadata: { schema: 'VENDOR' },
      }),
    ])
  }, [])

  const ingest = useCallback(async (payload: IngestRequest) => {
    const res = await apiClient.ingestTransaction(payload)
    return res.transaction_uuid
  }, [])

  const scenarios: Scenario[] = useMemo(
    () => [
      {
        id: 'late-presentment',
        title: 'Late Presentment (TXN-8829-C)',
        description: 'POS happened on 10th, uploaded 12th; ensure we anchor on device timestamp.',
        run: async () => {
          const logs: string[] = []
          await ensureMappings()
          logs.push('Mappings seeded')

          const posUuid = await ingest({
            source_system: 'POS_OS',
            source_ref_id: 'TXN-8829-C',
            transaction_datetime: '2023-10-10T16:00:00Z',
            amount: 100.0,
            currency: 'ZAR',
            raw_data: {
              transaction_id: 'TXN-8829-C',
              device_timestamp: '2023-10-10T16:00:00Z',
              upload_timestamp: '2023-10-12T08:00:00Z',
              amount: 100.0,
              currency: 'ZAR',
              stan: '000125',
            },
          })
          logs.push(`POS ingested: ${posUuid}`)

          const switchUuid = await ingest({
            source_system: 'SWITCH',
            source_ref_id: 'TXN-8829-C',
            transaction_datetime: '2023-10-12T08:00:01Z',
            amount: 100.0,
            currency: 'ZAR',
            raw_data: {
              switch_ref: 'SW-999-03',
              original_txn_id: 'TXN-8829-C',
              processed_at: '2023-10-12T08:00:01Z',
              status: 'SUCCESS',
              amount: 100.0,
              currency: 'ZAR',
            },
          })
          logs.push(`Switch ingested: ${switchUuid}`)

          const ctx = await pollContext(posUuid, (c) => !!c.transaction.transaction_uuid)
          const ok = ctx.transaction.transaction_datetime_utc.startsWith('2023-10-10')

          return {
            status: ok ? 'pass' : 'fail',
            message: ok ? 'POS kept device timestamp (10th) despite late upload' : 'Device timestamp not preserved',
            logs,
          }
        },
      },
      {
        id: 'ghost-transaction',
        title: 'Ghost Transaction (SW-999-04)',
        description: 'Switch TIMEOUT but vendor shows success; should stay visible as a break.',
        run: async () => {
          const logs: string[] = []
          await ensureMappings()
          logs.push('Mappings seeded')

          const switchUuid = await ingest({
            source_system: 'SWITCH',
            source_ref_id: 'TXN-8829-D',
            transaction_datetime: '2023-10-10T15:00:00Z',
            amount: 20.0,
            currency: 'ZAR',
            raw_data: {
              switch_ref: 'SW-999-04',
              original_txn_id: 'TXN-8829-D',
              processed_at: '2023-10-10T15:00:00Z',
              status: 'TIMEOUT',
              amount: 20.0,
              currency: 'ZAR',
            },
          })
          logs.push(`Switch ingested: ${switchUuid}`)

          const vendorUuid = await ingest({
            source_system: 'VENDOR',
            source_ref_id: 'SW-999-04',
            transaction_datetime: '2023-10-10T15:00:00Z',
            amount: 20.0,
            currency: 'ZAR',
            raw_data: {
              BatchID: 'BATCH-01',
              MSISDN: '27829999999',
              Amount: 20.0,
              Status: 'SUCCESS',
              Timestamp_iso: '2023-10-10T15:00:00Z',
              Ref: 'SW-999-04',
              Currency: 'ZAR',
            },
          })
          logs.push(`Vendor ingested: ${vendorUuid}`)

          const ctx = await pollContext(switchUuid, () => true)
          const status = ctx.transaction.match_status
          const ok = !status || ['UNMATCHED', 'DIRELA_REVIEW_REQUIRED', 'WRITE_OFF', 'MANUAL_ADJ'].includes(status)

          return {
            status: ok ? 'pass' : 'fail',
            message: ok ? `Visible for review (status ${status || 'None'})` : `Unexpected matched status ${status}`,
            logs,
          }
        },
      },
      {
        id: 'fee-leakage',
        title: 'Fee Leakage (variance)',
        description: 'Compute commission from config and ensure it is stored on ingestion.',
        run: async () => {
          const logs: string[] = []
          await ensureMappings()
          logs.push('Mappings seeded with 3% fee config for BANK')

          const bankUuid = await ingest({
            source_system: 'BANK',
            source_ref_id: '000123',
            transaction_datetime: '2023-10-11T00:00:00Z',
            amount: 150.0,
            currency: 'ZAR',
            raw_data: {
              Rec_Date: '2023-10-11T00:00:00Z',
              Merchant_Num: '998877',
              Terminal_ID: 'KAZANG-POS-001',
              Card_Type: 'VISA',
              Auth_Code: '123456',
              Amount: 150.0,
              Comm_Amt: 4.5,
              Net_Amt: 145.5,
              Ret_Ref_No: '000123',
              Currency: 'ZAR',
            },
          })
          logs.push(`Bank ingested: ${bankUuid}`)

          const ctx = await pollContext(bankUuid, (c) => !!c.transaction.transaction_uuid)
          const commission = ctx.transaction.commission_amount
          const ok = commission === 4.5

          return {
            status: ok ? 'pass' : 'fail',
            message: ok ? 'Commission computed at 3% (4.50)' : `Unexpected commission ${commission}`,
            logs,
          }
        },
      },
    ],
    [ensureMappings, ingest, pollContext],
  )

  const runAll = async () => {
    setRunning(true)
    try {
      const nextResults: Record<string, ScenarioResult> = {}
      for (const scenario of scenarios) {
        setResults((prev) => ({
          ...prev,
          [scenario.id]: { status: 'running', logs: [], message: 'Running...' },
        }))

        try {
          const result = await scenario.run()
          nextResults[scenario.id] = result
          setResults((prev) => ({ ...prev, [scenario.id]: result }))
        } catch (err: any) {
          const failResult: ScenarioResult = {
            status: 'fail',
            message: err?.message || 'Scenario failed',
            logs: [],
          }
          nextResults[scenario.id] = failResult
          setResults((prev) => ({ ...prev, [scenario.id]: failResult }))
        }
      }
      return nextResults
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-content-primary">Compliance Trap Tests</h1>
            <p className="text-content-secondary mt-1">
              Trigger the synthetic scenarios from compliance_trap.md and verify ingestion + reconciliation outcomes.
            </p>
          </div>
          <button
            onClick={runAll}
            disabled={running}
            className="btn-primary px-4 py-2 rounded-md disabled:opacity-60"
          >
            {running ? 'Running…' : 'Run All'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scenarios.map((scenario) => {
            const result = results[scenario.id] || defaultResult
            const badge =
              result.status === 'pass'
                ? 'bg-green-500/20 text-green-300'
                : result.status === 'fail'
                ? 'bg-red-500/20 text-red-300'
                : result.status === 'running'
                ? 'bg-blue-500/20 text-blue-200'
                : 'bg-white/10 text-content-secondary'

            const label =
              result.status === 'pass'
                ? 'PASS'
                : result.status === 'fail'
                ? 'FAIL'
                : result.status === 'running'
                ? 'RUNNING'
                : 'IDLE'

            return (
              <div key={scenario.id} className="glass-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-content-primary">{scenario.title}</h2>
                    <p className="text-sm text-content-secondary">{scenario.description}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full ${badge}`}>{label}</span>
                </div>
                {result.message && <p className="text-sm text-content-primary">{result.message}</p>}
                {result.logs.length > 0 && (
                  <div className="bg-black/20 rounded-md p-3 text-xs text-content-secondary max-h-32 overflow-auto">
                    {result.logs.map((line, idx) => (
                      <div key={idx} className="whitespace-pre-wrap">
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
