# Daily Output Contract

Daily public betting data contains only pre-match fixtures with a deterministic model AND a non-null `recommendedBet`.

FIH public prediction scope is exclusively **Match Result (1X2)**.

Each published model includes modelLevel, confidence/evidence metadata, sampleSize when known, lambdas when used internally, and the three 1X2 outcome probabilities:
- Home
- Draw
- Away

`recommendedBet` may contain only:
`{ market: "1X2", pick: "Home" | "Draw" | "Away", probability, rawProbability, reliability, rating }`

- probability = reliability-adjusted recommendation probability
- rawProbability = 1X2 probability from the production model
- reliability = evidence/outcome reliability multiplier
- rating uses adjusted probability

NO BET fixtures are excluded from the main public betting list, but may be retained separately for research/backtesting. Never publish started/live/completed/cancelled/abandoned fixtures.
