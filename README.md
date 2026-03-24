*Read this in other languages: [한국어](README-ko.md)*

# sqlview

`sqlview` is a local, read-only SQLite browser for terminal-first workflows.
Run it in a directory that contains `.db` files, and it opens a web UI on `127.0.0.1` to inspect schemas, browse table data, and execute safe read-only queries.

## Screenshots

### Database Overview
![Database Overview](./sqlview1.png)

### Schema Browser
![Schema Browser](./sqlview2.png)

### Data Grid
![Data Grid](./sqlview3.png)

## Documentation
- Contributor Guide: [CLAUDE.md](./CLAUDE.md)

## Project Purpose
This project is designed for developers who work primarily in the terminal and need a quick way to inspect SQLite databases without leaving their workflow.

- Browse schemas for tables, views, indexes, and triggers with full DDL
- Page through row data with column sorting and text filtering
- Run safe `SELECT`, `WITH`, and `EXPLAIN QUERY PLAN` queries
- Keep everything local and private (server binds to `127.0.0.1`)
- Add table and column comments to document your databases

Default scan behavior:
- Recursive `.db` discovery from the current directory (or `--root`)
- Directories like `.git`, `node_modules`, `dist` are skipped

## Key Features
- Recursive `.db` file discovery from any root directory
- Web UI with database list, schema browser, and data grid
- Read-only query runner with SQL validation (write keywords blocked)
- Table/column comment system persisted in `.sqlview/comments.json`
- Foreground/background (daemon) execution modes
- Single executable build with `bun build --compile`

## Requirements
- [Bun](https://bun.sh/) 1.2+

`sqlview` uses the built-in `bun:sqlite` module. No external runtime dependencies.

## Development Run
```bash
bun install
cd frontend && bun install && cd ..
bun src/server.js --foreground --root ./fixtures
```
Open `http://127.0.0.1:18095`.

Useful options:
```bash
# Scan a specific root recursively
bun src/server.js --foreground --root ./my-databases

# Change the HTTP port
bun src/server.js --foreground --port 18096
```

For frontend development (with HMR):
```bash
# Terminal 1: backend
bun src/server.js --foreground --root ./fixtures

# Terminal 2: frontend dev server (proxies /api to backend)
cd frontend && bun run dev
```

## Build
```bash
bun run build
```
Build output:
- macOS/Linux: `dist/sqlview`
- Windows: `dist/sqlview.exe`

The build script compiles the frontend (React + Vite), embeds all assets into the binary, and produces a single standalone executable via `bun build --compile`.

## Install

### macOS / Linux

1. Build and copy to your preferred location:
```bash
bun run build
mkdir -p "$HOME/bin"
cp dist/sqlview "$HOME/bin/sqlview"
```

2. Add the install directory to PATH (one-time setup):

**zsh** (default on macOS):
```bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**bash**:
```bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

3. Verify:
```bash
which sqlview
sqlview --help
```

### Windows

1. Build:
```powershell
bun run build
```

2. Copy `dist\sqlview.exe` to your preferred location, for example `C:\Users\<you>\bin\`:
```powershell
mkdir "$env:USERPROFILE\bin" -Force
copy dist\sqlview.exe "$env:USERPROFILE\bin\sqlview.exe"
```

3. Add the install directory to PATH:

**PowerShell** (permanent, user-level):
```powershell
$binPath = "$env:USERPROFILE\bin"
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$binPath*") {
    [Environment]::SetEnvironmentVariable("Path", "$binPath;$currentPath", "User")
}
```
Restart the terminal for the change to take effect.

**CMD** (permanent, user-level):
```cmd
setx PATH "%USERPROFILE%\bin;%PATH%"
```
Restart the terminal for the change to take effect.

4. Verify:
```powershell
where.exe sqlview
sqlview --help
```

## Typical Usage
```bash
# From any project directory
sqlview

# Use a specific root and port
sqlview --root ./data --port 18096

# Run in foreground (no daemon)
sqlview --foreground
```

## CLI
```
sqlview [--port <port>] [--root <path>] [--foreground] [--daemon] [--help]
```

| Option | Default | Description |
|---|---|---|
| `--root <path>` | current directory | Root directory to scan for `.db` files |
| `--port <port>` | `18095` | HTTP port |
| `--foreground` | off | Run in the current terminal |
| `--daemon` | on | Run in the background and open browser |
| `--help` | | Show usage |

## Security
- Binds to `127.0.0.1` only (no remote access)
- Database files opened with `readonly: true`
- SQL validation blocks write keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, etc.)
- Path traversal protection prevents access outside the root

## Project Structure
- `src/`: server, SQLite inspector, path/query guards, file indexer
- `frontend/`: React 19 + Vite + Tailwind CSS 4 + shadcn/ui
- `scripts/`: build script (`bun build --compile` packaging), fixture generator
- `fixtures/`: sample databases for development
- `dist/`: generated build artifacts
