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

### Single-class plugin

The entire plugin is effectively one file:

- **`EnrichmentWorkspaceMenu.java`** — extends `UserviewMenu`, overrides `getRenderPage()` to return a complete HTML page (CSS + HTML + JavaScript) built via `StringBuilder`. No JSP, no FreeMarker templates — this avoids OSGi classloader issues.
- **`Activator.java`** — standard OSGi `BundleActivator` that registers `EnrichmentWorkspaceMenu` as a service.

### Rendering pattern

All UI is generated as a single HTML string from Java:
- `getStyles()` → inline `<style>` block
- `getRenderPage()` → HTML structure (header, filters, table, pagination)
- `getJavaScript()` → inline `<script>` with vanilla JS (no jQuery dependency for the table logic)

The JavaScript communicates with `enrichment-api` via `fetch()` using API ID/Key passed from plugin properties into the `EW` config object.

### Key conventions

- **No FreeMarker** — raw `StringBuilder` HTML to avoid OSGi classloader issues
- **HTML escaping** via `escHtml()`, **JS escaping** via `escJs()` — both are static utility methods on the menu class
- **Plugin properties** are defined inline in `getPropertyOptions()` (JSON string), not loaded from the JSON file in `src/main/resources/properties/`
- **CSS classes** prefixed with `ew-` (enrichment workspace), `st-` (status badges), `cf-` (confidence badges), `dc-` (debit/credit)
- **JavaScript namespace** uses `EW` object for state; global functions prefixed with `EW_` for onclick handlers in dynamic HTML

### Resource directories

```
src/main/resources/
  properties/    → plugin property JSON (currently unused, properties are inline)
  messages/      → i18n .properties files
  static/        → CSS/JS files (planned for future phases)
  templates/     → (empty, reserved for future use)
```

### Companion plugin interaction

The enrichment-workspace UI calls `enrichment-api` REST endpoints at `/jw/api/enrichment/`. API authentication uses `api_id` and `api_key` headers, configured via the plugin's "API Connection" property group.

## Development Phases

The plugin is being built incrementally. See `docs/enrichment-workspace-specification.md` for the full spec and `../DEV-PLAN.md` for the step-by-step plan. Current state: Phase 1 (data table with API fetch).

| Phase | Summary |
|-------|---------|
| 0 | Static "plugin loaded" page |
| 1 | Load & display F01.05 records as HTML table via API ← **current** |
| 2 | Detail panel (click row → side panel) |
| 3 | Inline editing + save |
| 4 | Status actions (mark ready, reprocess, return to editing) |
| 5 | Confirm for posting |
| 6 | Split & merge flows |
| 7 | Reconciliation panel |
| 8 | Port prototype CSS/UX polish (match `docs/enrichment-workspace-ui.html`) |

## Reference Files

- `docs/enrichment-workspace-specification.md` — full UI specification (views, forms, actions, validation)
- `docs/enrichment-api-specification.md` — REST API contract (endpoints, request/response schemas)
- `docs/enrichment-workspace-ui.html` — HTML/React prototype of the target UI
- `../DEV-PLAN.md` — cross-plugin development plan with testable steps
