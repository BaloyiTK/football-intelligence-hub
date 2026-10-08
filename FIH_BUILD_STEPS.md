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

### ChatGPT web-search ownership and batch persistence — LOCKED

#### Single temporary accumulator + single canonical commit — NON-NEGOTIABLE LOCK

- Step 2 MUST use exactly one temporary accumulator file for the active date and `researchRunId`: `data/research-work/YYYY-MM-DD.json`.
- Every validated fixture research record is written into that same file; do not create a persistent per-fixture research file tree.
- After every fixture write, atomically replace the accumulator, reread it, verify date/`researchRunId`/fixture universe/count, and revalidate the just-written fixture record.
- `data/research-work/` is temporary working state and MUST remain outside Git history.
- There are **zero Git research commits during accumulation**, including fixture-by-fixture and partial-batch commits.
- Only after exact N/N validation and aggregate reconciliation may the accumulator be promoted to `data/research/YYYY-MM-DD.json`.
- The promoted canonical research artifact is committed **exactly once per `researchRunId`**. A second canonical research commit for the same `researchRunId` is a contract violation and must return Step 2 to RECOVERING.
- Step 3 is forbidden until that single canonical commit is verified and the committed research artifact is reread and revalidated.
- New canonical Step-2 research must use `fih-daily-research-v5`; legacy schemas cannot cross the Step-3 input gate after the H2H last-five lock.

- Research/provider/query ceilings are continuation boundaries, never completion or a hard stop. Continue through available search capacity and authorized search paths. If the execution environment itself prevents further calls, first verify the single temp accumulator and exact continuation cursor; resume the same `researchRunId` from the next unfinished fixture without rerunning Step 1 or requiring a new user command.
- ChatGPT MUST perform the actual web search for every eligible fixture, fixture by fixture.
- **Actual-capture lock:** a search call or completion marker is not a researched fixture. Before a fixture enters `data/research-work/YYYY-MM-DD.json`, ChatGPT MUST write the source-backed structured facts returned by the search into that fixture record. Copying a prior canonical/baseline record and appending attempt/completion markers is forbidden.
- For every required category, `PARTIAL` or `UNAVAILABLE` is valid only after genuine category-specific exhaustion: `searchExhausted: true` plus at least one attempt outcome explicitly recording `SEARCH_EXHAUSTED`.
- Completion-only outcomes such as `CHATGPT_WEB_SEARCH_REFRESH_COMPLETED`, `CHATGPT_H2H_SEARCH_REFRESH_COMPLETED`, `CHATGPT_VENUE_FORM_SEARCH_REFRESH_COMPLETED`, or `SEARCH_COMPLETE` are forbidden as research evidence and cannot satisfy checkpoint/promotion validation.
- Repository-local homepage scanning, scraping, cached link discovery, or direct-public-source discovery is not equivalent to the required ChatGPT web-search job and MUST NOT satisfy Step 2 by itself.
- Research each eligible fixture using web search, retain only source-backed factual evidence, and add the validated fixture record to the working daily dataset.
- Continue until every eligible fixture for the date has been researched or a field has been truthfully recorded as unavailable after a real ChatGPT web-search attempt.
- Do NOT commit canonical research fixture by fixture.
- After all eligible fixtures are present, validate complete coverage and the facts-only canonical schema, then commit the complete per-date research artifact once as the canonical research commit.
- Checkpoints may preserve recovery state, but they are not canonical research commits and do not end the research loop.
- The research artifact contains facts only. Derived statistics, ratings, expected goals, probabilities, model outputs, and betting decisions are calculated downstream by FIH.


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

### Fixture research-job interface — LOCKED

Step 2 MUST execute each eligible fixture as a structured ChatGPT research job. The repository/controller owns job construction, validation, checkpointing and persistence; ChatGPT owns the web research.

For each eligible fixture, the controller provides ChatGPT one research-job input containing at minimum:
- requested date;
- execution mode (PREDICTION or BACKTEST);
- applicable information cutoff when BACKTEST;
- fixture ID;
- competition;
- kickoff time and timezone;
- home team;
- away team;
- the complete required evidence-category list defined below;
- research-integrity requirements;
- the required Step 2 output/schema contract.

The research job instructs ChatGPT to:
1. research BOTH teams on the web for every required Step 2 evidence category;
2. use credible sources and retain source URL/reference plus retrieval timestamp;
3. map each retained source to the evidence category/categories it supports;
4. return evidence only and make no prediction;
5. never fabricate missing evidence or convert missing values to zero;
6. mark a category `UNAVAILABLE` only after a real search attempt fails to locate trustworthy evidence;
7. for BACKTEST, enforce the applicable historical information cutoff before retaining evidence;
8. return one complete fixture research record compatible with the canonical Step 2 validator.

The controller MUST validate the returned fixture record before accepting it into the working daily dataset. A fixture is complete only when every required category has a recorded real research attempt and the returned evidence/source mapping passes the Step 2 validator. A source-discovery result, partial search batch, prompt completion, or checkpoint by itself is not fixture completion.

After a fixture validates:
`research fixture -> validate returned record -> persist/checkpoint working state -> re-read/verify checkpoint -> immediately submit the next unfinished fixture research job`

Checkpointing a completed fixture is durability only. It MUST NOT end or pause the authorized run while another eligible fixture can be researched. On recoverable failure, apply the Execution Contract recovery loop to that fixture/job and continue automatically.

The fixture is the atomic completion/recovery unit. Search execution inside one fixture may group related categories or use bounded parallel searches where supported, provided evidence remains attributable to the correct fixture and category.

Do not ask ChatGPT to make Step 3 model probabilities or Step 4 decisions during a Step 2 research job.

For BOTH teams, collect:

### Venue form
- Home team: exactly the last 5 completed HOME matches.
- Away team: exactly the last 5 completed AWAY matches.
- Step 2 must continue venue-form research until all 5 source-backed matches are found, or explicitly record the series as `PARTIAL`/`UNAVAILABLE` after genuine search exhaustion.
- A 1-4 match venue sample is incomplete and MUST NOT be treated as verified venue form or used numerically by Step 3.

### Overall form
- Home team: last 5 overall matches.
- Away team: last 5 overall matches.
- Where available, retain match date, opponent, venue, score, result, and opponent-strength context for each recent match.

### FIH expected goals ownership
- Step 2 does **not** research or store xG/xGA as a model input.
- Step 2 stores factual completed-match scorelines, venue form, standings, schedule and other source-backed context only.
- Step 3 calculates FIH's own expected-goal parameters, `lambdaHome` and `lambdaAway`, from those verified facts.
- External, predicted, projected, forecast, or copied xG/xGA values must not enter the FIH probability model.

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

Motivation must be supported by evidence, not guessed. Step 2 stores facts/context tags only, never a numeric motivation score. Where supported, use per-team tags from the locked vocabulary: `MUST_WIN`, `KNOCKOUT_ELIMINATION`, `TITLE_DECIDER`, `RELEGATION_DECIDER`, `PROMOTION_DECIDER`, `TITLE_RACE`, `RELEGATION_BATTLE`, `PROMOTION_RACE`, `QUALIFICATION_RACE`, `PLAYOFF_RACE`, `DEAD_RUBBER`, `ROTATION_EXPECTED`, `FRIENDLY`. Step 3 converts these through the locked FIH-5F-V1 motivation mapping.

### H2H
Research the **last 5 completed head-to-head meetings** between the two clubs. Store them as structured rows under `facts.headToHead.data.matches`, retaining for every meeting: date, home team, away team, home goals, away goals, and `sourceRef`.

- `VERIFIED` requires **exactly 5** source-backed H2H rows.
- A 1-4 match sample may be `PARTIAL` only after genuine search exhaustion, recorded with `searchExhausted: true`.
- If no trustworthy prior meeting can be found after genuine search exhaustion, use `UNAVAILABLE` with `searchExhausted: true`.
- A prose note, aggregate H2H record, undated result, or “team unbeaten in N meetings” statement does **not** satisfy the last-five H2H requirement.

H2H is a locked 15% FIH-5F-V1 factor only when all 5 meetings are source-backed. A partial 1-4 meeting sample remains auditable context only and is not scored numerically.

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

The active operational model is `FIH-V2-RESEARCH` in `scripts/fih-probability-v2.ts`. V1 remains archived/reference unless explicitly requested for comparison.

### 3.1 Input
- Consume only the complete verified Step 2 research artifact.
- Verify date, fixture coverage and integrity before model execution.
- The model performs no new web research and may not silently replace Step 2 evidence.
- Historical execution may not introduce information outside the applicable cutoff.

#### Step 2 -> Step 3 lineage gate — LOCKED
- Step 3 MUST fail closed unless the canonical research artifact validates against the frozen eligible fixture universe and its `researchRunId` exactly matches the active ledger `researchRunId`.
- Before any probability calculation, verify that `data/research/YYYY-MM-DD.json` is tracked, clean, committed, reread from repository state, and represented by exactly one canonical research commit for that active `researchRunId`.
- Once Step 2 has started, automated resume paths MUST reuse the frozen Step-1 fixture board. They must not silently reacquire a fresh board before Step 3.
- The canonical Step-3 model artifact MUST retain lineage to its exact Step-2 input using `researchRunId`, `inputResearchHash`, and `inputResearchCommit`.
- A stale generation, fixture-universe drift, partial/uncommitted research file, or multiple canonical research commits for the same `researchRunId` returns the run to RECOVERING before model calculation.

### 3.2 Step-3 data contract — LOCKED

Step 3 receives the canonical Step-2 facts and normalizes them into model-ready evidence using `scripts/step3-normalize.ts`.

| Step-2 evidence | Step-3 treatment |
|---|---|
| overall form | used directly as the primary recent-form input |
| home/away venue form | used as a venue refinement only with exactly 5 validated HOME matches for the home side and exactly 5 validated AWAY matches for the away side; when usable, Step 3 also derives venue W/D/L, points, PPG and win/draw/loss rates; partial samples are not numerical inputs |
| standings: points + matches | derive PPG in Step 3; never store calculated PPG in Step 2 |
| standings: goal difference, or goals for/against + matches | derive goal-difference-per-game in Step 3 |
| recent scorelines | derive scoring, conceding, BTTS and Over-2.5 rates plus W/D/L, points, recent PPG and win/draw/loss rates in Step 3 |
| latest verified match date + kickoff | derive rest days in Step 3 |
| H2H | FIH-5F-V1 numeric result-strength input only with exactly 5 verified meetings; W=3/D=1/L=0 |
| squad availability | context-only unless a later calibrated injury-impact mapping is explicitly approved |
| competition/motivation context | Step 3 derives the locked FIH-5F-V1 motivation index from fixture type plus source-backed per-team context tags |
| team quality | context-only when explicitly researched; unavailable otherwise; no numeric score until calibrated |
| opponent quality/context | context-only when explicitly researched; unavailable otherwise; no numeric score until a verified/calibrated mapping exists |

Every fixture model record MUST expose `evidenceUsage` and `inputCoverage`. Each researched evidence family is classified as `USED`, `DERIVED`, `CONTEXT_ONLY`, or `UNAVAILABLE`; silent dropping is forbidden.

Missing evidence remains undefined. Step 3 MUST NOT convert missing information to zero. Outside the explicit FIH-5F-V1 H2H/motivation mapping, numeric injury, team-quality or opponent-strength adjustments remain forbidden without a separately locked calibrated mapping.
Every evidence field used numerically in Step 3 MUST have validated Step-2 source references. Standings/H2H/schedule and other retained references must resolve to retained source metadata. External xG/xGA is not a Step-3 input.
Pairwise PPG and goal-difference adjustments run only when both teams have verified finite values. A missing side is not replaced by a neutral league-average/default value.

### 3.3 Locked five-factor result-strength layer — FIH-5F-V1

The result-strength score uses exactly:
- overall last 5: **30%**
- home team's last 5 HOME matches vs away team's last 5 AWAY matches: **30%**
- league-position strength: **15%**, operationalized by season PPG derived from verified standings
- exact last 5 H2H meetings: **15%**
- motivation: **10%**

Overall, venue and H2H results use **Win = 3, Draw = 1, Loss = 0**. For each factor, the two team scores are converted to a pair share and the locked factor weight is applied. Venue and H2H require exact-five samples for numeric use. If a factor is genuinely unavailable, it is not assigned a neutral value; the remaining available locked weights are transparently renormalized.

Motivation is derived in Step 3 only. A verified competitive fixture has the locked baseline index 1 for each team. Source-backed context tags may change that index using the locked mapping in `scripts/step3-normalize.ts`; Step 2 never stores a numeric motivation score.

The final FIH-5F-V1 number is a **strength score, not a win probability**. It must remain separately auditable from Poisson HOME/DRAW/AWAY probabilities and fair odds.

### 3.3 Fixture model loop
Process each fixture independently:

`verified research record -> FIH V2 -> model output -> working daily model dataset`

Retain, where calculated:
- derived overall and venue result profiles: wins, draws, losses, points, PPG, win rate, draw rate and loss rate;
- result-profile matchup edges for recent form, venue form and season standings where available;
- expected home goals;
- expected away goals;
- expected total goals;
- HOME/DRAW/AWAY probabilities;
- Over/Under 2.5 probabilities;
- BTTS Yes/No probabilities;
- fair odds;
- market-specific reliability;
- evidence coverage;
- model/version identifier;
- `CALCULATED` or `INSUFFICIENT_DATA` status and reason.

### 3.4 V2 principles
- FIH-5F-V1 is the locked result-strength layer: Overall 30%, Venue 30%, League 15%, H2H 15%, Motivation 10%.
- Recent overall form remains the anchor for FIH-owned expected-goal calculation.
- Home/away venue form refines expected goals when verified.
- FIH calculates `lambdaHome` and `lambdaAway` internally from verified factual evidence; external xG/xGA is not consumed.
- PPG and goal-difference-per-game provide conservative longer-strength context.
- Recent matches may be opponent-strength weighted when a verified factor exists.
- Squad/availability adjustments remain evidence-based.
- HOME/AWAY, OVER 2.5 and BTTS retain separate reliability values.
- Probability and reliability are separate concepts.
- DRAW remains an internal model result.
- No unsupported numerical qualification/value threshold may be invented. Thresholds require materially larger leak-free calibration.

### 3.5 Complete, verify and persist the date
- Do not commit model output fixture-by-fixture.
- Analyze all eligible fixtures into the working daily model dataset.
- Verify fixture coverage, model version/status, output integrity and references.
- Commit the complete verified model dataset once as the canonical per-date model artifact.
- Re-read the committed artifact and verify it matches the verified working dataset.

Step 3 completes only after the canonical persisted model artifact passes verification.

---

## 4. Prediction File

Step 4 converts verified Step 3 analysis into the safer FIH publication product.

### 4.1 Actionable markets
Exactly four actionable markets are locked:
- HOME
- AWAY
- OVER 2.5
- BTTS YES

DRAW remains internal and is never published.

### 4.2 Conservative-product rule
FIH does not publish a market merely because that same market has the highest raw probability. The underlying evidence/model signal must be stronger than the product being offered.

#### HOME
- Publish HOME only when the underlying HOME case is strongly supported.
- DRAW or meaningful AWAY uncertainty must prevent a weak HOME signal becoming a HOME prediction.

#### AWAY
- Publish AWAY only when the underlying AWAY case is strongly supported.
- DRAW or meaningful HOME uncertainty must prevent a weak AWAY signal becoming an AWAY prediction.

#### OVER 2.5
- The underlying analysis must support approximately 4.5+ total-goal territory before FIH publishes the safer OVER 2.5 product.
- A model merely leaning above 2.5 is insufficient.

#### BTTS YES
- The underlying analysis must support approximately 2+ goals from the HOME team and 2+ goals from the AWAY team before FIH publishes BTTS YES.
- Merely expecting each side to score once is insufficient.

Examples:
- An underlying 3-2 expectation may support OVER 2.5 and BTTS YES.
- An underlying 3-0 expectation may support OVER 2.5 but does not support BTTS YES.

### 4.3 Strongest-market rule
- Evaluate all four actionable products independently.
- If multiple products satisfy their conservative qualification rules, publish only the strongest supported market unless explicitly changed later.
- Never force a prediction.
- If no market qualifies, record `NO BET`.
- If the active model legitimately cannot calculate because evidence requirements fail, record `NO MODEL`.
- Step 4 may not modify Step 2 evidence or Step 3 model output to make a market qualify.
- HOME/AWAY strong-signal qualification remains mandatory but is not assigned invented numeric thresholds while calibration is `NOT_CALIBRATED`.

### 4.4 Market odds / value
- Where legitimate verified pre-match odds are available, retain them and perform the configured market/value assessment.
- Missing prices remain unavailable and must never be inferred or reconstructed from post-match information.
- Historical odds must satisfy historical cutoff/pre-match integrity rules.
- Until calibration establishes valid betting thresholds, FIH must not invent minimum-edge or minimum-reliability thresholds.

### 4.5 Daily prediction artifact
Canonical published prediction path:

`data/predictions/YYYY-MM-DD.json`

The daily decision data must retain enough information to audit each eligible fixture, including fixture identity, date/kickoff, country/region, competition, teams, model version/output reference, selected market or `NO BET`/`NO MODEL`, model support/reliability, qualification/rejection reason, research/evidence/source references and analysis timestamp.

All eligible fixtures must receive a terminal decision even when they are not published as bets.

### 4.6 Complete, verify and persist the date
- Build decisions for the complete date before canonical persistence.
- Do not commit decisions fixture-by-fixture.
- Verify the complete daily decision/prediction dataset.
- Commit it once per date.
- Re-read the committed artifact from GitHub and verify it matches the verified working dataset.

Step 4 completes only after the canonical persisted decision/prediction artifact passes verification.

---

## 5. Reconciliation / Completion

Step 5 proves that no eligible fixture silently disappeared.

### 5.1 Fixture reconciliation
Reconcile:

`eligible fixtures = published predictions + NO BET + NO MODEL + legitimate terminal exclusions`

- Every eligible fixture must be accounted for exactly once.
- Verify the canonical chain: `fixture -> research -> model -> decision/prediction`.
- Verify artifact dates, fixture identities, counts, references and required GitHub persistence.

### 5.2 Completion rule
- A heartbeat, checkpoint, research completion, model completion, prediction write or intermediate commit is not daily-cycle completion.
- Only after reconciliation and persisted-artifact verification may the run become `DAILY_CYCLE_COMPLETE`.
- Production deployment/publication health is separate and does not block an otherwise completed prediction computation cycle.

---

## Historical Backtest Extension

For a historical date, Steps 1-4 reconstruct the legitimate pre-match state before results are attached.

Required order:

`fixture verification -> eligibility/cutoff -> research -> research persistence/verification -> FIH V2 -> model persistence/verification -> historical odds/value where legitimately available -> prediction/NO BET/NO MODEL -> freeze -> verified actual result -> evaluation -> daily summary`

- Historical snapshot is 06:00 SAST; kickoff must be strictly after 06:00.
- Actual results and later information cannot influence research, model analysis or the frozen prediction.
- Freeze the prediction before attaching actual results.
- Grade against verified results only after freeze.
- Persist and verify evaluation and daily-summary artifacts per date.
- Ordinary backtests use V2 only unless an explicit comparison requests another model.

For a multi-day backtest:
- Process one date completely through `DAY_COMPLETE` before advancing.
- Store separate canonical artifacts per date.
- Resume from the earliest date not at `DAY_COMPLETE`.
- Only after every requested date completes derive the range aggregate.
- Combined percentages use combined underlying numerators/denominators, never an average of daily percentages.

---

## Recovery and Continuation — Applies to Every Step

Every stage follows the locked lifecycle:

`Invoke -> Verify output -> Persist -> Verify persisted data -> Continue`

A recoverable failure immediately follows:

`Investigate -> Fix or authorized fallback -> Verify recovery -> Resume earliest unfinished stage -> Continue`

- A failed search, provider call, workflow, write attempt or intermediate stage is not a normal stopping point.
- Missing/invalid rebuildable artifacts must be regenerated from authoritative input, verified, persisted, re-read and execution resumed.
- A single failed path is insufficient for `BLOCKED`.
- The user does not need to issue `continue`, request status or repeat the original command after a recoverable failure.
- `BLOCKED` requires a named policy hard-stop plus evidence and exhausted applicable recovery paths.
- `WAITING` requires a genuinely active external process and no useful authorized work remaining until it finishes.
- Scheduled recurring FIH automation must not be disabled because of a run failure unless explicitly requested or continued execution is unsafe/destructive.
