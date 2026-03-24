import { useState, useCallback, useRef } from 'react'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { AppSidebar } from '@/components/app-sidebar'
import { DetailPanel } from '@/components/detail-panel'
import { CommandSearch } from '@/components/command-search'
import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { useDatabases } from '@/hooks/use-databases'
import { useSchema } from '@/hooks/use-schema'
import { useTheme } from '@/hooks/use-theme'

export default function App() {
  useTheme()
  const { databases, loading: dbLoading, refresh } = useDatabases()

  const [selectedDb, setSelectedDb] = useState<string | null>(null)
  const [expandedDb, setExpandedDb] = useState<string | null>(null)
  const [selectedObjectKey, setSelectedObjectKey] = useState<string | null>(null)
  const [dbFilter, setDbFilter] = useState('')
  const [objectFilter, setObjectFilter] = useState('')

  const { schema, loading: schemaLoading, error: schemaError } = useSchema(selectedDb)

  const prevSchemaError = useRef<string | null>(null)
  if (schemaError && schemaError !== prevSchemaError.current) {
    prevSchemaError.current = schemaError
    toast.error(schemaError)
  } else if (!schemaError) {
    prevSchemaError.current = null
  }

  const selectedObjectName = selectedObjectKey
    ? selectedObjectKey.split(':').slice(1).join(':')
    : null
  const selectedObjectType = selectedObjectKey
    ? selectedObjectKey.split(':')[0]
    : null

  const handleSelectDb = useCallback((path: string) => {
    if (expandedDb === path) {
      setExpandedDb(null)
    } else {
      setExpandedDb(path)
      setSelectedDb(path)
      setSelectedObjectKey(null)
      setObjectFilter('')
    }
  }, [expandedDb])

  const handleSelectObject = useCallback(
    (dbPath: string, name: string, type: string) => {
      setSelectedDb(dbPath)
      setExpandedDb(dbPath)
      setSelectedObjectKey(`${type}:${name}`)
    }, []
  )

  const handleRefresh = useCallback(() => {
    refresh()
    toast.success('Database list refreshed')
  }, [refresh])

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar
          databases={databases} dbLoading={dbLoading}
          expandedDb={expandedDb} selectedDb={selectedDb} selectedObject={selectedObjectKey}
          schema={schema} schemaLoading={schemaLoading}
          dbFilter={dbFilter} objectFilter={objectFilter}
          onDbFilterChange={setDbFilter} onObjectFilterChange={setObjectFilter}
          onSelectDb={handleSelectDb} onSelectObject={handleSelectObject}
          onRefresh={handleRefresh}
        />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="flex items-center justify-between border-b px-4 py-2">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <h1 className="text-lg font-bold">SQLView</h1>
              <Badge variant="secondary" className="text-xs">Read Only</Badge>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">&#8984;</span>K
              </kbd>
              <ThemeToggle />
            </div>
          </header>
          <div className="flex-1 overflow-hidden">
            <DetailPanel
              selectedDb={selectedDb} selectedObjectName={selectedObjectName}
              selectedObjectType={selectedObjectType} schema={schema} schemaLoading={schemaLoading}
            />
          </div>
        </main>
      </div>
      <CommandSearch databases={databases} schema={schema} selectedDb={selectedDb}
        onSelectDb={handleSelectDb} onSelectObject={handleSelectObject} />
      <Toaster />
    </SidebarProvider>
  )
}
