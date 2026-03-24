import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OverviewTab } from '@/components/overview-tab'
import { SchemaTab } from '@/components/schema-tab'
import { DataTab } from '@/components/data-tab'
import { QueryTab } from '@/components/query-tab'
import { useComments } from '@/hooks/use-comments'
import type { SchemaResponse } from '@/types/api'

interface DetailPanelProps {
  selectedDb: string | null
  selectedObjectName: string | null
  selectedObjectType: string | null
  schema: SchemaResponse | null
  schemaLoading: boolean
}

export function DetailPanel({ selectedDb, selectedObjectName, selectedObjectType, schema, schemaLoading }: DetailPanelProps) {
  const { comments, updateComment } = useComments(selectedDb)

  if (!selectedDb || !schema) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">No database selected</p>
          <p className="text-sm">Select a database from the sidebar to begin</p>
        </div>
      </div>
    )
  }

  if (schemaLoading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading schema...</div>
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <div className="text-xs text-muted-foreground">{schema.database.path}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xl font-bold">{selectedObjectName || schema.database.fileName}</span>
          {selectedObjectType && (
            <Badge variant="outline" className="uppercase text-xs">{selectedObjectType}</Badge>
          )}
        </div>
      </div>
      <Tabs defaultValue="overview" className="flex-1 flex flex-col">
        <TabsList className="mx-6 mt-3 w-fit">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schema">Schema</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="query">Query</TabsTrigger>
        </TabsList>
        <div className="flex-1 overflow-auto px-6 py-4">
          <TabsContent value="overview" className="mt-0"><OverviewTab schema={schema} /></TabsContent>
          <TabsContent value="schema" className="mt-0">
            <SchemaTab
              schema={schema}
              selectedObjectName={selectedObjectName}
              selectedObjectType={selectedObjectType}
              comments={comments}
              onUpdateComment={updateComment}
            />
          </TabsContent>
          <TabsContent value="data" className="mt-0">
            <DataTab
              dbPath={selectedDb}
              tableName={selectedObjectName}
              tableType={selectedObjectType}
              comments={comments}
            />
          </TabsContent>
          <TabsContent value="query" className="mt-0"><QueryTab dbPath={selectedDb} /></TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
