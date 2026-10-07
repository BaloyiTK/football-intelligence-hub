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
Primary trigger -> contract preflight -> durable ledger/heartbeat -> bounded work units -> persist/verify -> publication -> production verification -> COMPLETE.

Watchdog -> inspect today's durable run -> NOOP when active/complete -> START_OR_RESUME when absent -> RECOVER when stale/incomplete -> resume earliest unfinished unit.

## Service objective
A missed primary trigger must not silently lose the day. An incomplete run must remain visibly recoverable until the contract completion gate passes.
