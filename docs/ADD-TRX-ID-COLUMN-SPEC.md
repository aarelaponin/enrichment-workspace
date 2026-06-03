# Enrichment-Workspace — Add Transaction ID Column to Main List

**Version:** 1.0
**Date:** 15 March 2026
**Plugin:** enrichment-workspace
**Priority:** High — needed for daily operator workflow
**Estimated effort:** < 1 hour

---

## 1. Problem

The main transaction enrichment list (`list_trxEnrichment`, visible at the Enrichment Workspace page) does not display the transaction ID (`id` field, e.g. `TRX-7C16A3`). Operators cannot identify specific transactions by their ID without opening each record individually.

This is a problem because:

- The enrichment-api allocation endpoint requires an `enrichmentId` parameter — operators need to know the ID to reference transactions in API calls, logs, and troubleshooting.
- When investigating allocation results in F03 forms (allocation lots reference `sourceTransactionId`), operators cannot cross-reference back to the main list.
- Searching or filtering by transaction ID is not possible in the current UI.

---

## 2. Current Columns

The list currently displays 15 columns in this order:

1. SrcTp (source_tp)
2. Status (status)
3. CP (counterparty_short_code)
4. AsClass (asset_class)
5. StDate (statement_date)
6. TrxDate (transaction_date)
7. OrAmount (original_amount)
8. TAmount (total_amount)
9. Fee (fee_amount)
10. Customer (resolved_customer_id)
11. AsBsCcy (asset_base_currency)
12. IntTp (internal_type)
13. D/C (debit_credit)
14. Desc (description)
15. Origin (origin)

The `id` field exists in the underlying `trxEnrichment` form/table but is not configured as a visible column.

---

## 3. Required Change

### 3.1 Add "Trx ID" Column

Add a new column as the **first column** (before SrcTp) in the datalist definition:

| Property | Value |
|----------|-------|
| Column ID | `column_id` |
| Name | `id` |
| Label | `Trx ID` |
| Sortable | true |
| Hidden | false |
| Width | (leave default) |

No formatter is needed — the raw ID value (e.g. `TRX-7C16A3`) is the desired display.

### 3.2 Add "Trx ID" Filter

Add a text filter so operators can search by transaction ID:

| Property | Value |
|----------|-------|
| Filter ID | `filter_5` |
| Name | `id` |
| Label | `Trx ID` |
| Type | `TextFieldDataListFilterType` |

### 3.3 JSON Change

In `docs/F01.05-trxEnrichment-List.json`, insert the following column definition as the **first entry** in the `columns` array:

```json
{
    "id": "column_id",
    "name": "id",
    "label": "Trx ID",
    "filterable": true,
    "hidden": "false",
    "sortable": "true",
    "datalist_type": "column",
    "renderHtml": "",
    "exclude_export": "",
    "width": "",
    "style": "",
    "alignment": "",
    "headerAlignment": "",
    "action": {
        "className": "",
        "properties": {}
    },
    "format": {
        "className": "",
        "properties": {}
    }
}
```

And append the following filter to the `filters` array:

```json
{
    "id": "filter_5",
    "name": "id",
    "label": "Trx ID",
    "filterParamName": "d-8227934-fn_id",
    "type": {
        "className": "org.joget.apps.datalist.lib.TextFieldDataListFilterType",
        "properties": {}
    }
}
```

---

## 4. Deployment

This change can be applied either:

- **Via JSON:** Update the datalist JSON and re-import through Joget App Composer
- **Via List Builder UI:** Open `list_trxEnrichment` in Joget List Builder, drag the `ID` column from the palette to first position, and add a filter — no code deployment required

---

## 5. Verification

After applying the change:

1. Open the Enrichment Workspace page
2. Confirm "Trx ID" appears as the first column with values like `TRX-7C16A3`
3. Confirm the Trx ID filter field is present and can filter by partial ID match
4. Confirm sorting by Trx ID works (click column header)
