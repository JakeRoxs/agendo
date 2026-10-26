---
status: complete
priority: p2
issue_id: "052"
tags: [sonarqube, cli, code-quality, duplication, code-scanning]
dependencies: []
---

# SonarQube CLI duplication status & per-file code duplication scanning

## Problem Statement

Investigate the SonarQube CLI (`sonar`) for querying duplication status and evaluate implementing
code duplication detection as part of the per-file "code scanning" setting in Agendo.

## Findings

Duplication should be included **within** the standard per-file code scanning report, not as a
separate scan type. When a user runs a SonarQube code scan with file-based grouping (the default),
each file's duplication metrics should appear alongside its existing issues/violations.

### CLI Duplication Queries

The SonarQube CLI (v1.10.1) can query duplication data via `sonar api get`:

**Project-level duplication metrics (works):**
```bash
sonar api get "/api/measures/component?component=<project_key>&metricKeys=duplicated_lines_density,duplicated_blocks,duplicated_files,duplicated_lines"
```
Returns: `duplicated_lines_density` (%), `duplicated_lines` (count), `duplicated_blocks` (count), `duplicated_files` (count)

**File-level duplication metrics (works):**
```bash
sonar api get "/api/measures/component?component=<project_key>:<file_path>&metricKeys=duplicated_lines,duplicated_blocks,duplicated_lines_density"
```
Returns per-file: `duplicated_lines` (count), `duplicated_blocks` (count), `duplicated_lines_density` (%)

**Available duplication metrics** (via `GET api/metrics/search`):
- `duplicated_lines`, `duplicated_blocks`, `duplicated_files`, `duplicated_lines_density`
- `new_duplicated_lines`, `new_duplicated_blocks`, `new_duplicated_lines_density` (new code only)

Source: [SonarQube Community: REST API call to find code duplications](https://community.sonarsource.com/t/rest-api-call-to-find-code-duplications/16899/2)

**File duplication blocks (`/api/duplications/file`) — returns 404:**
```bash
sonar api get "/api/duplications/file?key=<project_key>:<file_path>"
```
This endpoint returns HTTP 404 on the current SonarQube instance. The MCP tool
`sonarqube_search_duplicated_files` works and returns a comprehensive list of duplicated files
with metrics, but uses an internal endpoint not directly accessible via the CLI.

### MCP Tool Alternative

The `sonarqube_search_duplicated_files` MCP tool returns:
- List of files with `duplicatedLines`, `duplicatedBlocks`, `duplicatedLinesDensity`
- Project summary with `totalDuplicatedLines`, `totalDuplicatedBlocks`, `overallDuplicationDensity`
- Supports pagination

### Existing Integration Pattern

The existing SonarQube integration in `src/todos/codeScanningService.ts`:
1. `fetchSonarQube(server, project, token, request?)` — uses `api/issues/search` endpoint
2. `fetchSonarQubeCli(cwd, server, project)` — wraps the above using `sonar api get` CLI command
3. Onboarding prompts user to choose between CLI and API auth (`sonar auth login` vs token entry)
4. Both paths converge on the same `request` function interface

### Recommended Approach

Duplication is part of the standard file-based code scan, not a separate import:

1. **Enhance `fetchSonarQube`** to include duplication metrics in each file's findings:
   - After fetching issues via `api/issues/search`, query `api/measures/component` for each file
     with `metricKeys=duplicated_lines,duplicated_lines_density`
   - Add a synthetic "duplication" finding per file exceeding a threshold (configurable, default ~5%)
   - Use the existing `ScanningFinding` structure with a rule like `sonarqube:duplicated_lines`
2. **Reuse CLI wrapper** — `fetchSonarQubeCli` already wraps `fetchSonarQube`, so duplication
   automatically works through CLI when selected during onboarding
3. **No new import mode needed** — duplication findings flow through the existing
   `importScanningFindings` with `grouping: "file"` (the default)

## Acceptance Criteria

- [x] Document SonarQube CLI and REST API duplication query commands and output formats
- [x] Evaluate feasibility of integrating duplication findings into per-file code scanning
- [x] Enhance `fetchSonarQube` to include file-level duplication metrics in the standard scan
- [x] Reuse existing SonarQube onboarding auth choice (CLI vs API) — duplication should follow whichever
  method the user already selected, not introduce a separate preference
- [x] Duplication findings appear in per-file scan output by default (file grouping is default)
- [x] Define duplication density threshold for creating findings (configurable, default 5%)
- [x] Record findings and recommended approach in this todo

## Technical Details

SonarQube CLI is installed at `~/.local/share/sonarqube-cli/bin/sonar` (v1.10.1).

**Working CLI commands:**
```bash
# List projects
sonar list projects

# Project-level duplication metrics
sonar api get "/api/measures/component?component=<project_key>&metricKeys=duplicated_lines_density,duplicated_blocks,duplicated_files,duplicated_lines"

# File-level duplication metrics
sonar api get "/api/measures/component?component=<project_key>:<file_path>&metricKeys=duplicated_lines,duplicated_blocks,duplicated_lines_density"

# Check CLI auth
sonar auth status
```

**Existing integration files:**
- `src/todos/codeScanningService.ts` — `fetchSonarQube`, `fetchSonarQubeCli`, `importScanningFindings`
- `src/commandRegistration.ts` — SonarQube onboarding prompt (`promptSonarQubeSettings`)

The `codeScanning` setting in `.agendo-config.json` is already enabled.

## Work Log

### 2026-10-26 - Todo created

**By:** Kilo

**Actions:**

- Created todo to investigate SonarQube CLI duplication queries
- Noted that `sonar` CLI v1.10.1 is installed and supports `api` subcommand
- Identified two relevant API endpoints: project metrics and per-file duplications
- Added requirement to support duplication imports via SonarQube REST API as an import source

### 2026-10-26 - Investigation

**By:** Kilo

**Actions:**

- Tested CLI duplication endpoints against live SonarQube instance
- Confirmed `/api/measures/component` works for project and file-level duplication metrics
- Found `/api/duplications/file` returns 404 on current instance
- Verified MCP `sonarqube_search_duplicated_files` tool works as alternative
- Examined existing SonarQube integration pattern in `codeScanningService.ts`
- Documented recommended approach: new fetcher following existing pattern with threshold filtering

**Learnings:**

- SonarQube API provides duplication metrics but the detailed block endpoint (`/api/duplications/file`)
  may not be available on all instances/versions
- MCP tools provide broader API access than direct CLI queries
- Existing integration architecture cleanly supports adding new fetcher types

### 2026-10-26 - Implementation

**By:** Kilo

**Actions:**

- Implemented duplication metrics fetching in `fetchSonarQube` — queries `api/measures/component` for each file with `metricKeys=duplicated_lines,duplicated_lines_density`
- Files with duplication density >= threshold (default 5%) generate a synthetic finding with rule `sonarqube:duplicated_lines`, severity MAJOR
- Duplication findings include the file path, duplicated line count, density percentage, and link to SonarQube duplications view
- Works through both direct API and CLI paths (CLI wrapper calls `fetchSonarQube`)
- Updated tests to account for new duplication metrics API calls
- All 313 tests pass

### 2026-10-26 - Requirements clarified

**By:** Kilo

**Actions:**

- Clarified that duplication should be included within the standard per-file code scanning report,
  not as a separate scan type or import
- Updated recommendation: enhance `fetchSonarQube` to query duplication metrics per file and include
  them alongside issues in the same scan
- Duplication findings flow through existing file-grouping import (the default grouping)
