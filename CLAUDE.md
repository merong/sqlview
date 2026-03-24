# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**sqlview** — 로컬 전용, 읽기 전용 SQLite 브라우저. 디렉토리 내 `.db` 파일을 재귀 탐색하고, `127.0.0.1`에서 웹 UI를 제공하여 스키마 검사, 테이블 데이터 조회, 안전한 읽기 전용 쿼리를 실행할 수 있다.

- Bun 1.2+ 필수 (built-in `bun:sqlite` 모듈 사용)
- 외부 런타임 의존성 없음
- `bun build --compile`로 단일 바이너리 빌드 지원

## Commands

```bash
bun install              # 의존성 설치
bun start                # 서버 시작 (기본 포트 18095, 데몬 모드)
bun run build            # 단일 바이너리 빌드 → dist/sqlview, ~/bin/sqlview 설치
```

개발 시 foreground 모드로 실행:
```bash
bun src/server.js --foreground --root ./fixtures
```

테스트 DB 재생성:
```bash
bun scripts/generate-sample-dbs.js
```

## Architecture

순수 Bun ESM 프로젝트. 프레임워크 없이 `Bun.serve()`, `bun:sqlite` 내장 모듈만 사용.

### Source Modules (`src/`)

| 모듈 | 역할 |
|---|---|
| `server.js` | Bun.serve() HTTP 서버, CLI 파싱, 데몬화, API 라우팅 (엔트리포인트) |
| `db-indexer.js` | root 디렉토리에서 `.db` 파일을 재귀 탐색하여 목록 반환 |
| `path-guard.js` | 경로 정규화 및 디렉토리 탈출 방지 (path traversal 차단) |
| `query-guard.js` | SQL 문자열을 skeleton으로 파싱하여 SELECT/WITH/EXPLAIN QUERY PLAN만 허용 |
| `sqlite-inspector.js` | `bun:sqlite` Database로 스키마 조회, 테이블 데이터 페이징, 읽기 전용 쿼리 실행 |

### API Endpoints

- `GET /` — 인라인 HTML 뷰어
- `GET /api/info` — 서버 설정 정보
- `GET /api/databases` — 발견된 .db 파일 목록
- `GET /api/schema?db=<path>` — 특정 DB의 전체 스키마
- `GET /api/table?db=<path>&table=<name>` — 테이블 데이터 (페이징, 정렬, 필터)
- `POST /api/query` — 읽기 전용 SQL 실행 (`{ dbPath, sql }`)
- `GET/POST /api/comments` — 테이블/컬럼 코멘트 관리

### Security Model

- `path-guard.js`: 모든 DB 경로를 root 내부로 제한 (symlink 해석 후 검증)
- `query-guard.js`: SQL skeleton 분석으로 쓰기 키워드 차단 — `bun:sqlite`의 `readonly: true` 와 이중 방어
- 서버는 `127.0.0.1`에만 바인드 (외부 접근 불가)
- `.db` 확장자 파일만 접근 허용

### Build (`scripts/build.ts`)

1. Vite로 프론트엔드 빌드 → `frontend/dist/`
2. 프론트엔드 에셋을 `src/embedded-assets.js`로 자동 생성 (base64 인코딩)
3. `bun build --compile --minify` → `dist/sqlview` 단일 바이너리
4. `~/bin/sqlview`에 설치
5. 빌드 후 `src/embedded-assets.js` 정리

### Frontend (`frontend/`)

React 19 + Vite + Tailwind CSS 4 + shadcn/ui 기반 SPA. 개발 시 Vite dev server가 API를 백엔드로 프록시.

### Test Fixtures (`fixtures/`)

`generate-sample-dbs.js`로 생성되는 샘플 DB: `sample_shop.db` (고객/상품/주문), `sample_blog.db` (작성자/게시글/댓글/태그).
