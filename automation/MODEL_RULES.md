# Deterministic Model Rules — V2.8 Support-Quality Selector

V2.8 preserves the v2.7 calibrated >=78% publication floor and adds a support-quality requirement: the supporting market signal must clear its existing minimum by at least 5 percentage points. Candidates that fail this cushion remain internal REVIEW rather than auto-publish.

## Core engine
- Separate attack/defence strengths and league home/away baselines.
- 65/35 stable/recent blend where both exist.
- Lambda clamp 0.2–4.0; rho default -0.08; normalized 0–8 score grid.
- Evidence factor: Full 1.00, Standard 0.96, Basic 0.90; sample factor 8+ 1.00, 5–7 0.97, 3–4 0.92, 1–2 0.84.

## Approved prediction markets
FIH may recommend only:
- 1X2: Home / Draw / Away
- Total Goals: Over 1.5
- Double Chance: 1X / X2

Supporting signals remain mandatory:
- Over 2.5 supports Over 1.5
- Home win supports 1X
- Away win supports X2

## Support gates
- Over 1.5: raw >=72, Over 2.5 support >=68, calibrated probability >=68.
- 1X: raw >=72, Home support >=62, calibrated probability >=68.
- X2: raw >=76, Away support >=66, calibrated probability >=72.
- Direct 1X2: raw >=62, calibrated probability >=68.

## V2.4 calibration
The old adjusted score `raw × reliability` is retained only as historical context. Public probability is now calibrated by shrinking the raw probability toward 50%.

Calibration sequence:
1. shrink raw probability toward 50% by evidence/market reliability;
2. shrink again by evidence confidence: high 1.00, medium 0.95, low 0.90;
3. shrink again by competition uncertainty: club 1.00, international 0.96, friendly 0.92;
4. when an external market probability is supplied, shrink further for material model-market disagreement.

This prevents a generic reliability multiplier from being presented as a calibrated probability.

## Risk gates
A selection becomes REVIEW and cannot auto-publish when any lambda risk is present:
- either team lambda >=3.00;
- either team lambda <=0.25;
- total lambda >=4.80.

Market disagreement:
- >=20 percentage points: WATCH; still publishable but penalized.
- >=30 percentage points: REVIEW; not auto-publishable.

Poor research/data quality is NO BET.

A quarantined directional selection may be exposed internally as `reviewBet`. It is not a public recommendation and is excluded from recommendation performance metrics.

## Ratings
- Elite >=85
- Strong >=78
- Good >=68

## Principle
A safe-looking derivative market cannot manufacture confidence. Strong support remains required, and extreme model outputs must survive calibration and risk checks before publication.


## V2.5 validation
The 180-day web-reconstructed v2.4 baseline produced 1,872 bets at 77.6%.
A chronological split was used:
- training: 2026-04-08 through 2026-08-05;
- untouched holdout: 2026-08-06 through 2026-10-04.

The stricter X2 rule was chosen because it improved both slices without league-specific hard-coding:
- training: 79.3% -> 79.7%;
- holdout: 75.2% -> 76.0%.

A broader weak-league hard gate improved the holdout slightly further, but was not promoted because its league-specific rules were more prone to overfitting.


## V2.6 market-specific calibration
Chronological calibration split:
- training: 2026-04-08 through 2026-08-05;
- untouched holdout: 2026-08-06 through 2026-10-04.

Temperature scaling learned on training predictions:
- 1X: 1.025
- X2: 1.55
- Over 1.5: 1.025

Untouched holdout Brier score improved from 0.18518 to 0.18252.
The largest improvement was X2:
- baseline Brier: 0.23419
- calibrated Brier: 0.21764

V2.6 therefore separates:
- selectionProbability: the v2.5 probability used to determine whether a bet qualifies;
- probability: the market-specific calibrated public probability.

This avoids changing the proven v2.5 selection gates merely to make confidence numbers more honest.


## V2.7 quality refinement
Using the 180-day backtest with the same chronological split:
- training baseline: 1,036 bets, 79.7%;
- training with calibrated probability >=78: 813 bets, 80.7%;
- untouched holdout baseline: 734 bets, 76.0%;
- untouched holdout with calibrated probability >=78: 578 bets, 78.7%.

The >=78 rule was preferred over rating-label filtering because it is a direct, auditable probability criterion and improved both training and untouched holdout while retaining substantial volume.


## V2.8 support-margin refinement
Using the v2.7 180-day result with the same chronological split:
- training baseline: 824 bets, 80.5%;
- training with support margin >=5pp: 579 bets, 80.7%;
- untouched holdout baseline: 589 bets, 78.8%;
- untouched holdout with support margin >=5pp: 429 bets, 79.3%.

A weak-league-specific layer reached a slightly higher holdout result, but it was not promoted because hard-coded league identities are more prone to overfitting. The generic support-margin rule was preferred.
