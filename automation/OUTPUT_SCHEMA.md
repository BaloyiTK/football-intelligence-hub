# Daily Output Contract

Path: `data/predictions/YYYY-MM-DD.json`

`fixtures` is prediction-only and pre-match. Every row must be upcoming and have a deterministic model. Never publish started/live/completed/cancelled/abandoned or model:null rows.

Each model includes modelLevel, confidence, lambdaHome/lambdaAway, correct score + alternatives, 1X2, double chance, BTTS, totals, team-goal probabilities, and `recommendedBet`.

`recommendedBet` is either:
`{ market, pick, probability, rating }`
or `null` meaning NO BET.

There is at most ONE recommended betting market per fixture. Correct score remains visible but is not the bet unless a future explicitly supported selector rule says so.

Fixtures that cannot be modelled after Full -> Standard -> Basic are omitted. Modelled fixtures with no market clearing the selector floors remain visible with recommendedBet:null.

Immediately before output: fixture is pre-match AND model != null.