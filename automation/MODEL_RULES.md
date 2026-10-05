# Deterministic Model Rules — V2.2

V2.2 keeps the normalized Dixon-Coles score engine and adds evidence-aware calibration to the recommendation layer.

## Core
- Separate attack/defence strengths and league home/away baselines.
- 65/35 stable/recent blend where both exist.
- Lambda clamp 0.2–4.0; rho default -0.08; normalized 0–8 score grid.
- Sparse evidence shrinks calculated lambdas toward league baselines instead of trusting tiny samples at full strength.

## Evidence factor
Model level: Full 1.00, Standard 0.96, Basic 0.90.
Sample depth: 8+ matches 1.00; 5–7 0.97; 3–4 0.92; 1–2 0.84.
Combined factor affects both lambda shrinkage and recommendation reliability.

## One recommended market
Correct score remains analytical only. Select at most one betting market or NO BET.

Raw floors remain market-specific, but ranking is now by reliability-adjusted probability rather than raw probability.
- 1X/X2 raw >=72
- 12 >=75
- O1.5 >=72
- O2.5 >=68
- U3.5 >=72, with a volatility penalty from recent O3.5 rate
- BTTS Yes/No >=68
- Home 1+ >=74 plus scoring-consistency penalty
- Away 1+ >=78 plus stricter away-scoring consistency penalty
- 1X2 Home/Away >=62
Adjusted recommendation probability must also be >=68.

Store rawProbability, reliability and adjusted probability for auditability. Rating is based on adjusted probability: Elite >=85, Strong >=75, Good >=68.

## Weekly calibration
Backtests must be walk-forward with no future leakage. Track hit rate, Brier/log loss where applicable, market type, probability band, model level and sample depth.

Do not automatically promote a parameter change merely because it improves one weekly sample. A candidate change must improve a sufficiently sized holdout and must not materially damage calibration or key market segments.

## NO BET reporting rule
- `NO BET` is an internal model decision, not a prediction result.
- Retain `NO BET` fixtures only in the internal audit for traceability.
- Exclude `NO BET` fixtures from displayed backtest results, wins/losses, hit-rate denominators, market results, rating results, model-level performance results, sample-depth performance results, calibration results, and any headline performance statistics.
- User-facing backtest result tables must show recommended bets only unless the user explicitly asks to inspect `NO BET` cases.
- `NO MODEL` is likewise not a betting result and must not be mixed into recommended-bet performance statistics.


## Backtest-calibrated U3.5 evidence guard
Combined completed backtests 73956 and 65590 contain 54 deterministically graded recommendations (45W/9L, 83.3%). U3.5 is 14W/3L (82.4%), so the market remains eligible. However, Basic-evidence runs often omit recentOver35Rate; missing volatility must never be interpreted as zero volatility. When recentOver35Rate is unknown, apply a 0.90 U3.5 market-reliability multiplier before the evidence/sample factor. When known, retain the existing volatility formula. This is a conservative missing-data guard, not a ban on U3.5.
