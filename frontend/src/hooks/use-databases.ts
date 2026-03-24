import { useState, useEffect, useCallback } from 'react'
import type { DatabaseEntry } from '@/types/api'
import { getDatabases } from '@/lib/api'

export function useDatabases() {
  const [databases, setDatabases] = useState<DatabaseEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getDatabases()
      setDatabases(res.databases)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load databases')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { databases, loading, error, refresh }
}
