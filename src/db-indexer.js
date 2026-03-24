import fs from 'node:fs/promises';
import path from 'node:path';

const SKIP_DIR_NAMES = new Set(['.git', '.idea', '.vscode', 'dist', 'node_modules']);

async function listDatabaseFiles(rootRealPath) {
  const output = [];
  await walk(rootRealPath, rootRealPath, output);
  output.sort((a, b) => a.localeCompare(b));
  return output;
}

async function describeDatabaseFiles(rootRealPath) {
  const files = await listDatabaseFiles(rootRealPath);
  const entries = await Promise.all(
    files.map(async (relativePath) => {
      const absolutePath = path.join(rootRealPath, relativePath);
      const stat = await fs.stat(absolutePath);

      return {
        path: relativePath,
        name: path.basename(relativePath),
        directory: path.dirname(relativePath) === '.' ? '' : path.dirname(relativePath).split(path.sep).join('/'),
        sizeBytes: stat.size,
        mtimeMs: stat.mtimeMs,
        modifiedAt: new Date(stat.mtimeMs).toISOString()
      };
    })
  );

  return entries;
}

async function walk(rootRealPath, currentDir, output) {
  let entries;

  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolute = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIR_NAMES.has(entry.name)) {
        await walk(rootRealPath, absolute, output);
      }
      continue;
    }

    if (!entry.isFile() || !isDatabaseFileName(entry.name)) {
      continue;
    }

    output.push(path.relative(rootRealPath, absolute).split(path.sep).join('/'));
  }
}

function isDatabaseFileName(fileName) {
  return typeof fileName === 'string' && fileName.toLowerCase().endsWith('.db');
}

export {
  describeDatabaseFiles,
  listDatabaseFiles
};
