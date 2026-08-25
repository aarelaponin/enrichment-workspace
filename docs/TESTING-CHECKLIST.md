# Enrichment Workspace v2.0 — Testing Checklist

Manual acceptance criteria from SPEC.md §17.2.
The plugin renders inside the Joget Userview content area — sidebar navigation is handled by Joget, not by the plugin.

## Pre-requisites
- Deploy enrichment-workspace JAR to Joget
- Deploy enrichment-api JAR to Joget
- Have at least one statement with enrichment records loaded (142-record dataset)

---

## 1. Layout & Header
- [ ] Plugin renders within Joget content area (no duplicate sidebar)
- [ ] Header bar shows: "Enrichment Workspace v2.0.0", record count, load time
- [ ] Content stacks vertically: header → overview → toolbar → filters → table → pagination

## 2. Collapsible Overview (Summary Dashboard)
- [ ] Overview section renders below header with "OVERVIEW" label and chevron toggle
- [ ] KPI cards show: Total Records, Automation Rate, Loan Transactions, Fund Transactions, Needs Attention
- [ ] "Needs Attention" card shown only when there are UNK/missing customers
- [ ] Clicking chevron collapses to a single mini-summary line (e.g. "142 records · 100% auto · 36 loan · 16 fund · 100 attention")
- [ ] Clicking again expands back to full dashboard
- [ ] Collapse state persists during the session

## 3. Toolbar
- [ ] Toolbar shows grouped buttons: Confirm, Mark Ready | Split ▾, Merge | Operations ▾ | Reprocess, Delete ... New Entry, Export
- [ ] Split dropdown shows 4 items (Generic, Loan Payment, Multi-Period, Fee Disaggregation)
- [ ] Operations dropdown shows 11 items with separators
- [ ] Buttons enable/disable correctly based on selection:
  - Confirm: any selected has status=ready
  - Mark Ready: any selected in [enriched, adjusted, in_review, paired]
  - Split: exactly 1 selected, editable status
  - Merge: 2+ selected, all in [enriched, adjusted, in_review]
  - Operations: exactly 1 selected, editable status
  - Reprocess: any selected in [error, manual_review]
  - Delete: any selected in [error, manual_review]

## 4. Collapsible Filters
- [ ] Filters section renders below toolbar with "FILTERS" label and chevron toggle
- [ ] Expanded view shows: status dropdown, source dropdown, type dropdown, customer ID input, description input, Fund-only checkbox, Loan-only checkbox, Search button, Reset button
- [ ] Clicking chevron collapses to a single line showing active filter summary (e.g. "Filters: status=enriched, type=LOAN_PAYMENT" or "Filters: none")
- [ ] Clicking again expands back to full filter bar
- [ ] Typing in description field and clicking Search filters on description text
- [ ] Fund-only checkbox filters to fund transaction types only
- [ ] Loan-only checkbox filters to loan transaction types only
- [ ] Reset clears all filters and reloads unfiltered data
- [ ] Collapse state persists during the session

## 5. Transaction Table & Type Badges
- [ ] Table renders 142 records with columns: STATUS, SRC, DATE, TYPE, DESCRIPTION, D/C, AMOUNT, FEE, TOTAL, CCY, CUSTOMER, ASSET, CP, ORIGIN, CONF.
- [ ] Type column shows colored badges by category:
  - loan types (amber): LOAN_PAYMENT, LOAN_DISBURSEMENT, INT_INCOME, INT_EXPENSE
  - sec types (indigo): SEC_BUY, SEC_SELL, EQ_BUY, EQ_SELL, BOND_BUY, BOND_INT, SPLIT_IN, SPLIT_OUT
  - fund types (blue): DIV_INCOME, DIV_TAX, ASSET_RETURN, INV_INCOME
  - fx types (green): FX_EXCHANGE
  - fee types (pink): COMM_FEE, MGMT_FEE, ADMIN_FEE, LEGAL_FEE, TAX
- [ ] Inline link icon (🔗) shows next to type badge when loan_id is populated
- [ ] Fund icon (📊) shows for fund transaction types
- [ ] Customer column: fund customer (12345678) in bold blue, UNK in red
- [ ] Row tinting: light amber for loan types, light red for needs-attention rows
- [ ] Pagination renders below table with configurable page size

## 6. Detail Panel (Slide-Over)
- [ ] Click a row opens detail slide-over from right
- [ ] Context ribbons show based on transaction state:
  - Loan type + no loan_id → amber "Not linked to contract" ribbon
  - LOAN_PAYMENT + loan_id → blue "Can be split into principal + interest" ribbon
  - Fund transaction → blue "Allocate to investors" ribbon
  - customer_code = UNK → amber "Unknown customer" ribbon
- [ ] Operation button bar shows context-specific action buttons
- [ ] 8 sections total, all collapsible:
  - §1 Core Fields, §2 Amounts, §3 Classification, §4 Counterparty
  - §5 Processing, §6 Loan Contract (conditional — shows when loan_id populated)
  - §7 Fund Allocation (conditional — shows for fund transactions)
  - §8 Audit Trail
- [ ] Field editing works inline with save button
- [ ] Close button / clicking outside closes panel

## 7. Loan Workflow (1B + 1C)
- [ ] Loan Payment Split dialog:
  - Opens from Split ▾ → Loan Payment Split (with LOAN_PAYMENT record selected)
  - Shows contract card with contract details fetched from API
  - Principal + interest allocation fields
  - Expected interest calculation displayed (rate × outstanding × days / basis)
  - Variance indicator when entered interest differs from expected
  - Submit creates two child records (principal + interest)
  - Parent record status updates accordingly
  - Toast confirms success
- [ ] Link to Loan Contract dialog:
  - Opens from Operations ▾ → Link to Loan Contract
  - Auto-suggests contracts based on description text
  - Contract picker table with radio selection
  - Save links the loan_id to the record
  - Toast confirms success
- [ ] Interest verification:
  - Detail panel §6 Loan Contract shows expected vs actual interest
  - Variance highlighted when mismatch

## 8. Core Operations (1D — regression)
- [ ] Generic split: toolbar → Split ▾ → Generic Split → allocate amounts → submit creates children
- [ ] Merge: select 2+ records → Merge → confirm → creates merged record
- [ ] Confirm for Posting: select ready records → Confirm → reconciliation panel → confirm → status=confirmed
- [ ] Mark Ready: select enriched records → Mark Ready → status=ready
- [ ] Return to Editing: select ready record → Operations ▾ → Return to Editing → status=enriched
- [ ] Reprocess: select error record → Reprocess → re-enrichment triggered
- [ ] Delete: select record → Delete → confirm dialog → record removed
- [ ] New Manual Entry: toolbar → + New Entry → fill fields → save → new record appears
- [ ] Reclassify: Operations ▾ → Reclassify → type dropdown + quick chips → save
- [ ] Reassign Customer: Operations ▾ → Reassign → customer search → save
- [ ] Flip D/C: Operations ▾ → Flip D/C → direction flips → save
- [ ] FX Override: Operations ▾ → FX Override → rate input + live EUR preview → save
- [ ] CSV Export: toolbar → Export → CSV downloads with correct data

## 9. Build & Deploy
- [ ] `mvn clean package` succeeds without errors
- [ ] `mvn test` — all Java unit tests pass
- [ ] Browser JS tests pass (open test-runner.html in Chrome)
- [ ] No JS console errors after deployment
- [ ] No JS console warnings related to EW namespace
- [ ] Visual comparison against v2 prototype matches (for styling, badges, dialogs — not sidebar layout)

## 10. Edge Cases
- [ ] Empty workspace (no records for selected statement) renders gracefully with "No records" message
- [ ] Pagination works correctly when filters reduce result set
- [ ] Dropdown menus (Split ▾, Operations ▾) close on outside click
- [ ] Overview collapse + filters collapse both work independently
- [ ] Detail panel opens correctly after filter change
- [ ] Optimistic locking: edit a field, have another user edit same record, save → conflict toast shown
- [ ] Very long description text truncates in table, shows full in detail panel
- [ ] Amount formatting: negative amounts shown in red, proper decimal alignment
