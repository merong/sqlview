import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { ColumnMeta } from '@/types/api'

interface DataTableProps {
  columns: ColumnMeta[]
  rows: Record<string, unknown>[]
  sortColumn?: string | null
  sortOrder?: 'asc' | 'desc'
  onSort?: (column: string) => void
  onRowClick?: (row: Record<string, unknown>) => void
  showDetailButton?: boolean
}

function formatCellValue(value: unknown): string {
  if (value === null) return 'NULL'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function DataTable({ columns, rows, sortColumn, sortOrder, onSort, onRowClick, showDetailButton }: DataTableProps) {
  return (
    <div className="rounded-md border">
      <div className="overflow-auto max-h-[calc(100vh-320px)]">
        <Table>
          <TableHeader>
            <TableRow>
              {showDetailButton && <TableHead className="w-[40px]" />}
              {columns.map((col) => (
                <TableHead
                  key={col.name}
                  className={`whitespace-nowrap ${onSort ? 'cursor-pointer hover:text-foreground' : ''}`}
                  onClick={() => onSort?.(col.name)}
                >
                  {col.name}
                  {sortColumn === col.name && (
                    <span className="ml-1 text-xs">{sortOrder === 'asc' ? '\u2191' : '\u2193'}</span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (showDetailButton ? 1 : 0)} className="h-24 text-center text-muted-foreground">
                  No data
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={i}>
                  {showDetailButton && (
                    <TableCell className="px-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); onRowClick?.(row) }}
                      >
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  )}
                  {columns.map((col) => {
                    const val = row[col.name]
                    const isNull = val === null
                    return (
                      <TableCell
                        key={col.name}
                        className={`max-w-[300px] truncate ${isNull ? 'italic text-muted-foreground' : ''}`}
                      >
                        {formatCellValue(val)}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
