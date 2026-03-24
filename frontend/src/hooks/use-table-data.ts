import { useState, useCallback } from 'react'
import type { TableDataResponse } from '@/types/api'
import { getTableData } from '@/lib/api'

export interface TableDataOptions {
  page: number
  pageSize: number
  sort: string
  order: 'asc' | 'desc'
  filter: string
}

export function useTableData() {
  const [data, setData] = useState<TableDataResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (dbPath: string, table: string, opts: TableDataOptions) => {
      setLoading(true)
      setError(null)
      try {
        const res = await getTableData(dbPath, table, opts)
        setData(res)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { data, loading, error, load }
}
