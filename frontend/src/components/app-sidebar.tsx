import { RefreshCw } from 'lucide-react'
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
} from '@/components/ui/sidebar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DatabaseTree } from '@/components/database-tree'
import type { DatabaseEntry, SchemaResponse } from '@/types/api'

interface AppSidebarProps {
  databases: DatabaseEntry[]
  dbLoading: boolean
  expandedDb: string | null
  selectedDb: string | null
  selectedObject: string | null
  schema: SchemaResponse | null
  schemaLoading: boolean
  dbFilter: string
  objectFilter: string
  onDbFilterChange: (value: string) => void
  onObjectFilterChange: (value: string) => void
  onSelectDb: (path: string) => void
  onSelectObject: (dbPath: string, name: string, type: string) => void
  onRefresh: () => void
}

export function AppSidebar({
  databases, dbLoading, expandedDb, selectedDb, selectedObject, schema, schemaLoading,
  dbFilter, objectFilter, onDbFilterChange, onObjectFilterChange,
  onSelectDb, onSelectObject, onRefresh,
}: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Navigator</span>
            <Badge variant="secondary">{databases.length}</Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh} disabled={dbLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${dbLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <Input type="search" placeholder="Filter databases..." value={dbFilter}
          onChange={(e) => onDbFilterChange(e.target.value)} className="mt-2 h-8 text-xs" />
        <Input type="search" placeholder="Filter objects..." value={objectFilter}
          onChange={(e) => onObjectFilterChange(e.target.value)} className="mt-1.5 h-8 text-xs" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Databases</SidebarGroupLabel>
          <SidebarGroupContent>
            <DatabaseTree
              databases={databases} expandedDb={expandedDb} selectedDb={selectedDb}
              selectedObject={selectedObject} schema={schema} schemaLoading={schemaLoading}
              dbFilter={dbFilter} objectFilter={objectFilter}
              onSelectDb={onSelectDb} onSelectObject={onSelectObject}
            />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
