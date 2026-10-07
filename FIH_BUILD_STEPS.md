# FIH DAILY PROCESS

## 1. Get Daily Fixtures

### 1.1 Trigger Vercel to fetch fixtures from LiveScore

- Resolve the requested date or date range dynamically using `Africa/Johannesburg` (SAST).
- Trigger the FIH Vercel fixture-fetch process.
- Vercel fetches the fixture data from LiveScore via RapidAPI.
- The LiveScore/RapidAPI credentials are stored in the Vercel environment and must be used there.
- Credentials must never be copied into GitHub, committed to fixture files, or exposed in logs/artifacts.
- Fetch the complete LiveScore fixture board for each requested date.
- Do not invent or manually add fixtures that are not returned by the LiveScore ingestion process.

### 1.2 Vercel commits fixture data to GitHub

- Vercel must commit the fetched fixture data to the FIH GitHub repository.
- Canonical fixture storage is per date under the daily fixtures data location.
- Every date must have its own fixture file.
- For a normal daily run, fetch and commit that day's fixture file.
- If a request covers a range of days, break the range down into separate days and process each date independently.
- Never use one combined canonical fixture file for a multi-day range.
- A date range is execution scope only; canonical fixture persistence remains per date.
- Preserve the raw LiveScore fixture data for each date.
- Vercel must verify that the GitHub commit succeeds before fixture acquisition can proceed to final verification.

### 1.3 Verify fixture data

- Re-read the committed fixture data from GitHub. Do not treat only the Vercel fetch response or commit response as proof of successful persistence.
- Verify that the expected fixture file exists for the requested date.
- Verify that the persisted date matches the requested date.
- Verify that the fixture data is valid and has the expected structure.
- Verify the fixture count.
- Verify required fixture details are present where supplied by LiveScore, including fixture identity, competition, home team, away team, kickoff, and status.
- Detect empty, malformed, partial, or wrong-date fixture data instead of silently accepting it as valid.
- Only after the persisted GitHub fixture file passes verification is Step 1 complete.
- Only eligible pre-match fixtures proceed to analysis. Preserve excluded fixtures in the raw daily fixture data rather than deleting them.
- If fetching, committing, or verification fails, follow the FIH Execution Contract recovery loop automatically: investigate -> fix or authorized fallback -> verify recovery -> resume from the earliest unfinished stage -> continue.
- A recoverable fixture acquisition failure must not require the user to issue another continue/status command.


---

## 2. Data Collection

ChatGPT owns the fixture-by-fixture data-collection stage.

- Read the verified eligible fixtures produced by Step 1.
- Loop through the fixtures one at a time.
- Create one working research dataset for the requested date.
- For each fixture: search the web -> collect the required evidence -> validate the fixture research -> add the completed record to the working daily research dataset -> continue to the next fixture.
- Step 2 collects evidence only. It does not make the final prediction or product decision.
- Do not commit individual fixture research records to GitHub.
- Complete the data-collection loop for all eligible fixtures before making the canonical daily research commit.
- Research data is stored per date so each daily run or historical day remains independently auditable.
- The working dataset may be checkpointed for recovery without treating a checkpoint as the canonical completed research artifact.
- If execution is interrupted, use available working/checkpoint state to resume from the earliest unfinished fixture rather than intentionally repeating completed research.

For BOTH teams, collect:

### Venue form
- Home team: last 5 HOME matches.
- Away team: last 5 AWAY matches.

### Overall form
- Home team: last 5 overall matches.
- Away team: last 5 overall matches.
- Where available, retain match date, opponent, venue, score, result, and opponent-strength context for each recent match.

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
- Record which evidence each source supports.
- Research must reflect information available before kickoff.
- Historical backtests must obey the applicable historical information cutoff from the FIH Execution Contract.
- Missing information stays unknown/unavailable.
- Never convert missing information to zero.
- Never fabricate form, xG, standings, injuries, motivation, H2H, or other evidence.
- A fixture may proceed with explicitly unavailable evidence where the model rules permit it.

### Complete, verify, commit, and verify
- First complete data collection for all eligible fixtures for the date in the working daily research dataset.
- Validate individual fixture records during collection, but do not make a GitHub commit for each fixture.
- After all eligible fixtures have been processed, verify the complete working daily research dataset.
- Verify fixture coverage, fixture identity, collected fields, unavailable fields, source references, timestamps, and research-integrity requirements.
- Only after the complete daily dataset passes verification, commit it to GitHub as one canonical per-date research artifact.
- Store canonical research by date; a multi-day range remains separate per-date canonical data and is processed one date at a time.
- Re-read the committed daily research artifact from GitHub and verify it matches the completed, verified working dataset.
- Step 2 is complete only after that persisted GitHub artifact passes verification.
- Only then may the date proceed to Step 3.
- A working/checkpoint artifact used during collection is recovery state only and must not be mistaken for the completed canonical research artifact.
- A recoverable research, verification, commit, or persistence failure follows the FIH Execution Contract recovery loop and does not require renewed user authorization.

---

## 3. Model Analysis

The active development model is `FIH-V2-RESEARCH` in `scripts/fih-probability-v2.ts`.

- Step 3 consumes only the verified data collected in Step 2.
- The model analyzes each fixture independently.
- Keep the collected evidence separate from the model's derived assessment so the research can be audited or reused by later model versions.
- Persist and verify model output before the fixture proceeds to the product/prediction decision.

### FIH V2 principles
- Recent overall form remains the anchor, but it is no longer the only usable evidence.
- Home venue form and away venue form refine expected-goal estimates when verified.
- xG/xGA may refine expected goals when trustworthy data exists; unavailable xG is not treated as zero.
- PPG and goal-difference-per-game provide a conservative longer-strength adjustment.
- Individual recent matches may be opponent-strength weighted when a verified opponent-strength factor exists.
- Squad/availability adjustments are small and only applied when evidence is structured and verified.
- HOME/AWAY, OVER 2.5, and BTTS have separate reliability values. Model probability and evidence reliability are different concepts.
- DRAW remains internal and only blocks HOME/AWAY; it does not block goals markets.
- No new qualification/value threshold is locked from a tiny sample. Thresholds must be calibrated on a materially larger leak-free backtest.
- V1 remains retained as an auditable baseline; V2 is the active development engine.

---

## 4. Product / Prediction Decision

After Step 3 model analysis is persisted and verified, apply the FIH product and publication rules.

Evaluate these four currently documented actionable markets:

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
Evaluate independently from the 1X2 result using the fixture's goal evidence and verified model output.

### BTTS YES
Evaluate independently from the 1X2 result using both teams' scoring/conceding evidence and verified model output.

### Strongest-market rule
Compare the supported actionable markets and identify the strongest qualifying market for the fixture.

- Do not force a prediction.
- If no market is sufficiently supported, mark the fixture NO BET.
- If more than one market looks viable, publish only the strongest market unless this rule is explicitly changed later.
- Numerical thresholds and weights are not yet locked; they must be established through testing rather than guessed.

### Prediction file
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
- model output/reference
- analysis timestamp

Persist and verify the product/prediction decision before the fixture is considered complete.

Daily flow:

`LiveScore fixtures -> Verified fixture data -> ChatGPT data collection -> Verified research -> FIH V2 model analysis -> Verified model output -> Product/market decision -> Prediction or NO BET`
