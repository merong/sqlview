import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext,
} from '@/components/ui/pagination'
import { DataTable } from '@/components/data-table'
import { RowDetailDialog } from '@/components/row-detail-dialog'
import { useTableData, type TableDataOptions } from '@/hooks/use-table-data'
import type { CommentsData } from '@/lib/api'

interface DataTabProps {
  dbPath: string | null
  tableName: string | null
  tableType: string | null
  comments?: CommentsData
}

const QUERYABLE_TYPES = new Set(['table', 'view'])

export function DataTab({ dbPath, tableName, tableType, comments }: DataTabProps) {
  const { data, loading, error, load } = useTableData()
  const [opts, setOpts] = useState<TableDataOptions>({
    page: 1, pageSize: 50, sort: '', order: 'asc',  filter: '',
  })
  const [filterInput, setFilterInput] = useState('')
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null)

  const doLoad = useCallback(() => {
    if (dbPath && tableName && QUERYABLE_TYPES.has(tableType || '')) {
      load(dbPath, tableName, opts)
    }
  }, [dbPath, tableName, tableType, opts, load])

  useEffect(() => {
    setOpts((prev) => ({ ...prev, page: 1, filter: '', sort: '', order: 'asc' as const }))
    setFilterInput('')
  }, [dbPath, tableName])

  useEffect(() => { doLoad() }, [doLoad])

  if (!dbPath || !tableName || !QUERYABLE_TYPES.has(tableType || '')) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        Select a table or view to inspect rows
      </div>
    )
  }

  const handleSort = (column: string) => {
    setOpts((prev) => ({
      ...prev,
      sort: column,
      order: prev.sort === column && prev.order === 'asc' ? 'desc' as const : 'asc' as const,
      page: 1,
    }))
  }

  const applyFilter = () => {
    setOpts((prev) => ({ ...prev, filter: filterInput, page: 1 }))
  }

  const clearFilter = () => {
    setFilterInput('')
    setOpts((prev) => ({ ...prev, filter: '', page: 1 }))
  }

  const columnComments = comments && tableName
    ? Object.fromEntries(
        Object.entries(comments.columns)
          .filter(([k]) => k.startsWith(`${tableName}.`))
          .map(([k, v]) => [k.split('.').slice(1).join('.'), v])
      )
    : {}

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-1 items-center gap-2 min-w-[200px]">
          <Input type="search" placeholder="Filter rows..." value={filterInput}
            onChange={(e) => setFilterInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
            className="h-8 text-xs" />
          <Button variant="outline" size="sm" onClick={applyFilter}>Apply</Button>
          <Button variant="ghost" size="sm" onClick={clearFilter}>Clear</Button>
        </div>
        <Select
          value={String(opts.pageSize)}
          onValueChange={(v) => setOpts((prev) => ({ ...prev, pageSize: Number(v), page: 1 }))}
        >
          <SelectTrigger className="w-[80px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
            <SelectItem value="200">200</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {loading && <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">Loading...</div>}
      {data && !loading && (
        <>
          <div className="text-xs text-muted-foreground">
            {data.totalRows.toLocaleString()} rows{data.filter && ' (filtered)'}
          </div>
          <DataTable
            columns={data.columns}
            rows={data.rows}
            sortColumn={data.sort}
            sortOrder={data.order}
            onSort={handleSort}
            showDetailButton
            onRowClick={(row) => setSelectedRow(row)}
          />
          <RowDetailDialog
            open={selectedRow !== null}
            onOpenChange={(open) => { if (!open) setSelectedRow(null) }}
            columns={data.columns}
            row={selectedRow}
            tableName={tableName ?? undefined}
            columnComments={columnComments}
          />
          {data.totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setOpts((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    className={data.page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-3 text-sm">Page {data.page} / {data.totalPages}</span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setOpts((prev) => ({ ...prev, page: Math.min(data.totalPages, prev.page + 1) }))}
                    className={data.page >= data.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
  )
}
