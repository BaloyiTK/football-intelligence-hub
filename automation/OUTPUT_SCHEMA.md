# Daily Output Contract

Path: `data/predictions/YYYY-MM-DD.json`

The `fixtures` array is a PRE-MATCH prediction feed. It MUST NOT contain started, live, completed, abandoned or cancelled matches.

Required top-level fields:
- date
- timezone = Africa/Johannesburg
- generatedAt
- scan
- fixtures

scan includes status, leagueEntriesChecked, totalLeagueEntries, completedAt when complete, duplicatePolicy, and failures/notes.

Each upcoming fixture includes fixtureKey, leagueId, league, homeTeam, awayTeam, kickoff, research/evidence, sources/timestamps, and model OR null.

Every model includes modelLevel, confidence, lambdaHome/lambdaAway, correct score + probability, alternatives, 1X2, double chance, BTTS, totals and team 2+.

No Model is last resort for a still-upcoming fixture only. Missing premium metrics alone is not a valid reason when reliable recent scoring/conceding results exist.

Immediately before output, purge every fixture whose kickoff has passed or whose status is not pre-match. Never archive completed matches inside the prediction feed.
