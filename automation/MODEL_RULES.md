# Deterministic Model Rules — V2.3

V2.3 preserves the V2.2 normalized Dixon-Coles score engine and recommendation floors, then adds backtest-calibrated missing-data protection. Historical V2.2 backtests remain immutable evidence and must not be relabelled as V2.3.

## Core
- Separate attack/defence strengths and league home/away baselines.
- 65/35 stable/recent blend where both exist.
- Lambda clamp 0.2–4.0; rho default -0.08; normalized 0–8 score grid.
- Sparse evidence shrinks calculated lambdas toward league baselines instead of trusting tiny samples at full strength.

## Evidence factor
Model level: Full 1.00, Standard 0.96, Basic 0.90.
Sample depth: 8+ matches 1.00; 5–7 0.97; 3–4 0.92; 1–2 0.84.
Combined factor affects both lambda shrinkage and recommendation reliability.

## Approved prediction market — authoritative scope
FIH predicts ONLY **Match Result (1X2)** for every modelled fixture:
- Home
- Draw
- Away

No Total Goals, BTTS, Double Chance, Team Goals, Correct Score, Asian handicap, draw-no-bet, corners, cards, half-time, player props, win-to-nil, or any other market may be predicted or recommended by the public FIH workflow unless the user explicitly approves a future contract change outside execution.

## One recommended market
For each fixture, calculate the three 1X2 outcome probabilities (Home / Draw / Away), then select at most one eligible 1X2 recommendation, otherwise NO BET.

Eligibility floors for the approved recommendation candidates:
- 1X2 Home >=62 raw
- 1X2 Draw >=62 raw
- 1X2 Away >=62 raw

The reliability-adjusted recommendation probability must also be >=68. Ranking is by reliability-adjusted probability, not raw probability.

Store `rawProbability`, `reliability` and adjusted `probability` for auditability. Rating is based on adjusted probability: Elite >=85, Strong >=75, Good >=68.

## Weekly calibration
Backtests must be walk-forward with no future leakage. Track hit rate, Brier/log loss where applicable, market type, probability band, model level and sample depth.

Do not automatically promote a parameter change merely because it improves one weekly sample. A candidate change must improve a sufficiently sized holdout and must not materially damage calibration or key market segments.

## NO BET reporting rule
- `NO BET` is an internal model decision, not a prediction result.
- Retain `NO BET` fixtures only in the internal audit for traceability.
- Exclude `NO BET` fixtures from displayed backtest results, wins/losses, hit-rate denominators, market results, rating results, model-level performance results, sample-depth performance results, calibration results, and any headline performance statistics.
- User-facing backtest result tables must show recommended bets only unless the user explicitly asks to inspect `NO BET` cases.
- `NO MODEL` is likewise not a betting result and must not be mixed into recommended-bet performance statistics.


## V2.3 promotion decision
Calibration evidence at promotion: 54 deterministically graded recommendations from completed backtests 65590 and 73956, 45W/9L (83.3%). Historical multi-market evidence remains immutable audit history, but all new production evaluation and promotion decisions must isolate 1X2 outcomes only. Future backtests must compare current 1X2 production performance out-of-sample before further promotion.
