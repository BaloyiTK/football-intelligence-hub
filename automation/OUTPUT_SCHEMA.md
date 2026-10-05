# Daily Output Contract

Daily public betting data contains only pre-match fixtures with the V2.9 deterministic model and a non-null, publishable `recommendedBet`.

Approved recommendation markets:
- 1X2: Home / Draw / Away
- Total Goals: Over 1.5
- Double Chance: 1X / X2

Each model must expose:
- home, draw, away
- doubleChance.homeOrDraw, doubleChance.awayOrDraw
- over15, over25
- modelVersion
- recommendedBet
- optional reviewBet

recommendedBet:
`{ market, pick, probability, selectionProbability, rawProbability, reliability, rating, selectionStatus, publishable, riskFlags, marketProbability?, marketDivergence?, support? }`

For derivative picks, support is mandatory:
- Over 1.5 -> Over 2.5 rawProbability >=68
- 1X -> Home rawProbability >=62
- X2 -> Away rawProbability >=66

Only `selectionStatus: PUBLISH|WATCH` with `publishable: true` may appear publicly.

`reviewBet` is internal-only. It preserves a potentially useful directional pick that failed an outlier/divergence gate, but it must not be published, counted as a recommendation, emailed, or graded as a betting result.

NO BET, REVIEW-only and NO MODEL fixtures remain internal. Never publish started/live/completed/cancelled/abandoned fixtures.

## V2.9 publication quality gates
- Public calibrated probability: 1X >=82; Over 1.5 >=78; X2 >=78; direct Home/Draw/Away >=78.
- Support margin: 1X Home support must exceed its 62 floor by >=5pp; Over 1.5 Over 2.5 support must exceed its 68 floor by >=7pp; X2 Away support must exceed its 66 floor by >=5pp.
- X2 also requires raw X2 >=76 and calibrated selectionProbability >=72 before publication-quality checks.
- Direct 1X2 raw floor remains 62. Over 1.5 raw floor remains 72. 1X raw floor remains 72.
