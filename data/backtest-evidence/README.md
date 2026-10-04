# Backtest evidence input

The CLI runner consumes a JSON array of verified historical fixtures. Research/collection is deliberately separate from calculation so every run is reproducible and auditable.

Each fixture must contain:
- date (YYYY-MM-DD), kickoff, leagueId, homeTeam, awayTeam
- evidenceCutoff (must be before kickoff)
- modelLevel: full | standard | basic | no-model
- sampleSize
- inputs: exact ModelInput fields required by lib/model.ts (omit only for no-model)
- actualScore: {home, away}
- sources: public source URLs/references used to verify fixture/result and reconstructed pre-kickoff inputs
- noModelReason when modelLevel=no-model

Never place information learned after evidenceCutoff into inputs. The final score is grading data only.
