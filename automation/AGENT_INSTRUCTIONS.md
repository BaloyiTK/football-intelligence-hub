# Football Intelligence Agent Execution Contract

This is the mandatory entry point for ChatGPT football runs.

Before any daily prediction run or historical backtest, read and obey:
1. `automation/AGENT_INSTRUCTIONS.md` (this file)
2. `data/leagues.json`
3. `automation/RESEARCH_RULES.md`
4. `automation/MODEL_RULES.md`
5. For historical runs: `automation/HISTORICAL_BACKTEST.md`
6. Production model: `lib/model.ts`

Repository rules are authoritative. Do not substitute remembered conversation rules, provider coverage, a sample of leagues, or convenient competitions.

## Controller
ChatGPT web research is the primary discovery/research layer. Structured datasets/APIs may be used as evidence accelerators, but they MUST NOT determine which configured leagues are checked.

For each requested date, process `data/leagues.json` in stored order. For each league:
1. Set that date/league checkpoint to `researching`.
2. Search the public web specifically for that league and date.
3. Determine whether fixtures exist.
4. If none, save an explicit verified zero-fixture checkpoint with sources, then mark the date/league `complete`.
5. If fixtures exist, save EVERY discovered fixture to the run/evidence file before modelling.
6. Process each fixture through `RESEARCH_RULES.md` in order: Full -> Standard -> Basic -> No Model.
7. Preserve sources and evidence timestamp/cutoff. Missing data is null/unknown, never invented or silently zero.
8. Run the exact production model from `lib/model.ts`.
9. Save the frozen model output/recommended bet (or NO BET/NO MODEL) immediately.
10. For historical runs only, reveal the final score after freezing and grade the recommendation.
11. Mark the date/league `complete` only after every discovered fixture is processed.
12. Save/checkpoint before moving to the next league.

## Web-first rule
- Lack of coverage in Football-Data, OpenFootball, an API, or any other dataset is NEVER permission to skip a league.
- Search the wider public web when a structured source is missing or incomplete.
- Prefer multiple useful sources where practical and authoritative/reputable sources when available.
- A zero-fixture conclusion must itself be verified; absence from one provider is insufficient.

## Progress
Progress comes only from persisted checkpoints:
- leagues checked / total
- dates checked / total
- fixtures discovered / processed
- modelled / NO MODEL
- recommended bets
- for historical runs: wins / losses / hit rate
- current date and league

Never estimate, simulate, or invent progress. Creating an empty report is not progress.

## Completion
A run is complete only when every requested date × every configured league has a persisted `complete` checkpoint and every discovered fixture has a terminal state: BET, NO BET, or NO MODEL.

For today's run, do not require historical grading. For a backtest, also obey `HISTORICAL_BACKTEST.md`.
