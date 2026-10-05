# Deterministic Model Rules — V2.4 Calibrated Risk Selector

V2.4 preserves the V2.3.1 normalized Dixon-Coles engine and support-gated market selector, then adds a calibration and risk-control layer before publication.

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
- X2: raw >=72, Away support >=62, calibrated probability >=68.
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
