# Model Training and Promotion

FIH uses controlled self-calibration. Training may propose changes from completed, graded historical/backtest evidence, but it must never silently rewrite the production model.

## Training
Run `npm run model:train`.

The trainer:
- reads completed backtests and verified historical prediction outcomes;
- deduplicates overlapping graded observations;
- keeps chronological order and reserves the newest 20% as holdout;
- computes hit rate and probability Brier score;
- optimizes a bounded probability-calibration temperature on chronological training data only;
- evaluates the selected calibration on the untouched newest 20% holdout;
- performs expanding-window walk-forward calibration, fitting each step only on observations strictly earlier than the scored observation;
- reports performance by market, rating and evidence/model level;
- writes `data/training/candidate-v2.4.json`;
- appends an immutable JSONL event to `data/training/training-log.jsonl`.

## Audit log
Every attempt records timestamp, production/candidate versions, source files, sample counts, train/holdout metrics, diagnostics, decision and reason. Never rewrite previous JSONL entries.

## Promotion gate
A candidate MUST NOT replace `lib/model.ts` merely because training ran. Promotion requires:
1. at least 100 unique graded bets total;
2. at least 20 chronological holdout bets;
3. leakage-free expanding-window walk-forward evaluation with at least 20 scored folds and lower aggregate Brier score than V2.3;
4. improved calibration/Brier score;
5. no material hit-rate regression;
6. deterministic validation/backtest success;
7. a versioned promotion log entry with old/new parameters and metrics.

Until every gate passes, decision remains NOT_PROMOTED and V2.3 stays production. If every statistical gate passes, training may emit READY_FOR_EXPLICIT_PROMOTION; it still must not rewrite production automatically. Promotion requires an explicit versioned code change and validation.
