# Daily Output Contract

Daily public betting data contains only pre-match fixtures with a deterministic model AND a non-null `recommendedBet`.

Each published model includes modelLevel, confidence/evidence metadata, sampleSize when known, lambdas, correct score + alternatives, 1X2, double chance, BTTS, totals, team goals and recommendedBet.

recommendedBet V2.2:
`{ market, pick, probability, rawProbability, reliability, rating }`
- probability = reliability-adjusted recommendation probability
- rawProbability = probability from the normalized score model
- reliability = evidence/market reliability multiplier
- rating uses adjusted probability

NO BET fixtures are excluded from the main public betting list, but may be retained separately for research/backtesting. Never publish started/live/completed/cancelled/abandoned fixtures.