import { useState, useCallback } from 'react'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { DataTable } from '@/components/data-table'
import { executeQuery } from '@/lib/api'
import type { QueryResponse } from '@/types/api'

interface QueryTabProps {
  dbPath: string | null
}

export function QueryTab({ dbPath }: QueryTabProps) {
  const [sql, setSql] = useState('')
  const [result, setResult] = useState<QueryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runQuery = useCallback(async () => {
    if (!dbPath || !sql.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await executeQuery(dbPath, sql)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [dbPath, sql])

  if (!dbPath) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        Select a database to run queries
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-1">
          <p className="text-xs text-muted-foreground">
            Read-only SQL — SELECT, WITH, EXPLAIN QUERY PLAN
          </p>
          <Textarea value={sql} onChange={(e) => setSql(e.target.value)}
            placeholder="SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name;"
            className="min-h-[140px] font-mono text-sm" spellCheck={false}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); runQuery() }
            }}
          />
        </div>
        <Button onClick={runQuery} disabled={loading || !sql.trim()} className="mt-6">
          <Play className="mr-1 h-3.5 w-3.5" />Run
        </Button>
      </div>
      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {result && (
        <>
          <div className="text-xs text-muted-foreground">
            {result.rowCount} row{result.rowCount !== 1 ? 's' : ''}
            {result.truncated && ` (truncated at ${result.maxRows})`}
            {' · '}{result.durationMs.toFixed(1)} ms
          </div>
          <DataTable columns={result.columns} rows={result.rows} />
        </>
      )}
    </div>
  )
}
