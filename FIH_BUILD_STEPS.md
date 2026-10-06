# FIH DAILY PROCESS

## 1. Get Daily Fixtures

Use the preserved LiveScore ingestion pipeline to fetch the complete daily fixture board.

Source:
- LiveScore via RapidAPI

Primary input:
- `data/today_fixture.json`

Rules:
- Use the current day's LiveScore board as the fixture universe.
- Preserve the raw LiveScore data.
- Do not invent or manually add fixtures that are not on the daily board.
- Only eligible pre-match fixtures proceed to analysis.

---

## 2. Research Every Fixture

ChatGPT researches each eligible fixture on the web before making a prediction.

For BOTH teams, check:

### Venue form
- Home team: last 5 HOME matches.
- Away team: last 5 AWAY matches.

### Overall form
- Home team: last 5 overall matches.
- Away team: last 5 overall matches.

### xG / xGA
- Expected goals created.
- Expected goals conceded.
- Prefer venue + overall splits when reliable data is available.
- If trustworthy xG is unavailable, record it as unavailable. Never invent xG.

### League position
- Position.
- Points.
- Matches played.
- Points per game (PPG).
- Goal difference.
- Points/position gap between the teams.

### Team quality
Assess underlying team strength so five unusual recent matches do not completely redefine the team.

### Motivation / context
Research relevant match circumstances:
- title race
- promotion/playoff race
- relegation battle
- qualification
- cup/two-leg situation
- dead rubber
- friendly
- rotation
- other meaningful competition context

Motivation must be supported by evidence, not guessed.

### H2H
Use recent relevant head-to-head meetings as supporting evidence only.

H2H must not dominate stronger current evidence.

### Goals profile
Check:
- goals for
- goals against
- Over 2.5 rate
- BTTS rate
- scoring frequency
- failed-to-score/blank frequency
- clean sheets where useful

Prefer venue + overall context.

### Squad availability
Research:
- important injuries
- suspensions
- goalkeeper absences
- striker/key attacker absences
- rotation
- meaningful expected-lineup changes where reliable

### Opponent strength
Contextualize recent results.

A 4-1 recent record against weak opposition must not automatically be treated as equal to a 4-1 record against strong opposition.

### Rest / schedule
Check where relevant:
- days since previous match
- fixture congestion
- travel
- extra time
- unusual scheduling circumstances

### Research integrity
- Use current, credible web sources.
- Keep source URLs/references and retrieval timestamps with the evidence.
- Research must reflect information available before kickoff.
- Missing information stays unknown/unavailable.
- Never convert missing information to zero.
- Never fabricate form, xG, standings, injuries, motivation, H2H, or other evidence.

---

## 3. Identify the Strongest Market and List Today's Predictions

After the fixture research is complete, evaluate these four actionable markets:

- HOME
- AWAY
- OVER 2.5
- BTTS YES

### HOME / AWAY
Internally assess HOME, DRAW and AWAY.

- HOME strongest -> HOME can qualify.
- AWAY strongest -> AWAY can qualify.
- DRAW strongest -> no HOME/AWAY selection.

DRAW is never published as a prediction.

IMPORTANT:
A DRAW signal affects only HOME/AWAY. It does NOT disqualify the fixture from OVER 2.5 or BTTS.

### OVER 2.5
Evaluate independently from the 1X2 result using the fixture's goal evidence.

### BTTS YES
Evaluate independently from the 1X2 result using both teams' scoring/conceding evidence.

### Strongest-market rule
Compare the supported actionable markets and identify the strongest qualifying market for the fixture.

- Do not force a prediction.
- If no market is sufficiently supported, mark the fixture NO BET.
- If more than one market looks viable, publish only the strongest market unless this rule is explicitly changed later.
- Numerical thresholds and weights are not yet locked; they must be established through testing rather than guessed.

### Today's prediction file
Write qualifying selections to:

`data/predictions/YYYY-MM-DD.json`

Each published selection should retain enough information to audit:
- fixture identity
- country/region
- competition
- kickoff
- home team
- away team
- selected market
- evidence summary
- research/source references
- analysis timestamp

Daily flow:

`LiveScore fixtures -> Web research for every eligible fixture -> Compare HOME / AWAY / OVER 2.5 / BTTS -> Strongest qualifying market -> Today's prediction file`
