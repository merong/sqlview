export interface ServerInfo {
  success: boolean
  root: string
  rootDisplayPath: string
  defaults: {
    pageSize: number
    maxPageSize: number
    maxQueryRows: number
  }
}

export interface DatabaseEntry {
  path: string
  name: string
  directory: string
  sizeBytes: number
  mtimeMs: number
  modifiedAt: string
}

export interface DatabaseListResponse {
  success: boolean
  root: string
  count: number
  databases: DatabaseEntry[]
}

export interface ColumnMeta {
  cid: number
  name: string
  type: string
  notNull: boolean
  defaultValue: string | null
  primaryKeyIndex: number
  hidden: number
}

export interface IndexInfo {
  name: string
  unique: boolean
  origin: string
  partial: boolean
  columns: string[]
}

export interface ForeignKeyInfo {
  id: number
  seq: number
  table: string
  from: string
  to: string
  onUpdate: string
  onDelete: string
  match: string
}

export interface TableSchema {
  name: string
  type: 'table'
  sql: string
  columns: ColumnMeta[]
  indexes: IndexInfo[]
  foreignKeys: ForeignKeyInfo[]
}

export interface ViewSchema {
  name: string
  type: 'view'
  sql: string
  columns: ColumnMeta[]
}

export interface IndexSchema {
  name: string
  type: 'index'
  tableName: string
  sql: string
  columns: string[]
}

export interface TriggerSchema {
  name: string
  type: 'trigger'
  tableName: string
  sql: string
}

export interface SchemaSummary {
  fileSizeBytes: number
  mtimeMs: number
  modifiedAt: string
  pageSize: number
  pageCount: number
  freelistCount: number
  encoding: string
  tables: number
  views: number
  indexes: number
  triggers: number
  tableCount: number
  viewCount: number
  indexCount: number
  triggerCount: number
}

export interface SchemaResponse {
  success: boolean
  database: {
    path: string
    absolutePath: string
    fileName: string
    sizeBytes: number
    modifiedAt: string
    mtime: string
  }
  summary: SchemaSummary
  tables: TableSchema[]
  views: ViewSchema[]
  indexes: IndexSchema[]
  triggers: TriggerSchema[]
}

export interface TableDataResponse {
  success: boolean
  database: {
    path: string
    absolutePath: string
    fileName: string
  }
  page: number
  pageSize: number
  totalRows: number
  totalPages: number
  filterText: string
  filter: string
  sort: string | null
  order: 'asc' | 'desc'
  relation: { name: string; type: string; sql: string }
  objectName: string
  columns: ColumnMeta[]
  rows: Record<string, unknown>[]
}

export interface QueryResponse {
  success: boolean
  database: {
    path: string
    absolutePath: string
    fileName: string
  }
  sql: string
  columns: ColumnMeta[]
  rows: Record<string, unknown>[]
  rowCount: number
  truncated: boolean
  maxRows: number
  durationMs: number
  elapsedMs: number
}

export type SchemaObject = TableSchema | ViewSchema | IndexSchema | TriggerSchema
