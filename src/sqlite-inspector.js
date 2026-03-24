import fs from 'node:fs';
import { Database } from 'bun:sqlite';
import { validateReadOnlySql } from './query-guard.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const MAX_QUERY_ROWS = 500;

function loadDatabaseSchema(dbPath) {
  return withReadOnlyDatabase(dbPath, (db) => {
    const databaseStat = safeStat(dbPath);
    const pageSize = pragmaSingleValue(db, 'page_size') || 0;
    const pageCount = pragmaSingleValue(db, 'page_count') || 0;
    const freelistCount = pragmaSingleValue(db, 'freelist_count') || 0;
    const encoding = pragmaSingleValue(db, 'encoding') || 'unknown';

    const schemaRows = db.prepare(
      [
        'SELECT name, type, tbl_name AS tableName, sql',
        'FROM sqlite_schema',
        "WHERE type IN ('table', 'view', 'index', 'trigger')",
        "  AND name NOT LIKE 'sqlite_%'",
        'ORDER BY',
        "  CASE type WHEN 'table' THEN 0 WHEN 'view' THEN 1 WHEN 'index' THEN 2 WHEN 'trigger' THEN 3 ELSE 4 END,",
        '  lower(name)'
      ].join(' ')
    ).all();

    const tables = [];
    const views = [];
    const indexes = [];
    const triggers = [];

    for (const row of schemaRows) {
      if (row.type === 'table') {
        tables.push({
          name: row.name,
          type: row.type,
          sql: row.sql || '',
          columns: readTableColumns(db, row.name),
          indexes: readIndexList(db, row.name),
          foreignKeys: readForeignKeys(db, row.name)
        });
        continue;
      }

      if (row.type === 'view') {
        views.push({
          name: row.name,
          type: row.type,
          sql: row.sql || '',
          columns: readViewColumns(db, row.name)
        });
        continue;
      }

      if (row.type === 'index') {
        indexes.push({
          name: row.name,
          type: row.type,
          tableName: row.tableName,
          sql: row.sql || '',
          columns: readIndexColumns(db, row.name)
        });
        continue;
      }

      if (row.type === 'trigger') {
        triggers.push({
          name: row.name,
          type: row.type,
          tableName: row.tableName,
          sql: row.sql || ''
        });
      }
    }

    return {
      summary: {
        fileSizeBytes: databaseStat ? databaseStat.size : 0,
        mtimeMs: databaseStat ? databaseStat.mtimeMs : 0,
        modifiedAt: databaseStat ? new Date(databaseStat.mtimeMs).toISOString() : '',
        pageSize,
        pageCount,
        freelistCount,
        encoding,
        tables: tables.length,
        views: views.length,
        indexes: indexes.length,
        triggers: triggers.length,
        tableCount: tables.length,
        viewCount: views.length,
        indexCount: indexes.length,
        triggerCount: triggers.length
      },
      tables,
      views,
      indexes,
      triggers
    };
  });
}

function loadTableData(dbPath, relationName, options = {}) {
  const page = clampPositiveInteger(options.page, 1);
  const pageSize = clampPositiveInteger(options.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const filterText = typeof options.filter === 'string' ? options.filter.trim() : '';
  const sortOrder = String(options.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  return withReadOnlyDatabase(dbPath, (db) => {
    const relation = getRelation(db, relationName);
    const columnMeta = readRelationColumns(db, relation.name, relation.type);
    const columnNames = columnMeta.map((column) => column.name).filter(Boolean);
    if (columnNames.length === 0) {
      return {
        page,
        pageSize,
        totalRows: 0,
        totalPages: 0,
        filterText,
        filter: filterText,
        sort: null,
        order: sortOrder.toLowerCase(),
        relation,
        objectName: relation.name,
        columns: [],
        rows: []
      };
    }

    let sortColumn = null;
    if (typeof options.sort === 'string' && options.sort.trim()) {
      const candidate = options.sort.trim();
      if (!columnNames.includes(candidate)) {
        throw new Error(`Unknown column for sorting: ${candidate}`);
      }
      sortColumn = candidate;
    }

    const where = buildFilterWhereClause(columnNames, filterText);
    const relationSql = quoteIdentifier(relation.name);
    const countSql = `SELECT COUNT(*) AS total FROM ${relationSql}${where.sql}`;
    const totalRow = db.prepare(countSql).get(...where.params);
    const totalRows = Number(totalRow && totalRow.total) || 0;
    const totalPages = totalRows === 0 ? 0 : Math.ceil(totalRows / pageSize);
    const currentPage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const offset = (currentPage - 1) * pageSize;

    const orderSql = sortColumn ? ` ORDER BY ${quoteIdentifier(sortColumn)} ${sortOrder}` : '';
    const dataSql =
      `SELECT * FROM ${relationSql}${where.sql}${orderSql} LIMIT ${pageSize} OFFSET ${offset}`;
    const stmt = db.prepare(dataSql);

    return {
      page: currentPage,
      pageSize,
      totalRows,
      totalPages,
      filterText,
      filter: filterText,
      sort: sortColumn,
      order: sortOrder.toLowerCase(),
      relation,
      objectName: relation.name,
      columns: columnMeta,
      rows: normalizeRowsAsObjects(columnMeta, stmt.values(...where.params).map(normalizeRowArray))
    };
  });
}

function executeReadOnlyQuery(dbPath, sql) {
  const normalizedSql = validateReadOnlySql(sql);

  return withReadOnlyDatabase(dbPath, (db) => {
    const start = Bun.nanoseconds();
    const stmt = db.prepare(normalizedSql);

    const columns = normalizeColumnMeta(stmt.columnNames);
    const allRows = stmt.values();
    const truncated = allRows.length > MAX_QUERY_ROWS;
    const rows = allRows.slice(0, MAX_QUERY_ROWS).map(normalizeRowArray);

    const end = Bun.nanoseconds();
    return {
      sql: normalizedSql,
      columns,
      rows: normalizeRowsAsObjects(columns, rows),
      rowCount: rows.length,
      truncated,
      maxRows: MAX_QUERY_ROWS,
      durationMs: (end - start) / 1e6,
      elapsedMs: (end - start) / 1e6
    };
  });
}

function withReadOnlyDatabase(dbPath, callback) {
  const db = new Database(dbPath, { readonly: true });
  try {
    return callback(db);
  } finally {
    db.close();
  }
}

function getRelation(db, relationName) {
  const name = typeof relationName === 'string' ? relationName.trim() : '';
  if (!name) {
    throw new Error('table query is required.');
  }

  const relation = db.prepare(
    [
      'SELECT name, type, sql',
      'FROM sqlite_schema',
      "WHERE type IN ('table', 'view')",
      "  AND name NOT LIKE 'sqlite_%'",
      '  AND name = ?',
      'LIMIT 1'
    ].join(' ')
  ).get(name);

  if (!relation) {
    throw new Error(`Table or view not found: ${name}`);
  }

  return {
    name: relation.name,
    type: relation.type,
    sql: relation.sql || ''
  };
}

function readRelationColumns(db, relationName, relationType) {
  if (relationType === 'view') {
    return readViewColumns(db, relationName);
  }
  return readTableColumns(db, relationName);
}

function readTableColumns(db, tableName) {
  const rows = db.prepare(`PRAGMA table_xinfo(${quoteSqlString(tableName)})`).all();
  return rows.map((row) => ({
    cid: row.cid,
    name: row.name,
    type: row.type || '',
    notNull: Boolean(row.notnull),
    defaultValue: row.dflt_value,
    primaryKeyIndex: row.pk || 0,
    hidden: row.hidden || 0
  }));
}

function readViewColumns(db, viewName) {
  const stmt = db.prepare(`SELECT * FROM ${quoteIdentifier(viewName)} LIMIT 0`);
  stmt.all();
  return (stmt.columnNames || []).map((name, index) => ({
    cid: index,
    name: name || `column_${index + 1}`,
    type: '',
    notNull: false,
    defaultValue: null,
    primaryKeyIndex: 0,
    hidden: 0
  }));
}

function readIndexList(db, tableName) {
  const rows = db.prepare(`PRAGMA index_list(${quoteSqlString(tableName)})`).all();
  return rows.map((row) => ({
    name: row.name,
    unique: Boolean(row.unique),
    origin: row.origin,
    partial: Boolean(row.partial),
    columns: readIndexColumns(db, row.name)
  }));
}

function readIndexColumns(db, indexName) {
  const rows = db.prepare(`PRAGMA index_xinfo(${quoteSqlString(indexName)})`).all();
  return rows
    .filter((row) => Boolean(row.key))
    .map((row) => {
      if (row.name) {
        return row.name;
      }
      if (row.cid === -1) {
        return '(rowid)';
      }
      return '(expression)';
    });
}

function readForeignKeys(db, tableName) {
  const rows = db.prepare(`PRAGMA foreign_key_list(${quoteSqlString(tableName)})`).all();
  return rows.map((row) => ({
    id: row.id,
    seq: row.seq,
    table: row.table,
    from: row.from,
    to: row.to,
    onUpdate: row.on_update,
    onDelete: row.on_delete,
    match: row.match
  }));
}

function buildFilterWhereClause(columnNames, filterText) {
  if (!filterText || columnNames.length === 0) {
    return { sql: '', params: [] };
  }

  const likeValue = `%${escapeLikePattern(filterText)}%`;
  const clauses = columnNames.map((columnName) => `CAST(${quoteIdentifier(columnName)} AS TEXT) LIKE ? ESCAPE '\\'`);
  return {
    sql: ` WHERE ${clauses.join(' OR ')}`,
    params: new Array(columnNames.length).fill(likeValue)
  };
}

function escapeLikePattern(value) {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

function normalizeColumnMeta(columnNames) {
  return (columnNames || []).map((name, index) => ({
    cid: index,
    name: name || `column_${index + 1}`,
    type: '',
    sourceColumn: null,
    sourceTable: null,
    sourceDatabase: null
  }));
}

function normalizeRowArray(row) {
  return Array.isArray(row) ? row.map(normalizeValue) : [];
}

function normalizeRowsAsObjects(columns, rows) {
  const columnList = Array.isArray(columns) ? columns : [];
  return (Array.isArray(rows) ? rows : []).map((row) => {
    if (!Array.isArray(row)) {
      return row;
    }

    const output = {};
    for (let index = 0; index < columnList.length; index += 1) {
      const column = columnList[index];
      const name = column && column.name ? column.name : `column_${index + 1}`;
      output[name] = row[index];
    }
    return output;
  });
}

function normalizeValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return `[blob ${value.byteLength} bytes]`;
  }

  if (value instanceof ArrayBuffer) {
    return `[blob ${value.byteLength} bytes]`;
  }

  return String(value);
}

function pragmaSingleValue(db, pragmaName) {
  const row = db.prepare(`PRAGMA ${pragmaName}`).get();
  if (!row || typeof row !== 'object') {
    return null;
  }
  const values = Object.values(row);
  return values.length === 0 ? null : values[0];
}

function safeStat(targetPath) {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

function clampPositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  if (Number.isInteger(max) && parsed > max) {
    return max;
  }

  return parsed;
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function quoteSqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_QUERY_ROWS,
  executeReadOnlyQuery,
  loadDatabaseSchema,
  loadTableData
};
