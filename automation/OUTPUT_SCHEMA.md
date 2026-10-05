# Daily Output Contract

Daily public betting data contains only pre-match fixtures with a deterministic model and non-null recommendedBet.

Approved recommendation markets:
- 1X2: Home / Draw / Away
- Total Goals: Over 1.5
- Double Chance: 1X / X2

Each model must expose the probabilities needed for support validation:
- home, draw, away
- doubleChance.homeOrDraw, doubleChance.awayOrDraw
- over15, over25

recommendedBet:
`{ market, pick, probability, rawProbability, reliability, rating, support? }`

For derivative picks, support is mandatory:
- Over 1.5 -> support = Over 2.5 with rawProbability >=68
- 1X -> support = Home with rawProbability >=62
- X2 -> support = Away with rawProbability >=62

Direct 1X2 picks do not require a support object.

NO BET fixtures remain internal. Never publish started/live/completed/cancelled/abandoned fixtures.
