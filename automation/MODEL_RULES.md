# Deterministic Model Rules — V2.1

The numerical engine is the sole producer of probabilities.

## Core model
Keep V2 Dixon-Coles: attack/defence strengths, league baselines, home advantage, 65/35 stable/recent blend, lambda clamp 0.2–4.0, rho default -0.08, normalized score grid through 8 goals.

## Outputs
Calculate 1X2, double chance, BTTS, O1.5/O2.5/O3.5, team goal probabilities and correct-score grid.

Correct score is an analytical forecast only. It is NOT automatically the recommended betting market.

## One-market selector
After probabilities are calculated, evaluate supported markets and publish at most ONE recommended bet per fixture.

Eligible markets: 1X2 Home/Away, Double Chance 1X/X2/12, Over 1.5, Over 2.5, Under 3.5, BTTS Yes/No, Home 1+ goal, Away 1+ goal.

Minimum probability floors:
- 1X/X2: 72%
- 12: 75%
- Over 1.5: 72%
- Over 2.5: 68%
- Under 3.5: 72%
- BTTS Yes/No: 68%
- Team 1+ goal: 72%
- Home/Away 1X2: 62%

Among markets clearing their floor, select the highest model probability. If none qualifies, recommendedBet=null (NO BET). Never force a selection.

Rating: Elite >=85%, Strong >=75%, Good below 75% but above its market floor.

## Evidence and confidence
Full: venue attack/defence + league baselines, optionally recent/xG evidence.
Standard: reliable recent GF/GA plus venue/league context where available.
Basic: recent GF/GA fallback; low confidence by default.
Confidence describes evidence quality, not probability of winning.

## Calibration
Backtest the single recommended market independently from correct score and 1X2 forecast. Track recommended-bet hit rate by market, probability band and model level.