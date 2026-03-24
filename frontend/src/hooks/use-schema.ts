import { useState, useEffect } from 'react'
import type { SchemaResponse } from '@/types/api'
import { getSchema } from '@/lib/api'

export function useSchema(dbPath: string | null) {
  const [schema, setSchema] = useState<SchemaResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!dbPath) {
      setSchema(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    getSchema(dbPath)
      .then((res) => { if (!cancelled) setSchema(res) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [dbPath])

  return { schema, loading, error }
}
