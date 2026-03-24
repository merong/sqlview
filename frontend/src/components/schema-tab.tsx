import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MessageSquare, Check, X } from 'lucide-react'
import type { SchemaResponse, SchemaObject, ColumnMeta } from '@/types/api'
import type { CommentsData } from '@/lib/api'

interface SchemaTabProps {
  schema: SchemaResponse
  selectedObjectName: string | null
  selectedObjectType: string | null
  comments?: CommentsData
  onUpdateComment?: (target: 'table' | 'column', key: string, comment: string) => void
}

function EditableComment({ value, placeholder, onSave }: {
  value: string; placeholder: string; onSave?: (val: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (!editing) {
    return (
      <div className="flex items-center gap-1 group">
        {value ? (
          <p className="text-sm text-muted-foreground italic">{value}</p>
        ) : (
          <p className="text-xs text-muted-foreground/50">{placeholder}</p>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => { setDraft(value); setEditing(true) }}
        >
          <MessageSquare className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onSave?.(draft); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
        className="h-7 text-xs"
        autoFocus
        placeholder={placeholder}
      />
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { onSave?.(draft); setEditing(false) }}>
        <Check className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(false)}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}

export function SchemaTab({ schema, selectedObjectName, selectedObjectType, comments, onUpdateComment }: SchemaTabProps) {
  const allObjects: SchemaObject[] = [
    ...schema.tables, ...schema.views, ...schema.indexes, ...schema.triggers,
  ]

  const selectedObj = allObjects.find(
    (o) => o.name === selectedObjectName && o.type === selectedObjectType
  )

  if (!selectedObj) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        Select an object to view its schema
      </div>
    )
  }

  const isTableOrView = selectedObj.type === 'table' || selectedObj.type === 'view'
  const columnMetas: ColumnMeta[] = isTableOrView && 'columns' in selectedObj
    ? (selectedObj.columns as ColumnMeta[])
    : []

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="uppercase">{selectedObj.type}</Badge>
          <span className="font-mono font-semibold">{selectedObj.name}</span>
        </div>
        {(selectedObj.type === 'table' || selectedObj.type === 'view') && (
          <EditableComment
            value={comments?.tables[selectedObj.name] || ''}
            placeholder={`Add comment for ${selectedObj.name}...`}
            onSave={(val) => onUpdateComment?.('table', selectedObj.name, val)}
          />
        )}
      </div>
      {selectedObj.sql && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">DDL</CardTitle></CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md bg-muted p-4 text-sm font-mono whitespace-pre-wrap">
              {selectedObj.sql}
            </pre>
          </CardContent>
        </Card>
      )}
      {columnMetas.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Columns</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">NOT NULL</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Default</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">PK</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {columnMetas.map((c) => {
                    const commentKey = `${selectedObj.name}.${c.name}`
                    return (
                      <tr key={c.name} className="border-b last:border-0">
                        <td className="px-3 py-2 font-mono font-medium">{c.name}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{c.type || '-'}</td>
                        <td className="px-3 py-2">{c.notNull ? 'YES' : 'NO'}</td>
                        <td className="px-3 py-2 font-mono">{c.defaultValue ?? '-'}</td>
                        <td className="px-3 py-2">{c.primaryKeyIndex > 0 ? `#${c.primaryKeyIndex}` : '-'}</td>
                        <td className="px-3 py-2">
                          <EditableComment
                            value={comments?.columns[commentKey] || ''}
                            placeholder="Add comment..."
                            onSave={(val) => onUpdateComment?.('column', commentKey, val)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
