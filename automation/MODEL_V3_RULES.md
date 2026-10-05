# V3.0 Shadow Challenger

**Status: EXPERIMENTAL / SHADOW ONLY.** V3.0 must not publish public recommendations or replace locked V2.9 without explicit promotion approval after separate backtesting and forward comparison.

## Initial hypotheses
1. Scoreline, goal probabilities and match direction should tell a coherent story. Contradictions are explicit REVIEW diagnostics rather than hidden.
2. Rest-day imbalance can provide a small, bounded directional adjustment.
3. Availability/expected-lineup strength can provide a bounded directional adjustment when reliable evidence exists.
4. Missing challenger inputs are neutral; they must never be fabricated.
5. V2.9 remains the production control on every comparison.

## Phase 1
- Reuse the locked V2.9 football engine as the control foundation without editing it.
- Add shadow-only context diagnostics for rest and availability.
- Emit a predicted score derived from lambdas.
- Flag score-vs-Over-2.5, score-vs-direction, and score-vs-total-lambda inconsistencies.
- Do not publish V3 selections yet.

## Promotion criteria
V3.0 requires a separate historical backtest and a forward champion-vs-challenger sample. Promotion must consider hit rate, Brier/calibration, bet volume and ROI when reliable pre-kickoff odds exist. No production promotion occurs automatically.
