# BUG: SELL Transaction Allocation Broken — Frontend + Backend

**Severity:** High
**Component:** enrichment-workspace (frontend) + enrichment-api (backend)
**Date:** 2026-03-15
**Reported by:** Aare Lapõnin
**Status:** Open

---

## Summary

SELL transactions (e.g. EQ_SELL TRX-7C16A3 for ADBE, qty -40.00) cannot be allocated. There are bugs in both frontend and backend:

1. **Frontend (fixed):** Dialog showed "Fully Allocated" before any allocation, because negative totalQty made remaining negative. Fixed by applying `Math.abs()` to totalQty.
2. **Frontend (fixed):** Detail panel defaulted to "Fully Allocated" for any paired transaction without `fund_allocation_status`. Fixed by changing fallback to `'pending'`.
3. **Backend (open):** After frontend fixes, clicking "Allocate" returns **HTTP 400** because `EnrichmentService.allocateTrade()` rejects the SELL quantity as invalid.

---

## Root Cause Analysis

### Bug 1 (Frontend — FIXED): Negative `remaining` in allocation dialog

**File:** `ew-actions.js`, line 2012
**Fix applied:** `var totalQty = Math.abs(parseFloat(secuTrx.quantity) || 0);`

### Bug 2 (Frontend — FIXED): Paired status fallback to "allocated"

**File:** `ew-detail.js`, lines 310, 761, 784
**Fix applied:** Changed fallback from `(r.status === 'paired' ? 'allocated' : 'pending')` to `'pending'`

### Bug 3 (Backend — OPEN): Quantity validation rejects negative SELL quantity

**File:** `EnrichmentService.java`, line 1131–1133

```java
BigDecimal secuQty = parseBigDecimal(secu.get(ac.getSecuQuantityField()));
// ...
if (secuQty.compareTo(BigDecimal.ZERO) <= 0) {
    throw new IllegalArgumentException("Securities transaction has no valid quantity");
}
```

**Problem:** The securities transaction for SELL stores quantity as negative (`-40.000000` in `app_fd_secu_total_trx`). The validation check `secuQty <= 0` throws immediately for any SELL transaction. This is the HTTP 400 error seen in the screenshot.

**Database evidence:**
```sql
SELECT c_quantity FROM app_fd_secu_total_trx WHERE id = 'd0dfa821-...';
-- Result: -40.000000
```

### Bug 4 (Backend — OPEN): Remaining quantity calculation wrong for SELL

**File:** `EnrichmentService.java`, line 1175

```java
BigDecimal remaining = secuQty.subtract(alreadyAllocated);
```

For SELL: `remaining = -40.00 - 0.00 = -40.00`. Then at line 1176:
```java
if (quantity.subtract(remaining).doubleValue() > ac.getQuantityTolerance()) {
    throw new IllegalArgumentException("Requested quantity ... exceeds remaining ...");
}
```
`20.00 - (-40.00) = 60.00 > tolerance` — would always throw.

### Bug 5 (Backend — OPEN): Fee proration divides by negative secuQty

**File:** `EnrichmentService.java`, line 1209

```java
BigDecimal feeAmount = secuFee.multiply(quantity).divide(secuQty, 6, RoundingMode.HALF_UP);
```

For SELL: `feeAmount = (-30.00 * 20) / (-40.00) = 15.00` — this actually produces the correct result mathematically (negatives cancel), but the sign semantics could be confusing. The fee for SELL should be negative (a cost reduction from the sell proceeds). Should be verified.

### Bug 6 (Backend — OPEN): Post-allocation status check uses tolerance on mismatched signs

**File:** `EnrichmentService.java`, lines 1394–1396

```java
BigDecimal newAllocatedQty = alreadyAllocated.add(quantity);
if (newAllocatedQty.subtract(secuQty).abs().doubleValue() <= ac.getQuantityTolerance()) {
    newAllocStatus = "allocated";
}
```

For SELL: `newAllocatedQty = 0 + 20 = 20`, `secuQty = -40`. So: `|20 - (-40)| = |60| = 60 > tolerance` → "partially_allocated". This is actually safe (won't give a false positive), but when all 40 are allocated: `|40 - (-40)| = 80 > tolerance` → would never become "allocated". **SELL can never reach "fully allocated" status.**

### Bug 7 (Backend — OPEN): remainingQty in response uses raw negative secuQty

**File:** `EnrichmentService.java`, line 1436

```java
result.put("remainingQty", secuQty.subtract(newAllocatedQty).doubleValue());
```

For SELL: `-40.00 - 20.00 = -60.00` — nonsensical remaining quantity.

---

## Complete Fix Specification

### Backend Fix — `EnrichmentService.java`

The core issue is that the allocation logic was written for BUY (positive quantities) only. For SELL, the securities transaction quantity is negative. The cleanest fix is to **normalize `secuQty` to its absolute value** early in the method, since the direction is already tracked separately via `isBuy`/`isSell`.

#### Fix 3a: Normalize secuQty (line 1125)

```java
// BEFORE (line 1125):
BigDecimal secuQty = parseBigDecimal(secu.get(ac.getSecuQuantityField()));

// AFTER:
BigDecimal secuQty = parseBigDecimal(secu.get(ac.getSecuQuantityField())).abs();
```

This single change fixes Bug 3 (validation), Bug 4 (remaining), Bug 6 (allocation status), and Bug 7 (response). The `.abs()` normalizes -40 → 40, making all downstream arithmetic work correctly for both BUY and SELL.

The existing validation at line 1131 (`secuQty <= 0`) then correctly guards against zero-quantity records.

#### Fix 3b: Also normalize secuFee (line 1127)

```java
// BEFORE (line 1127):
BigDecimal secuFee = parseBigDecimal(secu.get(ac.getSecuFeeField()));

// AFTER:
BigDecimal secuFee = parseBigDecimal(secu.get(ac.getSecuFeeField())).abs();
```

Ensures fee proration at line 1209 always produces a positive fee amount. The lot record can then store fee as positive regardless of direction. The sign is implicit from the lot's `direction` field.

**Alternatively**, if the sign of the fee matters for accounting, leave secuFee as-is and only normalize secuQty. The fee division `(-30 * 20) / 40 = -15` produces a negative fee, which may be semantically correct for SELL (fee reduces proceeds). **This needs a product decision.**

---

## Affected Code Summary

| # | Component | File | Line(s) | Bug | Fix |
|---|-----------|------|---------|-----|-----|
| 1 | Frontend | `ew-actions.js` | 2012 | Negative totalQty → wrong remaining | `Math.abs()` — **DONE** |
| 2 | Frontend | `ew-detail.js` | 310, 761, 784 | Paired fallback → "allocated" | Fallback to `'pending'` — **DONE** |
| 3 | Backend | `EnrichmentService.java` | 1131 | `secuQty <= 0` rejects SELL | Normalize with `.abs()` at line 1125 |
| 4 | Backend | `EnrichmentService.java` | 1175 | `remaining = -40 - 0 = -40` | Fixed by normalizing secuQty |
| 5 | Backend | `EnrichmentService.java` | 1209 | Fee division with negative secuQty | Fixed by normalizing secuQty (and optionally secuFee) |
| 6 | Backend | `EnrichmentService.java` | 1396 | `\|alloc - (-40)\| = 80 > tolerance` | Fixed by normalizing secuQty |
| 7 | Backend | `EnrichmentService.java` | 1436 | `remainingQty = -40 - 20 = -60` | Fixed by normalizing secuQty |

---

## Testing Plan

1. **SELL allocation happy path:** Allocate 20 of 40 ADBE shares (TRX-7C16A3) to ADVERTA GRUPP OÜ
   - Backend should return HTTP 200
   - Allocation lot should be created with direction "SELL"
   - Position quantity should decrease by 20
   - Realized P&L should be calculated
   - `fund_allocation_status` should be "partially_allocated"

2. **SELL full allocation:** Allocate remaining 20 shares
   - `fund_allocation_status` should become "allocated"
   - Detail panel should show "Fully Allocated"

3. **SELL position check (V9):** Try to sell more than customer holds
   - Should return "Customer has insufficient holdings"

4. **BUY regression:** Re-test a BUY allocation (e.g. EQ_BUY)
   - Must still work correctly end-to-end

5. **Edge cases:**
   - SELL with zero fee
   - SELL with fractional quantities
   - Partial SELL followed by another partial SELL

---

## Implementation Notes

- **Backend fix is a one-line change** at `EnrichmentService.java` line 1125: add `.abs()`
- Optionally also normalize `secuFee` at line 1127
- Frontend fixes are already deployed
- Backend requires Maven rebuild of `enrichment-api` plugin
