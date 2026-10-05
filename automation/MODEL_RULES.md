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

## Approved prediction markets
FIH predicts exactly these market families for every modelled fixture:
1. Match Result (1X2): Home / Draw / Away
2. Over/Under Goals: 1.5, 2.5 and 3.5 lines
3. Both Teams to Score (BTTS): Yes / No
4. Double Chance: 1X / X2 only; 12 is not an approved FIH market
5. Team to Score 1+ Goal: Home 1+ / Away 1+
6. Correct Score: most likely score plus alternatives; analytical prediction only, never the recommended betting market

Training/calibration must report these market families separately. Do not introduce a new public betting market without updating this contract.

## One recommended market
Correct score remains analytical only. Select at most one betting market or NO BET.

Raw floors remain market-specific, but ranking is now by reliability-adjusted probability rather than raw probability.
- 1X/X2 raw >=72
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


## V2.3 promotion decision
Calibration evidence at promotion: 54 deterministically graded recommendations from completed backtests 65590 and 73956, 45W/9L (83.3%). By selected pick: O1.5 12/14 (85.7%), 1X 10/12 (83.3%), U3.5 14/17 (82.4%), X2 9/11 (81.8%). The sample does not justify deleting a market or raising the global 68 adjusted floor. V2.3 therefore makes one conservative behavioral change: unknown recent O3.5 volatility is explicitly penalized at 0.90 reliability for U3.5. It also fixes model-version attribution so new predictions identify V2.3. Future backtests must compare V2.3 out-of-sample against this frozen V2.2 baseline before further promotion.
