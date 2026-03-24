import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import type { SchemaResponse } from '@/types/api'

interface OverviewTabProps {
  schema: SchemaResponse
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function OverviewTab({ schema }: OverviewTabProps) {
  const { summary, database } = schema

  const stats = [
    { label: 'Tables', value: summary.tableCount },
    { label: 'Views', value: summary.viewCount },
    { label: 'Indexes', value: summary.indexCount },
    { label: 'File Size', value: formatSize(summary.fileSizeBytes) },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Database Info</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium text-muted-foreground w-[140px]">File</TableCell>
                <TableCell className="font-mono text-sm">{database.fileName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-muted-foreground">Path</TableCell>
                <TableCell className="font-mono text-sm">{database.path}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-muted-foreground">Encoding</TableCell>
                <TableCell>{summary.encoding}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-muted-foreground">Page Size</TableCell>
                <TableCell>{summary.pageSize.toLocaleString()} bytes</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-muted-foreground">Pages</TableCell>
                <TableCell>{summary.pageCount.toLocaleString()}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-muted-foreground">Modified</TableCell>
                <TableCell>{new Date(database.modifiedAt).toLocaleString()}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
