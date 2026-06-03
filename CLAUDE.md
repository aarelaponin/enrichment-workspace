# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Joget DX 8.1 OSGi plugin (Java 11, Maven) that provides a **custom Userview menu plugin** (`UserviewMenu`) for the enrichment workspace — the primary back-office interface where users review, adjust, and approve enriched transactions before posting to GL, loan contracts, and investor portfolios.

Companion plugin: `enrichment-api` (sibling directory) provides the REST backend. **This plugin is UI-only and never writes to the database directly.** All mutations go through enrichment-api.

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
- **FreeMarker template** (`templates/enrichmentWorkspace.ftl`) — HTML structure with sidebar + main area, injects `window.EW_CONFIG`, loads CSS/JS via `EnrichmentWorkspaceResources`
- **CSS** (`static/css/ew-main.css`, `ew-detail.css`) — all styles
- **JS modules** (`static/js/ew-*.js`) — loaded in dependency order: config → api → toast → tabs → table → actions → detail → filters → main

The JavaScript communicates with `enrichment-api` via `fetch()` using API ID/Key passed from plugin properties into the `window.EW_CONFIG` → `EW` namespace.

### Key conventions

- **FreeMarker + external static files** — template for HTML structure, separate CSS/JS served via `EnrichmentWorkspaceResources`
- **Version-based cache busting** — CSS/JS URLs include `?v=<VERSION>`. **Every JS/CSS change requires a VERSION bump** in `EnrichmentWorkspaceMenu.java`, otherwise browsers serve stale immutable-cached files.
- **Plugin properties** loaded from `/properties/enrichmentWorkspaceMenu.json` via `AppUtil.readPluginResource()`
- **CSS classes** prefixed with `ew-` (enrichment workspace), `st-` (status badges), `cf-` (confidence badges), `dc-` (debit/credit), `ty-` (type badges)
- **JavaScript namespace** uses `EW` object for state and sub-modules (`EW.api`, `EW.table`, `EW.detail`, etc.); global functions prefixed with `EW_` for onclick handlers in dynamic HTML
- **Boolean-like fields** in the database use lowercase `"yes"/"no"`, not `"Y"/"N"` — select options must match

### Resource directories

```
src/main/resources/
  properties/    → plugin property JSON (enrichmentWorkspaceMenu.json)
  messages/      → i18n .properties files
  static/css/    → ew-main.css (layout, sidebar, table, toolbar), ew-detail.css (slide-over, dialogs, toasts)
  static/js/     → 9 JS modules (ew-config, ew-api, ew-toast, ew-tabs, ew-table, ew-actions, ew-detail, ew-filters, ew-main)
  templates/     → enrichmentWorkspace.ftl (FreeMarker template)
```

### Companion plugin interaction

The enrichment-workspace UI calls `enrichment-api` REST endpoints at `/jw/api/enrichment/`. API authentication uses `api_id` and `api_key` headers, configured via the plugin's "API Connection" property group.

### Joget API Builder routing limitations (critical)

These are hard-won lessons from earlier development phases:

1. **Path variable routing is broken.** `GET /records/{id}`, `PUT /records/{id}`, and any sub-path like `POST /records/save` or `POST /records/confirm` return Joget framework 400. The `/records/{id}` pattern greedily matches all `/records/*` paths.
2. **Joget is method-agnostic.** `@Operation(type = MethodType.GET)` also responds to POST requests. The `type` field is effectively documentation-only.
3. **New `@Operation` methods are NOT detected after JAR redeployment.** Only operations registered when the API Builder was first configured are routed. Adding a new `@Operation` method and redeploying the JAR does not make it available.
4. **Workaround: piggyback on existing endpoints.** The save operation uses `GET /records?save=<json>` — an extra `@Param` on the existing `records()` method. This avoids both the path collision and the new-operation detection issue.
5. **Detail panel uses cached records.** Since `GET /records/{id}` doesn't work, the detail panel receives its record data from the table's in-memory cache (`EW.state.records`), not from a separate API call.
6. **New loan/fund endpoints must follow the same pattern.** Loan split, link-to-contract, interest verification, fund allocation — all must use `save=<json>` dispatcher keys rather than new REST paths.

### Strict API separation (architectural rule)

The workspace **must never** import or reference Joget form IDs, table names, or FormDataDao. All data access goes through enrichment-api. This applies to:
- Loan contracts (read via enrichment-api, not directly from F02.04)
- Fund investor positions (read via enrichment-api, not directly from F03.01)
- Customer search (via enrichment-api, not directly from customer form)

## Current Implementation Status

**Completed (old phases 0–3):**
- Plugin skeleton, static resource serving, FreeMarker template
- Record listing with pagination, sorting, filtering
- Detail slide-over panel with 8 collapsible sections
- Inline field editing with optimistic locking (diff-based save)
- Status actions (mark ready, reprocess, return to editing)
- Confirm for posting with reconciliation panel
- Split & merge dialogs with amount allocation
- Delete, manual entry creation
- CSV export
- Toast notifications

**Now entering Phase 1 (v2.0 — major UI upgrade + loan workflow).** See `docs/SPEC.md` §17.2 for the full plan.

## Phase 1 — What's Being Built

Phase 1 has four workstreams:

**1A. UI evolution to v2 design** — no plugin sidebar (Joget Userview handles navigation), collapsible summary dashboard with KPI cards, collapsible filters with active filter summary, toolbar with Split/Operations dropdowns, type badges with category colors (loan=amber, sec=indigo, fund=blue, fx=green, fee=pink), context-aware ribbons in detail panel, conditional loan contract and fund allocation sections.

**1B. Loan API endpoints** — 5 new endpoints on enrichment-api (via save dispatcher): loan contract list/detail, loan payment split, link-to-contract, interest verification. Plus 3 new fields on F02.04.

**1C. Loan UI wiring** — loan split dialog with contract card and interest verification, link-to-contract dialog with auto-suggestions, context ribbons for loan transactions.

**1D. Core operations wiring** — connect all existing dialogs (split, merge, confirm, reclassify, reassign, FX override, etc.) to the new v2 UI layout.

## Reference Files

- `docs/SPEC.md` — **consolidated specification** (architecture, UI, operations, data model, API contract, implementation roadmap)
- `docs/enrichment-workspace-v2.html` — interactive HTML prototype of the target UI
- `docs/F01.05-trxEnrichment.json` — form field definitions (52 fields)
- `docs/archive/` — superseded specs (enrichment-workspace-specification.md, WORKSPACE-OPERATIONS-SPEC.md, GAP-ANALYSIS.md)
- `../enrichment-api/docs/enrichment-api-specification.md` — REST API contract
- `../enrichment-api/docs/workspace-api-integration.md` — integration patterns

## Design System (v2)

| Element | Value |
|---------|-------|
| Font | Segoe UI / Helvetica Neue / Arial |
| Background | #f1f5f9 |
| Sidebar | #1a365d (dark blue) |
| Active accent | #6ee7b7 (green) |
| Primary button | #1a365d |
| Success | #16a34a |
| Danger | #dc2626 |
| Warning | #d97706 |
| Type badge: loan | #fef3c7 bg / #92400e text |
| Type badge: sec | #e0e7ff bg / #3730a3 text |
| Type badge: fund | #dbeafe bg / #1e40af text |
| Type badge: fx | #d1fae5 bg / #065f46 text |
| Type badge: fee | #fce7f3 bg / #9d174d text |

## Business Context

Genesis Asset Management OÜ (customer 12345678) is an Estonian fund manager that:
- Buys/sells securities **in bulk** on behalf of pooled investor-depositors (not per-customer portfolios)
- Issues loans and receives loan repayments that need splitting into principal + interest
- Processes ~142 transactions per quarter across bank (LHV) and securities (Swedbank) statements
- The enrichment workspace is the **most important use case** for this customer
