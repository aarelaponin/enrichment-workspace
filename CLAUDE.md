# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Joget DX 8.1.6 OSGi plugin (Java 11, Maven) that provides a **custom Userview menu plugin** (`UserviewMenu`) for the F01.05 manual enrichment workspace. Renders a rich single-page UI entirely from `getRenderPage()` — transaction table, filters, pagination, inline editing, split/merge actions, and reconciliation display.

Companion plugin: `enrichment-api` (sibling directory) provides the REST backend. This plugin is UI-only and never writes to the database directly.

## Build

```bash
mvn clean package
```

Output: `target/enrichment-workspace-8.1.0-SNAPSHOT.jar`

**Prerequisites:** `wflow-core:8.1-SNAPSHOT` must be in local Maven repo. Build jw-community first if missing:
```bash
cd /path/to/jw-community && mvn clean install -DskipTests
```

## Deploy

Upload the JAR via **Joget → Settings → Manage Plugins → Upload Plugin**, then add "Enrichment Workspace" to a Userview from the Custom palette category.

## Architecture

### Plugin classes

- **`EnrichmentWorkspaceMenu.java`** — extends `UserviewMenu`, overrides `getRenderPage()` which delegates to a FreeMarker template (`enrichmentWorkspace.ftl`). Injects server-side config (API credentials, version) into the template model.
- **`EnrichmentWorkspaceResources.java`** — extends `ExtDefaultPlugin`, implements `PluginWebSupport`. Serves static CSS/JS files from the classpath with aggressive immutable caching (`Cache-Control: max-age=31536000, immutable` when `?v=` param present).
- **`Activator.java`** — standard OSGi `BundleActivator` that registers both plugins as services.

### Rendering pattern

UI is built from external files, not inline Java strings:
- **FreeMarker template** (`templates/enrichmentWorkspace.ftl`) — HTML structure, injects `window.EW_CONFIG`, loads CSS/JS via `EnrichmentWorkspaceResources`
- **CSS** (`static/css/ew-main.css`, `ew-detail.css`) — all styles
- **JS modules** (`static/js/ew-*.js`) — loaded in dependency order: config → api → toast → tabs → table → actions → detail → filters → main

The JavaScript communicates with `enrichment-api` via `fetch()` using API ID/Key passed from plugin properties into the `window.EW_CONFIG` → `EW` namespace.

### Key conventions

- **FreeMarker + external static files** — template for HTML structure, separate CSS/JS served via `EnrichmentWorkspaceResources`
- **Version-based cache busting** — CSS/JS URLs include `?v=<VERSION>`. **Every JS/CSS change requires a VERSION bump** in `EnrichmentWorkspaceMenu.java`, otherwise browsers serve stale immutable-cached files.
- **Plugin properties** loaded from `/properties/enrichmentWorkspaceMenu.json` via `AppUtil.readPluginResource()`
- **CSS classes** prefixed with `ew-` (enrichment workspace), `st-` (status badges), `cf-` (confidence badges), `dc-` (debit/credit)
- **JavaScript namespace** uses `EW` object for state and sub-modules (`EW.api`, `EW.table`, `EW.detail`, etc.); global functions prefixed with `EW_` for onclick handlers in dynamic HTML
- **Boolean-like fields** in the database use lowercase `"yes"/"no"`, not `"Y"/"N"` — select options must match

### Resource directories

```
src/main/resources/
  properties/    → plugin property JSON (enrichmentWorkspaceMenu.json)
  messages/      → i18n .properties files
  static/css/    → ew-main.css (table, filters, toolbar), ew-detail.css (slide-over, edit inputs, toasts)
  static/js/     → 9 JS modules (ew-config, ew-api, ew-toast, ew-tabs, ew-table, ew-actions, ew-detail, ew-filters, ew-main)
  templates/     → enrichmentWorkspace.ftl (FreeMarker template)
```

### Companion plugin interaction

The enrichment-workspace UI calls `enrichment-api` REST endpoints at `/jw/api/enrichment/`. API authentication uses `api_id` and `api_key` headers, configured via the plugin's "API Connection" property group.

### Joget API Builder routing limitations (critical)

These are hard-won lessons from Phase 2–3 development:

1. **Path variable routing is broken.** `GET /records/{id}`, `PUT /records/{id}`, and any sub-path like `POST /records/save` or `POST /records/confirm` return Joget framework 400. The `/records/{id}` pattern greedily matches all `/records/*` paths.
2. **Joget is method-agnostic.** `@Operation(type = MethodType.GET)` also responds to POST requests. The `type` field is effectively documentation-only.
3. **New `@Operation` methods are NOT detected after JAR redeployment.** Only operations registered when the API Builder was first configured are routed. Adding a new `@Operation` method and redeploying the JAR does not make it available.
4. **Workaround: piggyback on existing endpoints.** The save operation uses `GET /records?save=<json>` — an extra `@Param` on the existing `records()` method. This avoids both the path collision and the new-operation detection issue.
5. **Detail panel uses cached records.** Since `GET /records/{id}` doesn't work, the detail panel receives its record data from the table's in-memory cache (`EW.state.records`), not from a separate API call.

## Development Phases

The plugin is being built incrementally. See `docs/enrichment-workspace-specification.md` for the full spec and `../DEV-PLAN.md` for the step-by-step plan. Current state: Phase 3 complete (inline editing + save).

| Phase | Summary | Status |
|-------|---------|--------|
| 0 | Static "plugin loaded" page | Done |
| 1 | Load & display F01.05 records as HTML table via API | Done |
| 2 | Detail panel (click row → side panel) | Done |
| 3 | Inline editing + save | Done |
| 4 | Status actions (mark ready, reprocess, return to editing) | |
| 5 | Confirm for posting | |
| 6 | Split & merge flows | |
| 7 | Reconciliation panel | |
| 8 | Port prototype CSS/UX polish (match `docs/enrichment-workspace-ui.html`) | |

## Reference Files

- `docs/enrichment-workspace-specification.md` — full UI specification (views, forms, actions, validation)
- `docs/enrichment-api-specification.md` — REST API contract (endpoints, request/response schemas)
- `docs/enrichment-workspace-ui.html` — HTML/React prototype of the target UI
- `../DEV-PLAN.md` — cross-plugin development plan with testable steps
