# FIH SITE RELIABILITY STANDARD

This file locks the daily reliability architecture.

## Invariants
1. A scheduled clock time is a trigger, not a completion guarantee.
2. The durable run identity is `daily:YYYY-MM-DD`; retries and watchdog recovery resume that same run.
3. The ledger heartbeat distinguishes active execution from stale/interrupted execution.
4. Missing trigger, stale heartbeat, response boundary, transient failure, and partial work are RECOVERING states.
5. Verified per-fixture work is idempotent and must not be repeated merely because execution resumes.
6. Production freshness is part of completion: today's public artifact and intended deployed commit must be verified before COMPLETE.
7. A watchdog independently checks for missing/stale/incomplete execution.
8. Recurring automation remains enabled after individual failures.

## Reliability flow
Primary trigger -> contract preflight -> deterministic canonical-artifact reconciliation -> adaptive streaming fixture workers -> immediate validated-fixture checkpoint/verification -> aggregate verification -> COMPLETE.

## Execution architecture
- Canonical research/model/decision artifacts are the source of truth; the ledger is a derived recovery/checkpoint index.
- Step 2 normal daily execution uses an adaptive streaming worker pool with no fixed fixture-count concurrency ceiling; actual active work is limited dynamically by safe ChatGPT web-search/tool capacity and provider/execution headroom. Fixture evidence must never be shared or mixed between workers.
- A fixture work unit is research -> validation -> locked model or INSUFFICIENT_DATA -> BET/NO_BET/NO_MODEL -> canonical persistence/verification.
- Independent artifact writes and commits should be batched where safe. Avoid per-transition commit/reread churn when the same integrity guarantee can be verified at the completed fixture-work-unit boundary.
- Reconciliation is deterministic and idempotent: valid research+model+decision artifacts monotonically promote a fixture to COMPLETE even when the ledger is stale.
- The primary daily executor continuously refills released Step-2 capacity until TERM-002 or an unavoidable invocation boundary. Before a boundary it verifies the latest accumulator checkpoint and durable RECOVERING cursor.
- The watchdog is recovery-only. It must not be the normal pacing mechanism for an active daily cycle.
- Publication/Vercel health is observed separately and cannot block completion of the prediction-computation cycle.

Watchdog -> inspect today's durable run -> NOOP when active/complete -> START_OR_RESUME when absent -> RECOVER when stale/incomplete -> resume earliest unfinished unit.

## Service objective
A missed primary trigger must not silently lose the day. An incomplete run must remain visibly recoverable until the contract completion gate passes.
