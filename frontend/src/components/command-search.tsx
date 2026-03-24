import { useState, useEffect } from 'react'
import { Database, Table2, Eye, ListTree } from 'lucide-react'
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import type { DatabaseEntry, SchemaResponse } from '@/types/api'

interface CommandSearchProps {
  databases: DatabaseEntry[]
  schema: SchemaResponse | null
  selectedDb: string | null
  onSelectDb: (path: string) => void
  onSelectObject: (dbPath: string, name: string, type: string) => void
}

function objectIcon(type: string) {
  switch (type) {
    case 'table': return <Table2 className="mr-2 h-4 w-4" />
    case 'view': return <Eye className="mr-2 h-4 w-4" />
    case 'index': return <ListTree className="mr-2 h-4 w-4" />
    default: return <Table2 className="mr-2 h-4 w-4" />
  }
}

export function CommandSearch({ databases, schema, selectedDb, onSelectDb, onSelectObject }: CommandSearchProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((prev) => !prev) }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const objects = schema ? [...schema.tables, ...schema.views, ...schema.indexes] : []

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search databases and objects..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Databases">
          {databases.map((db) => (
            <CommandItem key={db.path} onSelect={() => { onSelectDb(db.path); setOpen(false) }}>
              <Database className="mr-2 h-4 w-4" />{db.name}
            </CommandItem>
          ))}
        </CommandGroup>
        {selectedDb && objects.length > 0 && (
          <CommandGroup heading={`Objects in ${schema?.database.fileName}`}>
            {objects.map((obj) => (
              <CommandItem key={`${obj.type}:${obj.name}`}
                onSelect={() => { onSelectObject(selectedDb, obj.name, obj.type); setOpen(false) }}>
                {objectIcon(obj.type)}{obj.name}
                <span className="ml-2 text-xs text-muted-foreground uppercase">{obj.type}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
