import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { ColumnMeta } from '@/types/api'

interface RowDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  columns: ColumnMeta[]
  row: Record<string, unknown> | null
  tableName?: string
  columnComments?: Record<string, string>
}

function inferDisplayType(col: ColumnMeta, value: unknown): 'null' | 'number' | 'blob' | 'text' | 'json' {
  if (value === null) return 'null'
  if (typeof value === 'number') return 'number'
  const strVal = String(value)
  if (strVal.startsWith('[blob ')) return 'blob'
  const colType = col.type.toUpperCase()
  if (colType.includes('INT') || colType.includes('REAL') || colType.includes('FLOAT') || colType.includes('DOUBLE') || colType.includes('NUMERIC')) {
    return 'number'
  }
  if (strVal.startsWith('{') || strVal.startsWith('[')) {
    try { JSON.parse(strVal); return 'json' } catch { /* not json */ }
  }
  return 'text'
}

function ValueDisplay({ col, value, comment }: { col: ColumnMeta; value: unknown; comment?: string }) {
  const displayType = inferDisplayType(col, value)

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{col.name}</span>
        <Badge variant="secondary" className="text-[10px] font-mono">{col.type || 'unknown'}</Badge>
        {col.primaryKeyIndex > 0 && <Badge variant="outline" className="text-[10px]">PK</Badge>}
        {col.notNull && <Badge variant="outline" className="text-[10px]">NOT NULL</Badge>}
      </div>
      {comment && (
        <p className="text-xs text-muted-foreground italic">{comment}</p>
      )}
      <div className="mt-1">
        {displayType === 'null' && (
          <span className="text-sm italic text-muted-foreground">NULL</span>
        )}
        {displayType === 'number' && (
          <span className="text-sm font-mono tabular-nums">{String(value)}</span>
        )}
        {displayType === 'blob' && (
          <span className="text-sm text-muted-foreground">{String(value)}</span>
        )}
        {displayType === 'json' && (
          <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-auto max-h-[200px] whitespace-pre-wrap">
            {JSON.stringify(JSON.parse(String(value)), null, 2)}
          </pre>
        )}
        {displayType === 'text' && (
          (() => {
            const text = String(value)
            if (text.length <= 100) {
              return <span className="text-sm">{text}</span>
            }
            return (
              <div className="rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap break-words max-h-[200px] overflow-auto font-mono">
                {text}
              </div>
            )
          })()
        )}
      </div>
    </div>
  )
}

export function RowDetailDialog({
  open, onOpenChange, columns, row, tableName, columnComments = {},
}: RowDetailDialogProps) {
  if (!row) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Row Detail
            {tableName && <Badge variant="secondary">{tableName}</Badge>}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(85vh-100px)]">
          <div className="space-y-4 pr-4">
            {columns.map((col, i) => (
              <div key={col.name}>
                <ValueDisplay
                  col={col}
                  value={row[col.name]}
                  comment={columnComments[col.name]}
                />
                {i < columns.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
