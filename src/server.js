#!/usr/bin/env bun
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { describeDatabaseFiles } from './db-indexer.js';
import { resolveRoot, resolvePathInRoot } from './path-guard.js';
import { executeReadOnlyQuery, loadDatabaseSchema, loadTableData, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MAX_QUERY_ROWS } from './sqlite-inspector.js';

const DEFAULT_PORT = 18095;
const HOST = '127.0.0.1';
const MAX_BODY_BYTES = 1024 * 1024;

let embeddedAssets = null;
try {
  const mod = await import('./embedded-assets.js');
  embeddedAssets = mod.assets;
} catch {
  // Dev mode — no embedded assets
}

async function main() {
  const cli = parseArgs(getCliArgs());
  maybeDaemonize(cli);

  const cwd = process.cwd();
  const rootRealPath = resolveRoot(cwd, cli.root);
  const rootDisplayPath = makeDisplayPath(cwd, rootRealPath);

  const context = { cwd, rootRealPath, rootDisplayPath };

  killExistingPortListeners(cli.port);

  const server = Bun.serve({
    hostname: HOST,
    port: cli.port,
    async fetch(req) {
      try {
        return await handleRequest(req, context);
      } catch (error) {
        const statusCode = Number.isInteger(error && error.statusCode) ? error.statusCode : 500;
        return Response.json(
          { success: false, message: error.message || 'Internal server error' },
          { status: statusCode, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    },
  });

  const viewerUrl = `http://${HOST}:${server.port}`;
  process.stdout.write(
    [
      `sqlview listening on ${viewerUrl}`,
      `Root: ${rootRealPath}`,
      'Scan: recursive .db under root',
      'Mode: read-only',
      'Press Ctrl+C to stop.'
    ].join('\n') + '\n'
  );

  openBrowser(viewerUrl);
  installShutdownHandlers(server);
}

function resolveDistDir() {
  const candidates = [
    path.join(import.meta.dirname, '..', 'frontend', 'dist'),
    path.join(import.meta.dirname, '..', 'dist-frontend'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
  }
  return null;
}

function loadFrontendFile(relativePath) {
  if (embeddedAssets) {
    const data = embeddedAssets.get(relativePath);
    if (data) return new Uint8Array(data);
    return null;
  }

  const distDir = resolveDistDir();
  if (!distDir) return null;
  const resolved = path.resolve(distDir, relativePath);
  if (!resolved.startsWith(distDir)) return null;
  try { return fs.readFileSync(resolved); } catch { return null; }
}

function getCliArgs() {
  // In dev mode: bun src/server.js [args...] → argv[1] is script path
  // In compiled mode: ./sqlview [args...] → argv[1] is /$bunfs/root/... virtual path
  const scriptArg = process.argv[1];
  if (scriptArg && (/\.[jt]sx?$/.test(scriptArg) || scriptArg.startsWith('/$bunfs/'))) {
    return process.argv.slice(2);
  }
  return process.argv.slice(1);
}

function parseArgs(argv) {
  let port = DEFAULT_PORT;
  let root = null;
  let daemon = true;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      printHelpAndExit(0);
    }

    if (arg === '--port') {
      const value = argv[index + 1];
      if (!value) {
        printHelpAndExit(1, '--port requires a value.');
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
        printHelpAndExit(1, 'Port must be an integer between 1 and 65535.');
      }
      port = parsed;
      index += 1;
      continue;
    }

    if (arg === '--root') {
      const value = argv[index + 1];
      if (!value) {
        printHelpAndExit(1, '--root requires a value.');
      }
      root = value;
      index += 1;
      continue;
    }

    if (arg === '--daemon') {
      daemon = true;
      continue;
    }

    if (arg === '--foreground') {
      daemon = false;
      continue;
    }

    printHelpAndExit(1, `Unknown argument: ${arg}`);
  }

  return { port, root, daemon };
}

function printHelpAndExit(code, message) {
  if (message) {
    process.stderr.write(`${message}\n\n`);
  }

  process.stdout.write(
    [
      'Usage: sqlview [--port <port>] [--root <path>]',
      '',
      'Options:',
      '  --port <port>   HTTP port (default: 18095)',
      '  --root <path>   Root directory to scan recursively for .db files',
      '  --daemon        Run in background mode (default).',
      '  --foreground    Run in current terminal process.',
      '  --help          Show this help.'
    ].join('\n') + '\n'
  );

  process.exit(code);
}

function makeDisplayPath(cwd, rootRealPath) {
  const relative = path.relative(cwd, rootRealPath);
  if (!relative) {
    return '.';
  }
  return relative.split(path.sep).join('/');
}

async function handleRequest(req, context) {
  const requestUrl = new URL(req.url);
  const pathname = requestUrl.pathname;

  if (req.method === 'GET' && pathname === '/') {
    const html = loadFrontendFile('index.html');
    if (html) {
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    }
    return Response.json(
      { success: false, message: 'Frontend not built. Run: cd frontend && bun run build' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (req.method === 'GET' && pathname === '/api/info') {
    return jsonResponse({
      success: true,
      root: context.rootRealPath,
      rootDisplayPath: context.rootDisplayPath,
      defaults: {
        pageSize: DEFAULT_PAGE_SIZE,
        maxPageSize: MAX_PAGE_SIZE,
        maxQueryRows: MAX_QUERY_ROWS
      }
    });
  }

  if (req.method === 'GET' && pathname === '/api/databases') {
    const databases = await describeDatabaseFiles(context.rootRealPath);
    return jsonResponse({
      success: true,
      root: context.rootRealPath,
      count: databases.length,
      databases
    });
  }

  if (req.method === 'GET' && pathname === '/api/schema') {
    const dbPath = requireDbPath(requestUrl, context.rootRealPath);
    let schema;
    try {
      schema = loadDatabaseSchema(dbPath.absolute);
    } catch (error) {
      throw createHttpError(400, error.message);
    }
    return jsonResponse({
      success: true,
      database: {
        path: dbPath.normalizedRelative,
        absolutePath: dbPath.absolute,
        fileName: path.basename(dbPath.normalizedRelative),
        sizeBytes: schema.summary.fileSizeBytes,
        modifiedAt: schema.summary.modifiedAt,
        mtime: schema.summary.modifiedAt
      },
      ...schema
    });
  }

  if (req.method === 'GET' && pathname === '/api/table') {
    const dbPath = requireDbPath(requestUrl, context.rootRealPath);
    const tableName = requestUrl.searchParams.get('table');
    if (!tableName) {
      return jsonResponse({ success: false, message: 'table query is required.' }, 400);
    }

    let data;
    try {
      data = loadTableData(dbPath.absolute, tableName, {
        page: requestUrl.searchParams.get('page'),
        pageSize: requestUrl.searchParams.get('pageSize'),
        sort: requestUrl.searchParams.get('sort'),
        order: requestUrl.searchParams.get('order'),
        filter: requestUrl.searchParams.get('filter')
      });
    } catch (error) {
      throw createHttpError(400, error.message);
    }

    return jsonResponse({
      success: true,
      database: {
        path: dbPath.normalizedRelative,
        absolutePath: dbPath.absolute,
        fileName: path.basename(dbPath.normalizedRelative)
      },
      ...data
    });
  }

  if (req.method === 'POST' && pathname === '/api/query') {
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    const dbPath = requireDbPathFromBody(body, context.rootRealPath);
    let result;
    try {
      result = executeReadOnlyQuery(dbPath.absolute, body.sql);
    } catch (error) {
      throw createHttpError(400, error.message);
    }
    return jsonResponse({
      success: true,
      database: {
        path: dbPath.normalizedRelative,
        absolutePath: dbPath.absolute,
        fileName: path.basename(dbPath.normalizedRelative)
      },
      ...result
    });
  }

  if (req.method === 'GET' && pathname === '/api/comments') {
    const dbParam = requestUrl.searchParams.get('db');
    const allComments = loadComments(context.rootRealPath);
    if (dbParam) {
      return jsonResponse({
        success: true,
        database: dbParam,
        comments: allComments[dbParam] || { tables: {}, columns: {} }
      });
    }
    return jsonResponse({ success: true, comments: allComments });
  }

  if (req.method === 'POST' && pathname === '/api/comments') {
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    const dbParam = typeof body.db === 'string' ? body.db.trim() : '';
    const target = typeof body.target === 'string' ? body.target : '';
    const key = typeof body.key === 'string' ? body.key.trim() : '';
    const comment = typeof body.comment === 'string' ? body.comment : '';

    if (!dbParam || !key || (target !== 'table' && target !== 'column')) {
      throw createHttpError(400, 'Required: db, target (table|column), key, comment');
    }

    const allComments = loadComments(context.rootRealPath);
    if (!allComments[dbParam]) {
      allComments[dbParam] = { tables: {}, columns: {} };
    }

    const section = target === 'table' ? 'tables' : 'columns';
    if (comment) {
      allComments[dbParam][section][key] = comment;
    } else {
      delete allComments[dbParam][section][key];
    }

    saveComments(context.rootRealPath, allComments);
    return jsonResponse({
      success: true,
      database: dbParam,
      comments: allComments[dbParam]
    });
  }

  if (req.method === 'GET' && (pathname.startsWith('/assets/') || pathname === '/vite.svg' || pathname === '/favicon.ico')) {
    const filePath = pathname.slice(1);
    const content = loadFrontendFile(filePath);
    if (content !== null) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.ico': 'image/x-icon',
        '.woff2': 'font/woff2',
        '.woff': 'font/woff',
        '.json': 'application/json',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      return new Response(content, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        }
      });
    }
  }

  return jsonResponse({ success: false, message: 'Not found.' }, 404);
}

function jsonResponse(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  });
}

function requireDbPath(requestUrl, rootRealPath) {
  const pathParam = requestUrl.searchParams.get('db');
  if (!pathParam) {
    throw createHttpError(400, 'db query is required.');
  }
  return resolveDbPath(rootRealPath, pathParam);
}

function requireDbPathFromBody(body, rootRealPath) {
  const dbPath = body && typeof body.dbPath === 'string' ? body.dbPath : '';
  if (!dbPath) {
    throw createHttpError(400, 'dbPath is required.');
  }
  return resolveDbPath(rootRealPath, dbPath);
}

function resolveDbPath(rootRealPath, relativePath) {
  let resolved;
  try {
    resolved = resolvePathInRoot(rootRealPath, relativePath);
  } catch (error) {
    throw createHttpError(400, error.message);
  }

  if (!resolved.normalizedRelative.toLowerCase().endsWith('.db')) {
    throw createHttpError(400, 'Only .db files are allowed.');
  }

  let stat;
  try {
    stat = fs.statSync(resolved.absolute);
  } catch {
    throw createHttpError(404, 'Database file not found.');
  }

  if (!stat.isFile()) {
    throw createHttpError(404, 'Database file not found.');
  }

  return resolved;
}

async function readJsonBody(req, limitBytes) {
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > limitBytes) {
    throw createHttpError(413, 'Request body is too large.');
  }

  const text = await req.text();
  if (text.length > limitBytes) {
    throw createHttpError(413, 'Request body is too large.');
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return {};
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    throw createHttpError(400, 'Request body must be valid JSON.');
  }
}

function installShutdownHandlers(server) {
  const shutdown = () => {
    server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function maybeDaemonize(cli) {
  if (!cli.daemon) {
    return;
  }

  if (process.env.SQLVIEW_DAEMON_CHILD === '1') {
    return;
  }

  const childArgs = buildChildArgs(getCliArgs());
  const childEnv = { ...process.env, SQLVIEW_DAEMON_CHILD: '1' };
  const child = spawn(process.execPath, childArgs, {
    detached: true,
    stdio: 'ignore',
    env: childEnv
  });

  child.unref();
  process.stdout.write('sqlview daemon started in background.\n');
  process.exit(0);
}

function buildChildArgs(rawArgs) {
  const out = [];

  const scriptPath = process.argv[1];
  if (scriptPath && /\.[jt]sx?$/.test(scriptPath)) {
    out.push(scriptPath);
  }
  // In compiled mode (/$bunfs/...), no script path needed

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--daemon') {
      continue;
    }
    out.push(arg);
  }

  if (!out.includes('--foreground')) {
    out.push('--foreground');
  }

  return out;
}

function killExistingPortListeners(port) {
  if (!Number.isInteger(port) || port <= 0) {
    return;
  }

  const pids = findListeningPids(port).filter((pid) => pid !== process.pid);
  if (pids.length === 0) {
    return;
  }

  process.stdout.write(`Port ${port} is in use by PID ${pids.join(', ')}. Terminating...\n`);

  for (const pid of pids) {
    terminatePid(pid);
  }

  const remainingPids = findListeningPids(port).filter((pid) => pid !== process.pid);
  if (remainingPids.length > 0) {
    process.stderr.write(`Warning: port ${port} still in use after cleanup. Waiting...\n`);
    Bun.sleepSync(1000);
  }
}

function findListeningPids(port) {
  const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
    encoding: 'utf8'
  });

  if (result.error) {
    process.stderr.write(`Warning: failed to query port ${port}: ${result.error.message}\n`);
    return [];
  }

  if (result.status !== 0 && !result.stdout) {
    return [];
  }

  return String(result.stdout || '')
    .split(/\r?\n/)
    .map((line) => Number.parseInt(line.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function terminatePid(pid) {
  try {
    process.kill(pid, 'SIGTERM');
  } catch (error) {
    process.stderr.write(`Warning: failed to SIGTERM pid ${pid}: ${error.message}\n`);
    return;
  }

  if (waitForExit(pid, 800)) {
    return;
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch (error) {
    process.stderr.write(`Warning: failed to SIGKILL pid ${pid}: ${error.message}\n`);
    return;
  }

  waitForExit(pid, 800);
}

function waitForExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) {
      return true;
    }
    Bun.sleepSync(80);
  }
  return !isPidAlive(pid);
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function openBrowser(url) {
  if (process.platform !== 'darwin') {
    return;
  }

  try {
    const child = spawn('open', [url], {
      stdio: 'ignore',
      detached: true
    });
    child.on('error', (error) => {
      process.stderr.write(`Failed to run open command: ${error.message}\n`);
    });
    child.unref();
  } catch (error) {
    process.stderr.write(`Failed to run open command: ${error.message}\n`);
  }
}

function loadComments(rootRealPath) {
  const filePath = path.join(rootRealPath, '.sqlview', 'comments.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function saveComments(rootRealPath, comments) {
  const dir = path.join(rootRealPath, '.sqlview');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'comments.json');
  fs.writeFileSync(filePath, JSON.stringify(comments, null, 2), 'utf8');
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

main().catch((error) => {
  process.stderr.write(`Failed to start sqlview: ${error.message}\n`);
  process.exit(1);
});
