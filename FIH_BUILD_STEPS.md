# FIH BUILD STEPS

## Purpose

Build the Football Intelligence Hub afresh from the preserved LiveScore fixture-ingestion foundation.

The system must separate:
1. Fixture discovery/data collection
2. Evidence construction
3. Market-specific analysis
4. Qualification
5. Validation/backtesting
6. Publication

Do not carry forward rules, thresholds, weights, training data, predictions, or assumptions from the retired V2.x/V2.9 model.

---

## STEP 0 — PRESERVED FOUNDATION [DONE]

### LiveScore fixture ingestion
- Source: LiveScore via RapidAPI.
- Daily raw board is stored in `data/today_fixture.json`.
- Preserve the raw provider payload.
- Preserve ingestion metadata:
  - schema
  - date
  - timezone
  - provider
  - endpoint
  - fetchedAt
  - stageCount
  - fixtureCount
- GitHub Actions fetches and commits the daily snapshot.
- This layer discovers fixtures only. It does not make predictions.

---

## STEP 1 — NORMALIZE FIXTURES

Create a stable internal fixture schema from the LiveScore payload.

Minimum fixture identity:
- fixture ID
- competition
- country/region where available
- kickoff
- home team
- away team
- fixture status

Rules:
- Never invent missing values.
- Missing data remains null/unknown.
- Preserve a reference to the source fixture.
- Exclude completed/live/cancelled/postponed fixtures from pre-match prediction processing as appropriate.

Output should be deterministic and reproducible from the raw LiveScore snapshot.

---

## STEP 2 — BUILD THE EVIDENCE PACKAGE

For every eligible fixture, collect evidence for BOTH teams.

### A. Venue form
Home team:
- Last 5 HOME matches.

Away team:
- Last 5 AWAY matches.

Capture at minimum:
- W/D/L
- goals scored
- goals conceded
- scoring frequency
- clean sheets
- failed-to-score frequency
- Over 2.5 results
- BTTS results

### B. Overall form
For each team:
- Last 5 matches overall.

Capture the same core performance metrics.

### C. Expected goals
Collect where reliable:
- xG
- xGA
- venue xG/xGA
- overall xG/xGA

xG must be treated as unavailable when no trustworthy source exists; do not substitute fabricated estimates and label them xG.

### D. League standing
Where applicable:
- league position
- points
- matches played
- points per game
- goal difference
- points/position gap between opponents

Use PPG when matches played differ.

### E. Team quality
Build a longer-term team-strength assessment separate from short-term form.

Purpose:
- prevent a small five-match sample from completely redefining the underlying quality of a team.

The exact quality formula is NOT YET LOCKED.

### F. Motivation and match context
Research evidence for:
- title race
- promotion/playoff race
- relegation battle
- qualification requirements
- must-win scenarios
- cup/two-leg state
- dead rubber
- friendly
- likely rotation
- other competition-specific incentives

Rules:
- Motivation must be evidence-based.
- Never infer "must win" merely because winning would be useful.

### G. Head-to-head
Collect recent relevant H2H meetings.

Rules:
- H2H is supporting evidence.
- Old H2H must not overpower current team evidence.
- Account for material changes in team level/context where possible.

### H. Goals profile
For both teams collect:
- goals for
- goals against
- scoring frequency
- failed-to-score frequency
- clean-sheet frequency
- Over 2.5 frequency
- BTTS frequency

Use venue and overall samples where available.

### I. Squad availability
Collect reliable information on:
- injuries
- suspensions
- important absences
- goalkeeper availability
- key attackers
- rotation
- expected lineup changes where reliable

### J. Opponent strength
Recent results must be contextualized by opponent quality.

A five-match winning run against weak opposition must not automatically equal a five-match winning run against strong opposition.

Exact adjustment methodology is NOT YET LOCKED.

### K. Rest and schedule
Capture where relevant:
- days since previous match
- fixture congestion
- travel burden
- recent extra time
- unusual scheduling circumstances

---

## STEP 3 — DATA QUALITY GATE

Before prediction, evaluate whether each evidence component is trustworthy and sufficiently complete.

Rules:
- Never convert missing data to zero.
- Never fabricate xG, injuries, motivation, H2H, standings, or form.
- Store source and retrieval time for externally researched evidence.
- The model must know which evidence is present and which is missing.
- Insufficient evidence may prevent a market from qualifying without necessarily preventing other markets from being evaluated.

Exact minimum-data requirements are NOT YET LOCKED and must be tested.

---

## STEP 4 — MARKET ENGINES

The system has FOUR actionable markets:

1. HOME
2. AWAY
3. OVER 2.5
4. BTTS YES

Each market must be evaluated independently where appropriate.

### HOME/AWAY engine

Calculate an internal assessment for:
- HOME
- DRAW
- AWAY

DRAW is NOT an actionable market.

Rules:
- If HOME is strongest, HOME may proceed to qualification.
- If AWAY is strongest, AWAY may proceed to qualification.
- If DRAW is strongest, reject HOME and AWAY for that fixture.
- Never convert a draw assessment into double chance.

IMPORTANT:
A DRAW signal only blocks HOME/AWAY.
It does NOT block OVER 2.5 or BTTS.

### OVER 2.5 engine

Evaluate Over 2.5 independently using goal-specific evidence.

Relevant evidence can include:
- scoring/conceding profile
- xG/xGA
- venue goal profile
- overall goal profile
- Over 2.5 frequency
- opponent-adjusted attack/defence
- squad availability
- motivation/context
- H2H as supporting evidence

A fixture can qualify for OVER 2.5 even when DRAW is the strongest 1X2 outcome.

### BTTS YES engine

Evaluate BTTS independently.

Relevant evidence can include:
- both teams' scoring frequency
- both teams' failed-to-score frequency
- goals conceded
- clean sheets
- xG/xGA
- venue profile
- overall profile
- BTTS frequency
- opponent-adjusted attack/defence
- squad availability
- match context
- H2H as supporting evidence

A fixture can qualify for BTTS even when DRAW is the strongest 1X2 outcome.

---

## STEP 5 — QUALIFICATION RULES

Do NOT invent thresholds.

We need to determine through testing:
- factor weights
- favourite-strength requirements
- probability requirements
- minimum margin over alternative outcomes
- evidence-quality requirements
- Over 2.5 qualification threshold
- BTTS qualification threshold
- handling of conflicting evidence

Possible states per market:
- QUALIFIED
- REJECTED
- INSUFFICIENT DATA

One fixture may qualify for more than one independent market.

---

## STEP 6 — ODDS POLICY

Initial model predictions must be independent of bookmaker odds.

Bookmaker odds may later be collected separately for:
- benchmarking
- implied probability comparison
- calibration analysis
- value analysis

Do not use bookmaker prices as a hidden substitute for the model's own assessment unless we explicitly change this rule later.

---

## STEP 7 — BACKTEST AND CALIBRATE

Before locking thresholds:
- test the evidence framework historically
- prevent look-ahead leakage
- use only information that would have existed before kickoff
- test HOME separately
- test AWAY separately
- test OVER 2.5 separately
- test BTTS separately
- inspect performance by league/data quality/sample size
- measure calibration, hit rate, and later value/ROI where reliable odds are available

Use backtest evidence to set thresholds rather than guessing them.

---

## STEP 8 — DAILY EXECUTION

Target daily flow:

`LiveScore -> Normalize -> Research/Evidence -> Quality Gate -> Market Engines -> Qualification -> Predictions`

Every LiveScore fixture must be accounted for with a clear status.

A fixture can have:
- no qualifying markets
- HOME
- AWAY
- OVER 2.5
- BTTS
- multiple compatible qualifying markets

DRAW itself is never published as a selection.

---

## STEP 9 — VALIDATION

Before publication verify:
- fixture belongs to the current LiveScore snapshot
- fixture has not started
- evidence predates kickoff
- no missing value was converted to zero
- no unsupported motivation/injury/xG claim was invented
- market result came from the correct market engine
- DRAW did not incorrectly suppress Over 2.5 or BTTS
- no retired V2.x/V2.9 rules have entered the new model

---

## CURRENT STATUS

DONE:
- LiveScore daily fixture ingestion
- Clean repository foundation
- Actionable markets defined
- Evidence framework defined
- DRAW handling clarified

NEXT:
- Build normalized fixture schema
- Build evidence/research schema
- Select reliable data sources
- Implement evidence collection
- Build and test market engines
- Backtest before locking numerical thresholds
