# Daily Output Contract

Path: `data/predictions/YYYY-MM-DD.json`

## Public fixtures contract
`fixtures` is a PREDICTION-ONLY, PRE-MATCH feed.

Every row MUST:
- still be upcoming at publication time
- have a successfully calculated deterministic `model`
- contain no null model

The array MUST NOT contain:
- No Model fixtures
- model:null rows
- started/live matches
- completed matches
- abandoned/cancelled matches

Every published fixture includes fixtureKey, leagueId, league, homeTeam, awayTeam, kickoff, evidence/sources, research timestamp and model.

Every model includes modelLevel, confidence, lambdaHome/lambdaAway, correct score + probability, alternatives, 1X2, double chance, BTTS, totals and team 2+.

Fixtures that cannot be modelled after Full -> Standard -> Basic are omitted from the public feed rather than fabricated. They may be summarized only in internal scan metadata/counts.

Immediately before output, filter with the equivalent invariant: fixture is pre-match AND model != null.
