import fs from 'node:fs';
import path from 'node:path';

function resolveRoot(cwd, cliRoot) {
  const fallback = path.resolve(cwd);
  if (!cliRoot) {
    return fs.realpathSync(fallback);
  }

  const preferred = path.resolve(cwd, cliRoot);
  if (!isReadableDir(preferred)) {
    throw new Error(`Provided root is not a readable directory: ${preferred}`);
  }

  return fs.realpathSync(preferred);
}

function isReadableDir(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function normalizeRelativePath(inputPath) {
  if (typeof inputPath !== 'string') {
    throw new Error('Path must be a string.');
  }

  const trimmed = inputPath.trim();
  if (!trimmed) {
    throw new Error('Path is required.');
  }

  if (trimmed.includes('\u0000')) {
    throw new Error('Invalid path.');
  }

  const unified = trimmed.replace(/\\/g, '/');
  if (unified.startsWith('/')) {
    throw new Error('Absolute path is not allowed.');
  }

  const normalized = path.posix.normalize(unified);
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error('Path escapes root.');
  }

  return normalized;
}

function resolvePathInRoot(rootRealPath, relativePath) {
  const normalizedRelative = normalizeRelativePath(relativePath);
  const absolute = path.resolve(rootRealPath, normalizedRelative);
  const targetForCheck = fs.existsSync(absolute) ? fs.realpathSync(absolute) : absolute;

  if (!isInsideRoot(rootRealPath, targetForCheck)) {
    throw new Error('Path escapes root.');
  }

  return { normalizedRelative, absolute };
}

function isInsideRoot(rootRealPath, targetPath) {
  const relative = path.relative(rootRealPath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export {
  isInsideRoot,
  normalizeRelativePath,
  resolvePathInRoot,
  resolveRoot
};
