# Football Intelligence Hub

Minimal Django/Python fixture collector.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py fetch_fixtures
python manage.py runserver
```

JSON endpoint: `/fixtures/today/`


## 0-0 Half-Time Scanner

- Scanner page: `/scanner/half-time/`
- JSON endpoint: `/api/half-time-scanner/`
- The scanner detects only fixtures explicitly marked half-time with a 0-0 score.
- Home-or-draw (1X) and Under 2.5 are assessed independently.
- A market is shown as `QUALIFIES_FOR_REVIEW` only when its required pre-match profile and live first-half evidence are present. This is a review state, not an automatic bet recommendation.
- Team profiles are stored in `fixtures/data/team_profiles.json`. The file intentionally starts empty; missing or inadequate evidence produces `NO_QUALIFICATION`, never a guessed selection.
- Profile values: `matches` (sample size), `pre_match_favourite` (use `home` only when verified), `home_non_loss_rate`, `under_2_5_rate`, and `avg_total_goals`. Rates are decimals from 0 to 1. Profiles must be keyed as `League Name::Team Name` and verified before production use; do not combine teams with the same name across competitions.
- Current screening thresholds are initial conservative rules and must be backtested and calibrated before being treated as a production model.


### Automatic historical profile refresh

The existing daily fixture worker now also downloads free historical results from football-data.co.uk for the supported league codes, calculates league-scoped team profiles, and commits the refreshed snapshot to `fixtures/data/team_profiles.json`. If the import yields zero teams, the worker preserves the previous snapshot and fails rather than overwriting good data with an empty file. Common club-name variants are normalized. Unsupported leagues or teams with inadequate samples remain unqualified.

The scanner requires actual pre-match 1X2 odds to establish whether the home side was favourite for H/D, plus verified first-half xG and shots-on-target data. Missing fields fail closed; the scanner does not infer favourites from the live score. The daily import runs inside the existing fixture worker, so no additional scheduled job is added.
