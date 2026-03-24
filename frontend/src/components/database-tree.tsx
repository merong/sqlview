import { ChevronRight, Database, Table2, Eye, ListTree } from 'lucide-react'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SchemaResponse, SchemaObject } from '@/types/api'

interface DatabaseTreeProps {
  databases: { path: string; name: string; sizeBytes: number }[]
  expandedDb: string | null
  selectedDb: string | null
  selectedObject: string | null
  schema: SchemaResponse | null
  schemaLoading: boolean
  dbFilter: string
  objectFilter: string
  onSelectDb: (path: string) => void
  onSelectObject: (dbPath: string, objectName: string, objectType: string) => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function objectIcon(type: string) {
  switch (type) {
    case 'table': return <Table2 className="h-3.5 w-3.5" />
    case 'view': return <Eye className="h-3.5 w-3.5" />
    case 'index': return <ListTree className="h-3.5 w-3.5" />
    default: return <Table2 className="h-3.5 w-3.5" />
  }
}

export function DatabaseTree({
  databases, expandedDb, selectedDb, selectedObject, schema, schemaLoading,
  dbFilter, objectFilter, onSelectDb, onSelectObject,
}: DatabaseTreeProps) {
  const filtered = databases.filter((db) =>
    !dbFilter || db.name.toLowerCase().includes(dbFilter.toLowerCase())
  )

  const objects: SchemaObject[] = schema
    ? [...schema.tables, ...schema.views, ...schema.indexes, ...schema.triggers]
    : []

  const filteredObjects = objects.filter((obj) =>
    !objectFilter || obj.name.toLowerCase().includes(objectFilter.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-0.5 py-1">
      {filtered.map((db) => {
        const isExpanded = expandedDb === db.path
        return (
          <Collapsible key={db.path} open={isExpanded}>
            <CollapsibleTrigger
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => onSelectDb(db.path)}
            >
              <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
              <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{db.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{formatSize(db.sizeBytes)}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-4 border-l pl-3 py-1">
                {schemaLoading ? (
                  <p className="px-3 py-1 text-xs text-muted-foreground">Loading...</p>
                ) : filteredObjects.length === 0 ? (
                  <p className="px-3 py-1 text-xs text-muted-foreground">No objects found</p>
                ) : (
                  filteredObjects.map((obj) => {
                    const key = `${obj.type}:${obj.name}`
                    const isSelected = selectedDb === db.path && selectedObject === key
                    return (
                      <button
                        key={key}
                        onClick={() => onSelectObject(db.path, obj.name, obj.type)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                          isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                        )}
                      >
                        {objectIcon(obj.type)}
                        <span className="truncate">{obj.name}</span>
                        <Badge variant="secondary" className="ml-auto text-[10px] uppercase">{obj.type}</Badge>
                      </button>
                    )
                  })
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
      {filtered.length === 0 && (
        <p className="px-3 py-4 text-sm text-muted-foreground text-center">No databases found</p>
      )}
    </div>
  )
}
