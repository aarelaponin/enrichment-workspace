# Enrichment Workspace UI Specification v1.0.0

**Plugin**: enrichment-workspace v1.0.0
**Type**: Joget DX 8.1.6 UserviewMenu Plugin
**Platform**: Joget DX 8.1.6+
**Scope**: F01.05 Manual Enrichment UI — provides the rich interface for enrichment workspace operations
**Companion Plugins**: enrichment-api v1.0.0 (REST data contract), rows-enrichment v1.0.0 (automated pipeline)
**Last Updated**: 2026-03-03

---

## §1. Overview and Architecture

### 1.1 Plugin Identity

| Property | Value |
|----------|-------|
| **Plugin Name** | enrichment-workspace |
| **Version** | 1.0.0 |
| **Plugin Type** | UserviewMenu (Joget 8.1.6 native) |
| **Service Class** | `org.joget.gam.enrichment.ui.EnrichmentWorkspaceMenu` |
| **Icon** | `<i class="fas fa-exchange-alt"></i>` |
| **Category** | Custom (UserviewBuilderPalette.CATEGORY_CUSTOM) |
| **Home Page Supported** | Yes |

### 1.2 Single Responsibility Principle

The enrichment-workspace plugin provides **the manual enrichment workspace UI for F01.05 transactions only**. It:

**DOES**:
- Render five datalist views for different enrichment statuses and workflows
- Display a collapsible detail form for transaction editing
- Launch action dialogs (split, merge, confirm, reprocess)
- Manage row selection and toolbar button states
- Show real-time validation feedback and reconciliation panels
- Provide filtering and sorting on enrichment records

**DOES NOT**:
- Create, update, or delete posting records (F01.06) — that is the posting engine's responsibility
- Interact with the GL posting engine or approval workflows
- Modify F01.03/F01.04 source records
- Bypass enrichment-api for data mutations
- Manage user roles or access control (delegated to Joget ACL)

### 1.3 Data Contract: Enrichment API

All data operations (read, write, delete, status changes, splits, merges, confirmations) are delegated to the enrichment-api REST plugin. The enrichment-workspace plugin:

- Reads data via enrichment-api GET endpoints
- Writes data via enrichment-api POST/PUT/DELETE endpoints
- Trusts the API for validation, state management, reconciliation logic, and audit trails
- Never bypasses the API to write directly to F01.05 tables
- Caches record objects in-memory during the session but always fetches fresh data on reload

### 1.4 Framework Integration

The UI is tightly integrated with gam-framework:

- Status badges use gam-framework Status enum values (not hardcoded strings)
- Status transitions respect gam-framework StatusManager rules
- Field visibility and editability rules align with status-based permissions
- All timestamp and audit fields use gam-framework audit tracking
- Cross-references: gam-framework-specification.md, enrichment-api-specification.md, rows-enrichment-spec.md

---

## §2. Plugin Configuration

### 2.1 Plugin Properties (Joget Property Panel)

The plugin exposes the following configurable properties:

```json
{
  "title": "Enrichment Workspace Configuration",
  "properties": [
    {
      "group": "General",
      "fields": [
        {
          "name": "label",
          "label": "Menu Label",
          "type": "textfield",
          "required": true,
          "value": "Enrichment Workspace",
          "description": "The label displayed in the userview menu"
        },
        {
          "name": "customId",
          "label": "Custom HTML ID",
          "type": "textfield",
          "regex_validation": "^[a-zA-Z0-9_]*$",
          "validation_message": "Only alphanumeric and underscore allowed",
          "description": "Optional custom HTML id for CSS targeting"
        }
      ]
    },
    {
      "group": "API Connection",
      "fields": [
        {
          "name": "apiId",
          "label": "API Builder ID",
          "type": "textfield",
          "required": true,
          "description": "The API Builder ID (e.g., enrichment-api). Must match enrichment-api plugin's apiId."
        },
        {
          "name": "apiKey",
          "label": "API Key",
          "type": "textfield",
          "required": true,
          "description": "API key from API Builder Settings for enrichment-api authentication."
        }
      ]
    },
    {
      "group": "Field Mapping",
      "fields": [
        {
          "name": "tableName",
          "label": "Table Name",
          "type": "textfield",
          "required": true,
          "value": "trx_enrichment",
          "description": "MySQL table name (without app_fd_ prefix) for JDBC binders."
        },
        {
          "name": "formId",
          "label": "Form ID",
          "type": "textfield",
          "required": true,
          "value": "trxEnrichment",
          "description": "Joget form ID for detailed record editing. Form must exist in the app."
        }
      ]
    },
    {
      "group": "Styling",
      "fields": [
        {
          "name": "customCssClass",
          "label": "Custom CSS Class",
          "type": "textfield",
          "description": "Optional custom CSS class name for branding/theming"
        },
        {
          "name": "pageSize",
          "label": "Records Per Page",
          "type": "textfield",
          "value": "20",
          "regex_validation": "^[0-9]+$",
          "validation_message": "Must be a positive integer",
          "description": "Number of records displayed per page in datalists"
        }
      ]
    }
  ]
}
```

### 2.2 Runtime Configuration

At runtime, the FreeMarker template injects configuration into the browser via `window.EW_CONFIG`:

```javascript
window.EW_CONFIG = {
  apiBase: 'http://localhost:8080/jw/api/enrichment',   // enrichment-api endpoint
  apiId: 'enrichment-api',                               // API Builder ID
  apiKey: 'your-api-key-here',                          // API secret
  statementId: 'STM-2024-0001',                         // Statement context (from URL param)
  pageSize: 20,                                          // Default records per page
  version: '1.0.0'                                      // Plugin version
};
```

---

## §3. Five Tabs: Definitions and Column Layouts

The enrichment-workspace provides five tabbed views. Each tab defines its own column configuration, API filters, toolbar availability, and selectability.

### 3.1 Tab 1: Enrichment Workspace (Primary)

| Property | Value |
|----------|-------|
| **Tab ID** | workspace |
| **Label** | Enrichment Workspace |
| **Icon** | fas fa-exchange-alt |
| **Has Badge** | Yes (shows count of active records) |
| **Has Checkboxes** | Yes |
| **Has Toolbar** | Yes |
| **Status Filter** | All active statuses EXCEPT superseded and confirmed |
| **Valid Statuses** | new, processing, enriched, error, manual_review, in_review, adjusted, ready, paired |

**Columns** (in display order):
1. Checkbox (_check) — width: 32px
2. Status (status) — sortable
3. Source Type (source_tp) — sortable, renders as 'B' or 'S'
4. Transaction Date (transaction_date) — sortable
5. Internal Type (internal_type) — sortable
6. Description (description) — truncated to 60 chars, full text in tooltip
7. Debit/Credit (debit_credit) — sortable, badge style
8. Amount (original_amount) — sortable, right-aligned, 2 decimals
9. Fee (fee_amount) — sortable, right-aligned, 2 decimals
10. Total (total_amount) — sortable, right-aligned, bold, 2 decimals
11. Currency (validated_currency) — sortable
12. Customer (customer_code) — sortable
13. Asset (resolved_asset_id) — sortable
14. Counterparty (counterparty_short_code) — sortable
15. Origin (origin) — sortable, badge style
16. Confidence (type_confidence) — sortable, badge style

**API Filter**:
```javascript
buildFilters: function(params) {
  if (!params.status) {
    params.excludeStatuses = ['superseded', 'confirmed'];
  }
  return params;
}
```

---

### 3.2 Tab 2: Ready for Posting

| Property | Value |
|----------|-------|
| **Tab ID** | ready |
| **Label** | Ready for Posting |
| **Icon** | fas fa-check |
| **Has Badge** | Yes (shows count of ready records) |
| **Has Checkboxes** | Yes |
| **Has Toolbar** | Yes |
| **Status Filter** | status = ready only |
| **Row Class** | ew-row-ready (CSS highlight for ready records) |

**Columns** (in display order):
1. Checkbox (_check) — width: 32px
2. Source Type (source_tp)
3. Transaction Date (transaction_date)
4. Internal Type (internal_type)
5. Description (description)
6. Debit/Credit (debit_credit)
7. Amount (original_amount)
8. Fee (fee_amount)
9. Total (total_amount)
10. Currency (validated_currency)
11. Customer (customer_code)
12. Asset (resolved_asset_id)
13. Counterparty (counterparty_short_code)

**API Filter**:
```javascript
buildFilters: function(params) {
  params.status = 'ready';
  return params;
}
```

---

### 3.3 Tab 3: Confirmed Records

| Property | Value |
|----------|-------|
| **Tab ID** | confirmed |
| **Label** | Confirmed Records |
| **Icon** | fas fa-lock |
| **Has Badge** | Yes (shows count of confirmed records) |
| **Has Checkboxes** | No (read-only tab) |
| **Has Toolbar** | No |
| **Status Filter** | status = confirmed only |

**Columns** (in display order):
1. Status (status)
2. Transaction Date (transaction_date)
3. Internal Type (internal_type)
4. Description (description)
5. Debit/Credit (debit_credit)
6. Total (total_amount)
7. Currency (validated_currency)
8. Customer (customer_code)
9. Asset (resolved_asset_id)
10. Counterparty (counterparty_short_code)
11. Confirmed By (confirmed_by) — auditing field
12. Confirmation Date (confirmed_date) — auditing field

**API Filter**:
```javascript
buildFilters: function(params) {
  params.status = 'confirmed';
  return params;
}
```

**Row Behavior**: Clicking a row opens the detail panel in read-only mode. No editing is allowed.

---

### 3.4 Tab 4: Split/Merge History

| Property | Value |
|----------|-------|
| **Tab ID** | history |
| **Label** | Split/Merge History |
| **Icon** | fas fa-code-branch |
| **Has Badge** | No |
| **Has Checkboxes** | No (read-only tab) |
| **Has Toolbar** | No |
| **Status Filter** | origin IN (split, merge) |

**Columns** (in display order):
1. Origin (origin) — badge style: 'split' or 'merge'
2. Status (status)
3. Group (group_id) — monospace font, represents the split/merge group ID
4. Sequence (sequence_number) — order within the group
5. Transaction Date (transaction_date)
6. Source Type (source_tp)
7. Internal Type (internal_type)
8. Description (description)
9. Total (total_amount)
10. Currency (validated_currency)
11. Customer (customer_code)
12. Lineage Note (lineage_note) — explains the split/merge operation
13. Created (dateCreated) — when the record was split/merged

**API Filter**:
```javascript
buildFilters: function(params) {
  params.origins = ['split', 'merge'];
  return params;
}
```

**Row Behavior**: Clicking a row opens the detail panel in read-only mode. Provides audit trail visibility.

---

### 3.5 Tab 5: Statement Summary

| Property | Value |
|----------|-------|
| **Tab ID** | summary |
| **Label** | Statement Summary |
| **Icon** | fas fa-chart-bar |
| **Has Badge** | No |
| **Has Checkboxes** | No |
| **Has Toolbar** | No |
| **isSummary** | true (uses aggregation API) |

**Columns** (in display order):
1. Status (status) — grouped aggregation
2. Currency (currency) — secondary grouping
3. Count (count) — number of records
4. Total Amount (total_amount) — sum of amounts
5. Earliest Date (earliest_date) — minimum transaction_date
6. Latest Date (latest_date) — maximum transaction_date

**API Filter**:
```javascript
buildFilters: function(params) {
  return params;  // Summary spans all statuses
}
```

**Data Source**: Calls `EW.api.fetchSummary(params)` which returns aggregated data by status and currency.

**Row Behavior**: Clicking a summary row filters the Workspace tab to show records matching that status+currency combination.

---

## §4. Field Editability Matrix (52 Fields × 11 Statuses)

This matrix defines which fields are editable in each status. Editable fields are shown as input controls in the detail panel; read-only fields are displayed as label+value pairs.

**Legend**:
- **RO** = Read-only (always)
- **E** = Editable when status allows (determined by EDITABLE_STATUSES map)
- **AE** = Always editable (e.g., processing_notes has `alwaysEditable: true`)
- **H** = Hidden from UI
- **N/A** = Not applicable to this status

**EDITABLE_STATUSES Map** (from ew-detail.js):
```javascript
var EDITABLE_STATUSES = {
  enriched: true, error: true, manual_review: true, in_review: true,
  adjusted: true, ready: true, paired: true, processing: true
};
```

**Non-Editable Statuses** (always read-only or hidden): new, confirmed, superseded

---

### 4.1 §1. Traceability Fields (Always Read-Only, Hidden when status=superseded or confirmed)

| Field | Type | new | processing | enriched | error | manual_review | in_review | adjusted | ready | paired | confirmed | superseded |
|-------|------|-----|-----------|----------|-------|---------------|-----------|----------|-------|--------|-----------|-----------|
| source_tp | select(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | H | H |
| source_trx_id | text(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | H | H |
| statement_id | text(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | H | H |

---

### 4.2 §2. Lineage Fields (Shown only when origin != "pipeline")

| Field | Type | new | processing | enriched | error | manual_review | in_review | adjusted | ready | paired | confirmed | superseded |
|-------|------|-----|-----------|----------|-------|---------------|-----------|----------|-------|--------|-----------|-----------|
| origin | select(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| parent_enrichment_id | text(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| group_id | text(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| split_sequence | text(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| lineage_note | textarea(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |

---

### 4.3 §3. Transaction Core (Always Visible, Expanded)

| Field | Type | new | processing | enriched | error | manual_review | in_review | adjusted | ready | paired | confirmed | superseded |
|-------|------|-----|-----------|----------|-------|---------------|-----------|----------|-------|--------|-----------|-----------|
| transaction_date | date(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |
| settlement_date | date(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |
| debit_credit | select(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |
| original_amount | decimal(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |
| fee_amount | decimal(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |
| total_amount | decimal(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |
| original_currency | text(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| description | textarea(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |

---

### 4.4 §4. Classification (Always Visible, Expanded)

| Field | Type | new | processing | enriched | error | manual_review | in_review | adjusted | ready | paired | confirmed | superseded |
|-------|------|-----|-----------|----------|-------|---------------|-----------|----------|-------|--------|-----------|-----------|
| internal_type | select(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |
| type_confidence | badge(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| matched_rule_id | text(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |

---

### 4.5 §5. Currency & FX (Always Visible, Collapsed)

| Field | Type | new | processing | enriched | error | manual_review | in_review | adjusted | ready | paired | confirmed | superseded |
|-------|------|-----|-----------|----------|-------|---------------|-----------|----------|-------|--------|-----------|-----------|
| validated_currency | text(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |
| fx_rate_to_eur | decimal(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |
| fx_rate_date | date(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |
| fx_rate_source | select(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |
| base_amount_eur | decimal(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| requires_eur_parallel | select(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |

---

### 4.6 §6. Resolved Entities (Always Visible, Collapsed)

| Field | Type | new | processing | enriched | error | manual_review | in_review | adjusted | ready | paired | confirmed | superseded |
|-------|------|-----|-----------|----------|-------|---------------|-----------|----------|-------|--------|-----------|-----------|
| resolved_customer_id | text(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |
| customer_code | text(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |
| customer_match_method | text(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| resolved_asset_id | text(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |
| asset_isin | text(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| asset_category | select(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |
| counterparty_id | text(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |
| counterparty_short_code | text(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |
| counterparty_source | text(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |

---

### 4.7 §7. Fee & Pairing (Shown only when has_fee=Y or status=paired)

| Field | Type | new | processing | enriched | error | manual_review | in_review | adjusted | ready | paired | confirmed | superseded |
|-------|------|-----|-----------|----------|-------|---------------|-----------|----------|-------|--------|-----------|-----------|
| has_fee | select(E) | N/A | E | E | E | E | E | E | E | E | RO | RO |
| fee_trx_id | text(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| pair_id | text(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |

---

### 4.8 §8. Status & Notes (Always Visible, Expanded)

| Field | Type | new | processing | enriched | error | manual_review | in_review | adjusted | ready | paired | confirmed | superseded |
|-------|------|-----|-----------|----------|-------|---------------|-----------|----------|-------|--------|-----------|-----------|
| status | badge(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| enrichment_timestamp | text(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| version | text(RO) | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO | RO |
| error_message | text(RO) | N/A | N/A | N/A | RO | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| processing_notes | textarea(AE) | AE | AE | AE | AE | AE | AE | AE | AE | AE | AE | AE |

**Notes on §8**:
- error_message: Displayed only when status=error
- processing_notes: Always has a Save button, even in read-only statuses (alwaysEditable: true)
- status, enrichment_timestamp, version, error_message are NEVER editable

---

## §5. Detail Panel (Slide-Over Form)

### 5.1 Invocation

The detail panel opens when the user clicks on a table row. It is a slide-over modal that appears from the right side of the screen, displaying all 8 sections of the enrichment record.

**Opening behavior**:
1. User clicks on a row in the active tab's table
2. If the record is already loaded in the table's result set, pass the record object directly to `EW.detail.open(recordId, record)` to avoid an API call
3. If the record is not in-memory, call `EW.api.fetchRecord(recordId)` to load it from the API
4. Render the panel with all 8 collapsible sections
5. Determine edit mode based on `isEditable(record.status)`

**Closing behavior**:
1. User clicks the close button (×) in the top-right of the panel
2. User clicks outside the panel (on the background overlay)
3. User clicks Cancel in the footer
4. After successful save, the panel closes automatically and the table is refreshed
5. On error, the panel remains open with the error message displayed

### 5.2 Panel Layout

```
┌─────────────────────────────────────────────┐
│ ◄ close                    [Status Badge] ✕ │  ← Header
├─────────────────────────────────────────────┤
│ § 1 Traceability           [▼]               │  ← Collapsible sections
│   ├─ Source Type, Source Trx ID, Statement  │
│   └─ (hidden if status=superseded/confirmed)│
│                                              │
│ § 2 Lineage                [►]               │
│   ├─ Origin, Parent ID, Group, Seq          │
│   └─ Lineage Note (editable)                │
│   (shown only if origin != "pipeline")      │
│                                              │
│ § 3 Transaction Core       [▼]               │
│   ├─ Transaction Date, Settlement Date, D/C │
│   ├─ Amount, Fee, Total, Currency           │
│   └─ Description                            │
│                                              │
│ § 4 Classification         [▼]               │
│   ├─ Internal Type, Confidence, Matched Rule │
│   └─ (confidence and rule ID are RO)        │
│                                              │
│ § 5 Currency & FX          [►]               │
│   ├─ Currency, FX Rate, Rate Date, Source   │
│   ├─ EUR Amount, Requires EUR Parallel      │
│   └─ (EUR Amount is RO)                     │
│                                              │
│ § 6 Resolved Entities      [►]               │
│   ├─ Customer ID, Customer Code, Match Method
│   ├─ Asset ID, ISIN, Asset Category        │
│   ├─ Counterparty ID, Code, Source         │
│   └─ (match method, ISIN, source are RO)   │
│                                              │
│ § 7 Fee & Pairing          [►]               │
│   ├─ Has Fee, Fee Trx ID, Pair ID          │
│   └─ (shown only if has_fee=Y or status=paired)
│                                              │
│ § 8 Status & Notes         [▼]               │
│   ├─ Status, Timestamp, Version             │
│   ├─ Error Message (shown if status=error)  │
│   └─ Processing Notes (always editable)    │
├─────────────────────────────────────────────┤
│ [Cancel] ..................................... [Save] │  ← Footer (shown if editable)
└─────────────────────────────────────────────┘
```

### 5.3 Section Rendering

Each section is rendered as a collapsible accordion:

```javascript
renderSection(title, num, content, defaultExpanded)
```

- **title**: Display name (e.g., "Traceability")
- **num**: Section number (1-8) for reference
- **content**: HTML content (fields)
- **defaultExpanded**: true for sections 1, 3, 4, 8; false for 2, 5, 6, 7

**Section Toggle**: Clicking the section header (with § symbol) toggles visibility. Icon changes from ▼ (open) to ► (closed).

### 5.4 Field Rendering Rules

For each field in a section:

1. **Read-only field** (not in FIELDS object or not editable):
   ```html
   <div class="ew-f-field">
     <label>Field Label</label>
     <div class="ew-val">Display Value</div>
   </div>
   ```

2. **Editable field** (in FIELDS object and EDITABLE_STATUSES[status] = true):
   ```html
   <div class="ew-f-field">
     <label>Field Label</label>
     <input type="text" name="field_id" value="Current Value" />
   </div>
   ```

3. **Badge field** (status, confidence):
   ```html
   <div class="ew-f-field">
     <label>Status</label>
     <span class="st-ready">ready</span>
   </div>
   ```

4. **Always-editable field** (processing_notes):
   Even if status is non-editable, the field is rendered as an input. Footer always shows Save button.

### 5.5 Input Field Types

The FIELDS object in ew-detail.js defines 25 editable fields with input types:

| Type | HTML | Example |
|------|------|---------|
| text | `<input type="text" ...>` | customer_code |
| date | `<input type="date" ...>` | transaction_date |
| decimal | `<input type="number" step="any" ...>` | original_amount |
| select | `<select><option>...</option></select>` | internal_type, debit_credit |
| textarea | `<textarea maxlength="...">...</textarea>` | description, processing_notes |

**25 Editable Fields** (hardcoded in FIELDS object):
1. transaction_date (date, required)
2. settlement_date (date, required)
3. debit_credit (select, required)
4. original_amount (decimal, required)
5. fee_amount (decimal)
6. total_amount (decimal, required)
7. description (textarea, maxlen=500)
8. internal_type (select, required) [HARDCODED OPTIONS]
9. validated_currency (text, required)
10. fx_rate_to_eur (decimal)
11. fx_rate_date (date)
12. fx_rate_source (select) [HARDCODED OPTIONS]
13. requires_eur_parallel (select)
14. resolved_customer_id (text, required)
15. customer_code (text)
16. resolved_asset_id (text)
17. asset_category (select) [HARDCODED OPTIONS]
18. counterparty_id (text)
19. counterparty_short_code (text)
20. has_fee (select)
21. lineage_note (textarea, maxlen=500)
22. processing_notes (textarea, maxlen=1000, alwaysEditable=true)

**Additional read-only fields** (27 total):
- source_tp, source_trx_id, statement_id, origin, parent_enrichment_id, group_id, split_sequence
- original_currency, type_confidence, matched_rule_id, base_amount_eur, customer_match_method
- asset_isin, counterparty_source, fee_trx_id, pair_id, status, enrichment_timestamp, version
- error_message, confirmed_by, confirmed_date, dateCreated

### 5.6 Save and Validation

**Save flow**:
1. User clicks "Save" button
2. Collect form data via `collectFormData(record)` which diffs against the original record
3. Only changed fields are included in the payload: `{ id, version, ...changedFields }`
4. Call `EW.api.saveRecord(recordId, data)` → PUT request
5. API validates the entire record against EDITABLE_STATUSES and field requirements
6. If validation passes: Toast "Record saved successfully", close panel, refresh table
7. If version conflict (409): Toast "Record modified by another user — reloading", reload panel with fresh data
8. If other error: Toast "Failed to save record: {error message}", keep panel open with disabled Save button

**Client-side validation** (advisory only):
- Highlight required fields that are empty with `ew-edit-required` CSS class
- Required fields: transaction_date, settlement_date, debit_credit, original_amount, total_amount, internal_type, validated_currency, resolved_customer_id

---

## §6. Toolbar Actions and Behavior

### 6.1 Workspace Tab Toolbar

| Action ID | Label | Icon | Enabled When | Target Statuses |
|-----------|-------|------|--------------|-----------------|
| confirmForPosting | Confirm for Posting | fas fa-paper-plane | Any selected has status=ready | ready → confirmed |
| markReady | Mark as Ready | fas fa-check | Any selected in [enriched, adjusted, in_review, paired] | These 4 → ready |
| separator | — | — | — | — |
| splitRecord | Split | fas fa-code-branch | Exactly 1 selected in [enriched, adjusted, in_review, ready] | Active → split children |
| mergeRecords | Merge | fas fa-compress | 2+ selected ALL in [enriched, adjusted, in_review] | These 3 → merged |
| separator | — | — | — | — |
| reprocess | Reprocess | fas fa-redo | Any selected in [error, manual_review, new, processing] | Varies per status |
| deleteRecord | Delete | fas fa-trash | Any selected in [new, error, manual_review] | Delete record |
| spacer | — | — | — | — |
| newManual | New Manual Entry | fas fa-plus | Always enabled | Create new enrichment record |

**Button State Rules**:
- Button is disabled (greyed out) if the enabled condition is not met
- On selection change (row checkbox), `EW.actions.updateToolbar()` is called to re-evaluate all button states
- Selection count badge appears showing "N selected" (e.g., "3 selected")

---

### 6.2 Ready Tab Toolbar

| Action ID | Label | Icon | Enabled When |
|-----------|-------|------|--------------|
| confirmForPosting | Confirm for Posting | fas fa-paper-plane | Any row selected (all should be ready) |
| returnToWorkspace | Return to Workspace | fas fa-undo | Any row selected |

**Note**: Ready tab has no "Mark as Ready" action because all rows are already ready. Instead, "Return to Workspace" sends ready records back to enriched status if they need re-processing.

---

### 6.3 Confirmed & History & Summary Tabs

These tabs have **no toolbar**. They are read-only views.

---

## §7. Status Transition Flows

### 7.1 Eligible Status Map

From ew-actions.js:

```javascript
var ELIGIBLE_STATUSES = {
  markReady:          ['enriched', 'adjusted', 'in_review', 'paired'],
  reprocess:          ['error', 'manual_review', 'new', 'processing'],
  returnToWorkspace:  ['ready']
};
```

### 7.2 Action: Mark as Ready

**Eligibility**: Any selected record has status in [enriched, adjusted, in_review, paired]

**Target Status**: ready

**Behavior**:
1. Filter selected records to eligible ones; skip others
2. Toast: "N record(s) skipped (ineligible status)" if any
3. Call `EW.api.batchTransitionStatus(eligibleIds, 'ready')`
4. On success: Toast "N record(s) marked as ready", refresh table, clear selection
5. On error: Toast "Failed: <error message>", keep button enabled for retry

---

### 7.3 Action: Return to Workspace

**Eligibility**: Any selected record has status = ready

**Target Status**: enriched (back to the editable workspace)

**Behavior**:
1. Call `EW.api.batchTransitionStatus(selectedIds, 'enriched')`
2. On success: Toast "N record(s) returned to workspace", refresh table, clear selection
3. Automatically move records out of the Ready tab into Workspace tab

---

### 7.4 Action: Reprocess

**Eligibility**: Any selected record has status in [error, manual_review, new, processing]

**Target Statuses** (per-status mapping):
```javascript
var REPROCESS_TARGET = {
  error:          'new',          // Restart from beginning
  new:            'processing',   // Advance to pipeline processing
  processing:     'enriched',     // Pipeline completed successfully
  manual_review:  'enriched'      // Manual fix applied, advance
};
```

**Behavior**:
1. Group eligible records by their reprocess target status
2. Toast: "N record(s) skipped (ineligible status)" if any
3. Fire parallel API calls: one for each target status
4. Collect results from all promises
5. Toast success/error for each batch:
   - "N record(s) sent for reprocessing"
   - "Failed: ID: error; ID: error; ...and 5 more"
6. Refresh table and clear selection

---

### 7.5 Action: Confirm for Posting

**Eligibility**: Any selected record has status = ready

**Behavior**:
1. Filter selected records to ready-only; skip others with info toast
2. Open "Confirm for Posting" dialog with ready record list
3. Display currency breakdown (count + total per currency)
4. Call `EW.api.confirmRecords(readyIds, skipValidation=true)`
5. Show validation errors if any records fail
6. On success: Toast "N record(s) confirmed for posting", close dialog, refresh table
7. Confirmed records move to "Confirmed Records" tab

---

### 7.6 Action: Delete

**Eligibility**: Any selected record has status in [new, error, manual_review]

**Behavior**:
1. Filter selected records to eligible ones
2. Toast: "N record(s) skipped (ineligible status)" if any
3. Show confirm dialog: "Are you sure you want to delete N record(s)?"
4. If confirmed, call `EW.api.deleteRecord(id)` for each record
5. On success: Toast "N record(s) deleted", refresh table

---

### 7.7 Action: Split

**Eligibility**: Exactly 1 record selected with status in [enriched, adjusted, in_review, ready]

**Behavior**:
1. Open "Split Record" dialog
2. Display original record details (amount, currency, date)
3. Show input fields for allocations (child amounts)
4. Validate: sum of child amounts must equal original total_amount
5. Call `EW.api.splitRecord(recordId, allocations)` where allocations = [{ amount, description }, ...]
6. On success: New child records created with origin=split, parent_enrichment_id=original_id
7. Toast: "Record split into N child records", close dialog, refresh table

---

### 7.8 Action: Merge

**Eligibility**: 2+ records selected, ALL with status in [enriched, adjusted, in_review]

**Behavior**:
1. Open "Merge Records" dialog
2. Display list of selected records (amounts, currencies)
3. Validate: all records have same statement_id and (ideally) same currency
4. Show merged record preview (sum of amounts, earliest date, etc.)
5. Call `EW.api.mergeRecords(recordIds)` with array of IDs
6. On success: Single merged record created with origin=merge, children marked as superseded
7. Toast: "N records merged into 1 record", close dialog, refresh table

---

### 7.9 Action: New Manual Entry

**Eligibility**: Always enabled

**Behavior**:
1. Open "New Manual Entry" dialog with blank form (or lightweight form)
2. User enters: transaction_date, settlement_date, description, amount, currency, internal_type, customer_id
3. Call `EW.api.saveRecord(newId, {...fields...})` to create new enrichment record
4. On success: New record appears in Workspace tab with status=new
5. Toast: "New enrichment record created", close dialog, refresh table

---

## §8. Confirm for Posting Dialog

### 8.1 Invocation

The dialog opens when the user clicks "Confirm for Posting" button on the Workspace or Ready tab with at least one ready record selected.

### 8.2 Dialog Layout

```
┌────────────────────────────────────────────────────┐
│ Confirm Records for Posting                        │
├────────────────────────────────────────────────────┤
│ Ready to post:  3 records                          │
│ Skipped:        1 record (not ready)              │
│                                                    │
│ Currency Breakdown:                                │
│ ┌──────────────────────────────┐                 │
│ │ Currency │ Count │ Total Amount                 │
│ ├──────────────────────────────┤                 │
│ │ EUR      │   2   │  10,500.50                   │
│ │ USD      │   1   │   5,000.00                   │
│ └──────────────────────────────┘                 │
│                                                    │
│ Validation Errors (if any):                       │
│ • Record REC-123: Required field 'asset_id'      │
│   missing for SEC_BUY transaction                 │
│                                                    │
├────────────────────────────────────────────────────┤
│ [Cancel] .................. [Confirm] [Confirm & Ignore] │
└────────────────────────────────────────────────────┘
```

### 8.3 Behavior

1. **Filter ready records**: Iterate through selected records; keep only those with status=ready
2. **Display counts**: Show "Ready to post: N records" and "Skipped: M records (not ready)"
3. **Currency breakdown**: Call `EW.api.confirmRecords(readyIds, skipValidation=false)` in preview mode (or aggregate on client side)
   - Group ready records by validated_currency
   - Display count and sum per currency
4. **Show validation errors**: If any records fail validation:
   - Display as bulleted list: "Record {id}: {error message}"
   - Limit to 10 errors; show "...and N more" if additional
5. **Button options**:
   - **Cancel**: Close dialog without confirming
   - **Confirm**: Call `EW.api.confirmRecords(readyIds, skipValidation=false)`; if validation errors exist, show them and don't proceed
   - **Confirm & Ignore**: (optional) Call with `skipValidation=true` to force confirm despite errors
6. **On success**:
   - Close dialog
   - Toast: "N records confirmed for posting"
   - Refresh table; records move out of Workspace and Ready tabs into Confirmed tab
   - Clear selection
7. **On partial failure**:
   - Toast: "N records confirmed, M records failed"
   - Refresh table; failed records remain in Workspace/Ready
   - Optionally show detail of which records failed

---

## §9. Filtering and Search

### 9.1 Filter Controls (FreeMarker Template)

```html
<div class="ew-filters" id="ew-filters">
  <select id="ew-filter-status" class="ew-select">
    <option value="">All active statuses</option>
    <option value="new">New</option>
    <option value="processing">Processing</option>
    <option value="enriched">Enriched</option>
    <option value="error">Error</option>
    <option value="manual_review">Manual Review</option>
    <option value="in_review">In Review</option>
    <option value="adjusted">Adjusted</option>
    <option value="ready">Ready</option>
    <option value="paired">Paired</option>
  </select>
  <select id="ew-filter-source" class="ew-select">
    <option value="">All sources</option>
    <option value="bank">Bank</option>
    <option value="secu">Securities</option>
  </select>
  <input type="text" id="ew-filter-customer" placeholder="Customer ID..." />
  <button id="ew-btn-search">Search</button>
  <button id="ew-btn-reset">Reset</button>
  <span id="ew-record-count"></span>
</div>
```

### 9.2 Filter Logic

**Status Filter**:
- Workspace tab: Preset to exclude superseded and confirmed; user can select specific status
- Ready tab: Automatically set to status=ready; filter is disabled or hidden
- Other tabs: Similar per-tab presets via `buildFilters()` function

**Source Filter**:
- Options: "All sources", "Bank" (source_tp=bank), "Securities" (source_tp=secu)
- Applies to all tabs

**Customer Filter**:
- Text input for substring search on customer_code
- Passed to API as `search=customer_code:value`

**Search Button**:
- Triggers `EW.table.load()` with current filter values
- Sets page=1 to start from first page

**Reset Button**:
- Clears all filters to default
- Reloads table with no filters (or default filters per tab)

### 9.3 Pagination

The table is paginated with standard controls:

```
◄ Previous  Page 1 of 10 (with dropdown to jump to page N)  Next ►
[Show 10, 20, 50, 100 per page]
Total: 247 records
```

**Page size** is configurable and persists in localStorage (key: `ew-pageSize`).

---

## §10. Hardcoding Issues and Configuration Gaps

The following items are currently hardcoded in the JavaScript files and MUST be made configurable to support production use:

### 10.1 Field Definitions (ew-detail.js)

**Issue**: FIELDS object hardcodes 25 editable field definitions including labels, types, required status, and options.

**Impact**: Any change to field names, labels, or validation rules requires code modification.

**Solution**: Fetch field schema from enrichment-api:
```javascript
GET /schema
Response: {
  fields: [
    { id: "transaction_date", type: "date", label: "Transaction Date", required: true, ... },
    { id: "internal_type", type: "select", label: "Internal Type", options: [["SEC_BUY", "SEC_BUY"], ...] },
    ...
  ]
}
```

### 10.2 Editable Status Map (ew-detail.js)

**Issue**: EDITABLE_STATUSES hardcodes which statuses allow editing: {enriched, error, manual_review, in_review, adjusted, ready, paired, processing}.

**Impact**: Cannot change editability rules without code change.

**Solution**: Fetch from enrichment-api:
```javascript
GET /transitions
Response: {
  editableStatuses: ["enriched", "error", ...],
  transitions: {
    ready: { from: ["enriched", "adjusted", ...], to: "confirmed", ... },
    ...
  }
}
```

### 10.3 Eligible Status Maps (ew-actions.js)

**Issue**: ELIGIBLE_STATUSES and TARGET_STATUS hardcode which statuses allow each action and what status they transition to.

**Impact**: Business rules encoded in code; cannot adjust without redeploy.

**Solution**: Fetch transition rules from enrichment-api (same `/transitions` endpoint as above).

### 10.4 Internal Type Options (ew-detail.js)

**Issue**: internal_type select is hardcoded with 8 options: SEC_BUY, SEC_SELL, BOND_BUY, BOND_COUPON, DIV_INCOME, CASH_IN_OUT, FX_EXCHANGE, COMMISSION.

**Impact**: These values are derived from GL master data (f10.10); hardcoding is inflexible.

**Solution**: Load from API:
```javascript
GET /reference-data/internal-types
Response: {
  types: [
    { code: "SEC_BUY", label: "Security Buy", ... },
    ...
  ]
}
```

### 10.5 Asset Category Options (ew-detail.js)

**Issue**: asset_category select is hardcoded with 3 options: EQ, FI, CE.

**Impact**: Cannot modify without code change.

**Solution**: Load from MDM via enrichment-api:
```javascript
GET /reference-data/asset-categories
Response: {
  categories: [
    { code: "EQ", label: "Equity", ... },
    ...
  ]
}
```

### 10.6 FX Rate Source Options (ew-detail.js)

**Issue**: fx_rate_source select is hardcoded: ecb, bloomberg, manual_override, other.

**Impact**: Cannot add new rate sources without code modification.

**Solution**: Fetch from API:
```javascript
GET /reference-data/fx-sources
Response: {
  sources: [
    { code: "ecb", label: "ECB", ... },
    ...
  ]
}
```

### 10.7 Status Filter Options (enrichmentWorkspace.ftl)

**Issue**: Status filter options are hardcoded in the FreeMarker template with labels for each status value.

**Impact**: New statuses added to the framework require template modification.

**Solution**: Generate dynamically in FreeMarker by fetching from API in the plugin's render() method:
```java
// In plugin render() method:
Map<String, String> statuses = apiClient.getStatuses();
context.put("availableStatuses", statuses);
```

Then in FreeMarker:
```html
<#list availableStatuses?keys as code>
  <option value="${code}">${availableStatuses[code]}</option>
</#list>
```

---

## §11. API Integration and Endpoints

All data operations go through enrichment-api. This section documents the exact API calls made by the workspace.

### 11.1 API Authentication

All requests include headers:
```
api_id: <API Builder ID from EW_CONFIG>
api_key: <API key from EW_CONFIG>
Accept: application/json
```

### 11.2 Record Fetching

**Fetch List of Records**:
```
GET /api/enrichment/records?page=1&pageSize=20&sort=dateCreated&order=asc&filter=statement_id=STM-123&excludeStatus=superseded,confirmed
```

Response:
```json
{
  "records": [
    {
      "id": "REC-001",
      "source_tp": "bank",
      "transaction_date": "2024-01-15",
      "settlement_date": "2024-01-17",
      "debit_credit": "D",
      "original_amount": "1000.00",
      "fee_amount": "10.00",
      "total_amount": "1010.00",
      "validated_currency": "EUR",
      "internal_type": "CASH_IN_OUT",
      "status": "enriched",
      "version": 2,
      ...
    }
  ],
  "total": 247,
  "totalPages": 13,
  "page": 1,
  "pageSize": 20,
  "ms": 125
}
```

**Fetch Single Record**:
```
GET /api/enrichment/records/REC-001
```

Response:
```json
{
  "id": "REC-001",
  "source_tp": "bank",
  "source_trx_id": "TRX-2024-001",
  "statement_id": "STM-123",
  "transaction_date": "2024-01-15",
  ...
  "version": 2
}
```

### 11.3 Record Mutation

**Save Record** (inline save via query parameter):
```
GET /api/enrichment/records?save={"id":"REC-001","version":2,"transaction_date":"2024-01-16","total_amount":"1015.00"}
```

Response:
```json
{
  "id": "REC-001",
  "transaction_date": "2024-01-16",
  "total_amount": "1015.00",
  "version": 3,
  "status": "enriched",
  ...
}
```

**Error Handling**:
- 400: Validation error (e.g., required field missing)
- 409: Version conflict (record modified by another user)
- 500: Server error

### 11.4 Status Transitions

**Batch Status Transition**:
```
GET /api/enrichment/records?save={"recordIds":"REC-001,REC-002,REC-003","targetStatus":"ready"}
```

Response:
```json
{
  "succeeded": ["REC-001", "REC-002"],
  "failed": [
    { "id": "REC-003", "error": "Record already ready" }
  ],
  "ms": 45
}
```

### 11.5 Confirm for Posting

**Confirm Records**:
```
GET /api/enrichment/records?save={"confirm":true,"recordIds":"REC-001,REC-002","allowPartial":true}
```

Response:
```json
{
  "confirmed": 2,
  "confirmedRecords": ["REC-001", "REC-002"],
  "skipped": 0,
  "validationErrors": [],
  "reconciliation": {
    "totalConfirmed": "2015.00",
    "totalPosted": "2000.00",
    "variance": "15.00",
    "tolerance": "50.00",
    "withinTolerance": true
  },
  "ms": 80
}
```

### 11.6 Split and Merge

**Split Record**:
```
GET /api/enrichment/records?save={"split":true,"recordId":"REC-001","allocations":[{"amount":"600.00","description":"First split"},{"amount":"415.00","description":"Second split"}]}
```

Response:
```json
{
  "originalId": "REC-001",
  "splitChildren": [
    { "id": "REC-001-1", "amount": "600.00", "origin": "split", "parent_enrichment_id": "REC-001", ... },
    { "id": "REC-001-2", "amount": "415.00", "origin": "split", "parent_enrichment_id": "REC-001", ... }
  ],
  "ms": 60
}
```

**Merge Records**:
```
GET /api/enrichment/records?save={"merge":true,"recordIds":"REC-002,REC-003"}
```

Response:
```json
{
  "mergedId": "REC-002-MERGED",
  "mergedChildren": ["REC-002", "REC-003"],
  "merged": {
    "id": "REC-002-MERGED",
    "total_amount": "2015.00",
    "origin": "merge",
    ...
  },
  "ms": 55
}
```

### 11.7 Delete Record

**Delete Record**:
```
GET /api/enrichment/records/REC-001?delete=true
```

Response:
```
HTTP 204 No Content
```

### 11.8 Summary Data

**Fetch Summary**:
```
GET /api/enrichment/summary?statement_id=STM-123
```

Response:
```json
{
  "summary": [
    {
      "status": "enriched",
      "currency": "EUR",
      "count": 5,
      "total_amount": "10500.00",
      "earliest_date": "2024-01-01",
      "latest_date": "2024-01-15"
    },
    {
      "status": "ready",
      "currency": "EUR",
      "count": 3,
      "total_amount": "6200.00",
      "earliest_date": "2024-01-05",
      "latest_date": "2024-01-14"
    }
  ],
  "ms": 45
}
```

---

## §12. UI Layout and Styling

### 12.1 HTML Structure

```html
<div class="ew-container" id="ew-root">
  <div class="ew-header">
    <h2>Enrichment Workspace</h2>
    <span class="ew-badge">v1.0.0</span>
    <span class="ew-badge ew-badge-info">Statement: STM-123</span>
    <span class="ew-status" id="ew-status"></span>
  </div>

  <div class="ew-tabs" id="ew-tabs">
    <button class="ew-tab active" data-tab="workspace">
      <i class="fas fa-exchange-alt"></i> Enrichment Workspace
      <span class="ew-tab-badge" id="ew-tab-badge-workspace"></span>
    </button>
    <!-- More tabs... -->
  </div>

  <div class="ew-toolbar" id="ew-toolbar"></div>
  <div class="ew-filters" id="ew-filters"></div>

  <div class="ew-table-wrap">
    <table class="ew-table" id="ew-table">
      <thead id="ew-thead"></thead>
      <tbody id="ew-tbody"></tbody>
    </table>
  </div>

  <div class="ew-pagination" id="ew-pagination"></div>
  <div id="ew-slide-container"></div>
</div>
```

### 12.2 CSS Classes (High-Level)

| Class | Purpose |
|-------|---------|
| ew-container | Root container, max-width, centered |
| ew-header | Header with title, badges, status |
| ew-tabs | Tab bar with buttons |
| ew-toolbar | Action buttons (visible only when tab has toolbar) |
| ew-filters | Filter controls and search |
| ew-table | Main datalist table |
| ew-table-wrap | Overflow wrapper for table |
| ew-pagination | Pagination controls |
| st-{status} | Status badge styling (st-ready, st-error, etc.) |
| dc-D, dc-C | Debit/Credit badge styling |
| cf-{confidence} | Confidence badge styling |
| origin-split, origin-merge | Origin badge styling |
| ew-amount | Amount cell alignment (right) |
| ew-amount-total | Total amount cell (bold, right-aligned) |
| ew-desc | Description cell (truncated with tooltip) |
| ew-slide-over | Modal overlay container |
| ew-slide-panel | Side panel (slide-over form) |
| ew-f-section | Detail panel section |
| ew-f-field | Single field in section |
| ew-edit-input, ew-edit-select, ew-edit-textarea | Editable field inputs |
| ew-toast | Toast notification |
| ew-toast-success, ew-toast-error, ew-toast-warning, ew-toast-info | Toast types |

### 12.3 Responsive Design

The enrichment-workspace is designed for **desktop and tablet** (minimum width 768px). Mobile layout is not supported due to the complexity of the detail panel and toolbar.

---

## §13. Loading Sequence and Initialization

### 13.1 Page Load Order

1. **FreeMarker Template Renders**:
   - Injects `window.EW_CONFIG` with API endpoints and statement context
   - Outputs HTML skeleton (header, tabs, filters, table, pagination, slide-over container)
   - Includes `<link>` tags for CSS files
   - Includes `<script>` tags for JS modules in dependency order

2. **JavaScript Module Load Order**:
   1. ew-config.js: Initialize `window.EW` namespace with `EW_CONFIG` values
   2. ew-api.js: Define `EW.api` methods (fetch, save, transition, etc.)
   3. ew-toast.js: Define `EW.toast` notification system
   4. ew-tabs.js: Define `EW.tabs` with tab definitions and switching logic
   5. ew-table.js: Define `EW.table` with table rendering, sorting, pagination
   6. ew-actions.js: Define `EW.actions` with toolbar logic and action handlers
   7. ew-detail.js: Define `EW.detail` with form rendering and save logic
   8. ew-filters.js: Define `EW.filters` with filter controls (not shown in sample code)
   9. ew-main.js: Initialize UI, bind event listeners, load first page of data

3. **ew-main.js Initialization**:
   ```javascript
   EW.tabs.init();           // Bind tab click handlers
   EW.table.renderThead();   // Render table headers for current tab
   EW.actions.renderToolbar(); // Render toolbar buttons
   EW.table.load();          // Fetch and render first page of records
   EW.filters.init();        // Bind filter controls
   ```

---

## §14. Session State Management

The plugin maintains client-side state in `EW.state`:

```javascript
EW.state = {
  page: 1,                    // Current page number (1-indexed)
  pageSize: 20,              // Records per page (persistent in localStorage)
  sort: 'dateCreated',        // Current sort field
  order: 'asc',              // Sort order (asc or desc)
  total: 0,                   // Total record count (from API)
  totalPages: 0,              // Total pages (calculated)
  selectedIds: [],            // Array of selected record IDs
  currentTab: 'workspace',    // Active tab ID
  records: {}                 // Cached records: { recordId: recordObj }
};
```

**Persistence**:
- `pageSize` is persisted in `localStorage['ew-pageSize']` and restored on page load
- Other state is ephemeral (reset on page reload)

---

## §15. Error Handling and User Feedback

### 15.1 Toast Notifications

The `EW.toast.show(message, type)` function displays non-modal notifications:

**Types**:
- `success`: Green, auto-dismiss after 4s
- `error`: Red, auto-dismiss after 8s
- `warning`: Orange, auto-dismiss after 8s
- `info`: Blue, auto-dismiss after 4s

**Examples**:
- "Record saved successfully"
- "Failed to save record: {error message}"
- "N records marked as ready"
- "Record modified by another user — reloading"

### 15.2 Validation Errors

If a save fails due to validation error (400), the detail panel remains open and displays:
- Toast: "Failed to save record: {error message}"
- Inline highlighting of invalid fields (red border)
- Field-level error messages (if API provides them)

### 15.3 Version Conflict (409)

If a save fails with HTTP 409 (version conflict):
1. Toast: "Record modified by another user — reloading"
2. Automatically fetch fresh record from API
3. Reload detail panel with updated data
4. User must re-apply their changes

---

## §16. Browser Compatibility

- **Chrome/Edge**: Latest 2 versions (full support)
- **Firefox**: Latest 2 versions (full support)
- **Safari**: Latest 2 versions (full support)
- **IE11**: Not supported (ES6 syntax, Fetch API, modern CSS required)

**Required Browser APIs**:
- Fetch API (XMLHttpRequest fallback not provided)
- ES6 (arrow functions, template literals, Promise)
- CSS Flexbox and Grid
- LocalStorage
- Date input type

---

## §17. Performance Considerations

### 17.1 Data Loading

- Default page size: 20 records (configurable to 10, 50, or 100)
- Records are fetched via API with pagination
- Detail panels fetch individual records on-demand (or use cached data if available)

### 17.2 Rendering Performance

- Large tables (200+ rows): Browser table rendering may lag; consider virtualizing tbody
- Detail panel sections: Collapsed sections are hidden with CSS `display:none` to avoid DOM bloat

### 17.3 API Call Optimization

- Batch operations (mark ready, reprocess, confirm) use single API call with multiple record IDs
- Detail panel avoids API call if record is already in the table's cached result set
- Summary tab uses aggregation endpoint (not row-by-row fetch)

---

## §18. Security Considerations

### 18.1 Input Validation

- All user inputs are HTML-escaped before rendering to prevent XSS
- `<textarea>` fields have maxlength attributes (500-1000 chars)
- Decimal inputs use `type="number" step="any"` to prevent non-numeric entry
- Date inputs use `type="date"` for browser validation

### 18.2 CSRF Protection

- Joget's built-in CSRF token handling applies (inherited from platform)
- API calls include api_id and api_key headers for authentication

### 18.3 Authorization

- Row-level security is enforced by enrichment-api
- The workspace does not re-enforce authorization; it trusts the API
- Users can see only records they have permission to access (enforced server-side)

---

## §19. Deployment Checklist

Before deploying enrichment-workspace to production:

- [ ] Verify enrichment-api plugin is installed and configured
- [ ] Configure API Builder ID and key in plugin settings
- [ ] Verify MySQL table (app_fd_trx_enrichment) exists with correct schema
- [ ] Create Joget form (trxEnrichment) for detail panel
- [ ] Create Joget datalists for each of the 5 tabs (or use workspace plugin's built-in lists)
- [ ] Test all toolbar actions (mark ready, split, merge, confirm, reprocess, delete)
- [ ] Test detail panel editing with read-only and editable statuses
- [ ] Verify status transitions respect gam-framework rules
- [ ] Test filtering and pagination with large datasets (200+ records)
- [ ] Test statement scoping (statement_id parameter)
- [ ] Load test: 50+ concurrent users, 1000+ records per statement
- [ ] Browser testing: Chrome, Firefox, Safari (latest versions)
- [ ] Accessibility audit: WCAG 2.1 AA level

---

## §20. Future Enhancements (Post-MVP)

### Phase 6: Split/Merge UI
- Implement split dialog with allocation interface
- Implement merge dialog with reconciliation check

### Phase 7: Advanced Filtering
- Date range picker for transaction dates
- Amount range slider
- Multi-select for customer or counterparty

### Phase 8: Bulk Editing
- Select multiple records, edit common fields in-place
- Bulk status transition without dialogs

### Phase 9: Reconciliation Panel
- Per-statement reconciliation summary (totals, variances, tolerance)
- Drill-down from summary to detail records

### Phase 10: Configuration UI
- Admin panel to manage field definitions, status transitions, ref data
- CRUD interface for internal_type, asset_category, fx_rate_source options

### Phase 11: Audit Trail
- Detailed history of all changes to each record
- Filter by user, timestamp, field

### Phase 12: Import/Export
- Export selected records to CSV or Excel
- Import enrichment data from file

---

## Appendix A: Cross-References

| Specification | Purpose |
|---|---|
| gam-framework-specification.md | Status enum values, StatusManager, audit tracking |
| enrichment-api-specification.md | REST API contract, validation rules, reconciliation logic |
| rows-enrichment-spec.md | Automated enrichment pipeline that feeds F01.05 records into workspace |
| trx-enrichment-db-schema.md | F01.05 table schema and field definitions |

---

## Appendix B: Example Workflows

### Workflow 1: Simple Enrichment

1. User navigates to Statement form (F01.00)
2. Clicks "Review Enrichment" button → opens enrichment-workspace in modal
3. Workspace loads; shows 10 records with status=new or enriched
4. User clicks on a record → detail panel opens
5. User edits internal_type, validated_currency, resolved_customer_id
6. Clicks Save → record updated, panel closes, table refreshed
7. User selects 5 enriched records and clicks "Mark as Ready"
8. Selected records transition to status=ready and move to Ready tab
9. User reviews ready records, selects all, clicks "Confirm for Posting"
10. Dialog shows currency breakdown, user confirms
11. Records transition to status=confirmed and appear in Confirmed tab

### Workflow 2: Error Resolution

1. Pipeline fails to enrich a record → status=error
2. Record appears in Workspace tab with error message
3. User clicks record → detail panel opens, shows error_message at bottom
4. User manually fixes the data (customer ID, asset ID, etc.)
5. Clicks Save → record saved with updated data
6. System automatically marks record as status=manual_review (or user clicks "Mark as Ready")
7. User selects record and clicks "Reprocess"
8. Record transitions to enriched (after successful reprocessing) or ready (if user judgment was final)

### Workflow 3: Split and Merge

1. User selects a large transaction (total amount 10,000 EUR) that should be split
2. Clicks "Split" → dialog opens with original amount and fields for 2+ children
3. User enters: Child 1: 6,000 EUR (description: "First split"), Child 2: 4,000 EUR (description: "Second split")
4. Clicks Confirm → API creates 2 new records with origin=split, parent_enrichment_id={original}
5. Original record status → superseded; children inherit most fields
6. Later, user realizes 2 smaller records should be merged back
7. Selects both child records, clicks "Merge"
8. Dialog shows merged preview; user confirms
9. API creates new merged record with origin=merge; children marked superseded
10. Merged record appears in Workspace tab with status=enriched

---

**End of Specification**

*Version 2.0.0 — Comprehensive with Business Rules and Field Editability Matrix*
