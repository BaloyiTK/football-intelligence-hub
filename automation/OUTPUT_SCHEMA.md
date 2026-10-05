# Daily Output Contract

Daily public betting data contains only pre-match fixtures with a deterministic model AND a non-null `recommendedBet`.

Each published model includes modelLevel, confidence/evidence metadata, sampleSize when known, lambdas and the six approved prediction families: 1X2 (Home/Draw/Away), Over/Under Goals (1.5/2.5/3.5), BTTS (Yes/No), Double Chance (1X/X2 only), Team to Score 1+ (Home/Away), and Correct Score (primary + alternatives), plus recommendedBet. Correct Score is analytical and cannot be recommendedBet.

recommendedBet V2.3:
`{ market, pick, probability, rawProbability, reliability, rating }`
- probability = reliability-adjusted recommendation probability
- rawProbability = probability from the normalized score model
- reliability = evidence/market reliability multiplier
- rating uses adjusted probability

NO BET fixtures are excluded from the main public betting list, but may be retained separately for research/backtesting. Never publish started/live/completed/cancelled/abandoned fixtures.