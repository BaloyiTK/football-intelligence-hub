# Deterministic Model Rules — V2

The numerical engine is the sole producer of probabilities.

## V2 principles
1. Separate attacking and defensive strength.
2. Normalize against league home/away scoring baselines when available.
3. Explicitly support home advantage.
4. Blend stable venue/season strength with recent form: default 65% base + 35% recent when both exist.
5. Clamp both lambdas to 0.2–4.0.
6. Apply a Dixon–Coles-style low-score dependence correction to 0-0, 0-1, 1-0 and 1-1; default rho=-0.08 until calibration data supports league-specific rho.
7. Normalize the corrected score matrix before deriving markets.
8. Calculate grid through 8 goals.
9. Store modelVersion=v2-dixon-coles.

## Evidence levels
Full: venue attack/defence + league baselines, optionally recent/xG evidence.
Standard: reliable recent GF/GA plus venue/league context where available.
Basic: recent GF/GA fallback. lambdaHome=(homeGF+awayGA)/2; lambdaAway=(awayGF+homeGA)/2, then clamp.

Never fabricate missing evidence. Basic remains low confidence.

## Outputs
Derive 1X2, double chance, BTTS, O1.5/O2.5/O3.5, team 2+, primary correct score and three alternatives from the same normalized score matrix.

## Confidence
Confidence is evidence quality, not probability of prediction correctness. Full high/medium, Standard medium, Basic low by default.

## Calibration
Archive pre-match V2 probabilities separately from the public feed so completed results can later be scored with Brier score, log loss, calibration curves, market accuracy and Full/Standard/Basic segmentation. Never put completed fixtures back into the public prediction feed.
