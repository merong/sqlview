const ALLOWED_START_TOKENS = new Set(['select', 'with', 'explain']);
const FORBIDDEN_KEYWORDS = [
  'alter',
  'analyze',
  'attach',
  'begin',
  'commit',
  'create',
  'delete',
  'detach',
  'drop',
  'insert',
  'load_extension',
  'merge',
  'pragma',
  'reindex',
  'release',
  'replace',
  'rollback',
  'savepoint',
  'transaction',
  'update',
  'upsert',
  'vacuum'
];

function validateReadOnlySql(sql) {
  if (typeof sql !== 'string') {
    throw new Error('SQL must be a string.');
  }

  if (sql.includes('\u0000')) {
    throw new Error('SQL contains invalid characters.');
  }

  const { skeleton } = buildSqlSkeleton(sql);
  const trimmedSkeleton = skeleton.trim();

  if (!trimmedSkeleton) {
    throw new Error('SQL is required.');
  }

  const firstSemicolonIndex = skeleton.indexOf(';');
  let normalizedSql = sql.trim();
  if (firstSemicolonIndex >= 0) {
    const remainingSkeleton = skeleton.slice(firstSemicolonIndex + 1).trim();
    if (remainingSkeleton) {
      throw new Error('Multiple statements are not allowed.');
    }
    normalizedSql = sql.slice(0, firstSemicolonIndex).trim();
  }

  const normalizedSkeleton = normalizeSkeletonForChecks(skeleton, firstSemicolonIndex);
  const startMatch = normalizedSkeleton.match(/^([a-z]+)/);
  if (!startMatch) {
    throw new Error('SQL must start with SELECT, WITH, or EXPLAIN QUERY PLAN.');
  }

  const firstToken = startMatch[1];
  if (!ALLOWED_START_TOKENS.has(firstToken)) {
    throw new Error('Only SELECT, WITH, or EXPLAIN QUERY PLAN statements are allowed.');
  }

  if (firstToken === 'explain' && !/^explain\s+query\s+plan\b/.test(normalizedSkeleton)) {
    throw new Error('Only EXPLAIN QUERY PLAN is allowed.');
  }

  const forbiddenPattern = new RegExp(`\\b(${FORBIDDEN_KEYWORDS.join('|')})\\b`, 'i');
  const match = normalizedSkeleton.match(forbiddenPattern);
  if (match) {
    throw new Error(`Blocked keyword in read-only mode: ${match[1].toUpperCase()}`);
  }

  return normalizedSql;
}

function buildSqlSkeleton(sql) {
  let mode = 'normal';
  let output = '';

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (mode === 'normal') {
      if (char === '\'' ) {
        output += ' ';
        mode = 'single-quote';
        continue;
      }

      if (char === '"') {
        output += ' ';
        mode = 'double-quote';
        continue;
      }

      if (char === '[') {
        output += ' ';
        mode = 'bracket-ident';
        continue;
      }

      if (char === '`') {
        output += ' ';
        mode = 'backtick-ident';
        continue;
      }

      if (char === '-' && next === '-') {
        output += '  ';
        index += 1;
        mode = 'line-comment';
        continue;
      }

      if (char === '/' && next === '*') {
        output += '  ';
        index += 1;
        mode = 'block-comment';
        continue;
      }

      output += char.toLowerCase();
      continue;
    }

    if (mode === 'single-quote') {
      output += ' ';
      if (char === '\'' && next === '\'') {
        output += ' ';
        index += 1;
        continue;
      }
      if (char === '\'') {
        mode = 'normal';
      }
      continue;
    }

    if (mode === 'double-quote') {
      output += ' ';
      if (char === '"' && next === '"') {
        output += ' ';
        index += 1;
        continue;
      }
      if (char === '"') {
        mode = 'normal';
      }
      continue;
    }

    if (mode === 'bracket-ident') {
      output += ' ';
      if (char === ']') {
        mode = 'normal';
      }
      continue;
    }

    if (mode === 'backtick-ident') {
      output += ' ';
      if (char === '`') {
        mode = 'normal';
      }
      continue;
    }

    if (mode === 'line-comment') {
      output += /\r|\n/.test(char) ? char : ' ';
      if (char === '\n') {
        mode = 'normal';
      }
      continue;
    }

    if (mode === 'block-comment') {
      output += /\r|\n/.test(char) ? char : ' ';
      if (char === '*' && next === '/') {
        output += ' ';
        index += 1;
        mode = 'normal';
      }
    }
  }

  return { skeleton: output };
}

function normalizeSkeletonForChecks(skeleton, firstSemicolonIndex) {
  const subject = firstSemicolonIndex >= 0 ? skeleton.slice(0, firstSemicolonIndex) : skeleton;
  return subject.trim().replace(/\s+/g, ' ');
}

export { validateReadOnlySql };
