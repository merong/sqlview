import type {
  ServerInfo,
  DatabaseListResponse,
  SchemaResponse,
  TableDataResponse,
  QueryResponse,
} from '@/types/api'

const BASE = ''

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(body.message || `HTTP ${res.status}`)
  }
  return res.json()
}

export function getInfo(): Promise<ServerInfo> {
  return fetchJson<ServerInfo>(`${BASE}/api/info`)
}

export function getDatabases(): Promise<DatabaseListResponse> {
  return fetchJson<DatabaseListResponse>(`${BASE}/api/databases`)
}

export function getSchema(dbPath: string): Promise<SchemaResponse> {
  return fetchJson<SchemaResponse>(
    `${BASE}/api/schema?db=${encodeURIComponent(dbPath)}`
  )
}

export function getTableData(
  dbPath: string,
  table: string,
  opts: {
    page?: number
    pageSize?: number
    sort?: string
    order?: string
    filter?: string
  } = {}
): Promise<TableDataResponse> {
  const params = new URLSearchParams({ db: dbPath, table })
  if (opts.page) params.set('page', String(opts.page))
  if (opts.pageSize) params.set('pageSize', String(opts.pageSize))
  if (opts.sort) params.set('sort', opts.sort)
  if (opts.order) params.set('order', opts.order)
  if (opts.filter) params.set('filter', opts.filter)
  return fetchJson<TableDataResponse>(`${BASE}/api/table?${params}`)
}

export function executeQuery(
  dbPath: string,
  sql: string
): Promise<QueryResponse> {
  return fetchJson<QueryResponse>(`${BASE}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dbPath, sql }),
  })
}

export interface CommentsData {
  tables: Record<string, string>
  columns: Record<string, string>
}

export function getComments(dbPath: string): Promise<{ success: boolean; database: string; comments: CommentsData }> {
  return fetchJson(`${BASE}/api/comments?db=${encodeURIComponent(dbPath)}`)
}

export function saveComment(
  db: string,
  target: 'table' | 'column',
  key: string,
  comment: string
): Promise<{ success: boolean; database: string; comments: CommentsData }> {
  return fetchJson(`${BASE}/api/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ db, target, key, comment }),
  })
}
