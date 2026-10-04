# Daily Output Contract

Path: `data/predictions/YYYY-MM-DD.json`

Required top-level fields:
- date
- timezone = Africa/Johannesburg
- generatedAt
- scan
- fixtures

scan must include:
- status: in_progress | incomplete | complete
- leagueEntriesChecked
- totalLeagueEntries
- completedAt (only when complete)
- duplicatePolicy
- failures/notes when relevant

Each fixture must include:
- fixtureKey
- leagueId
- league
- homeTeam
- awayTeam
- kickoff
- fixture status
- research/evidence summary
- sources with URLs and timestamps
- model OR null
- exact No Model reason when model is null

Every model must include:
- modelLevel: full | standard | basic
- confidence: high | medium | low
- lambdaHome / lambdaAway
- correctScore + probability
- alternative correct scores
- homeWin / draw / awayWin
- doubleChance
- btts
- over15 / over25 / over35
- home2Plus / away2Plus

No Model is a last-resort state. Missing xG, shots, injuries or another premium metric alone is NOT a valid No Model reason when reliable recent scoring/conceding results exist.

The website must tolerate `model: null` and visibly render `No Model`. Never mark a scan complete until every league-list entry has been checked.
