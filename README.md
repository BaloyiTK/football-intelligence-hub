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
- Profile values: `matches` (sample size), `pre_match_favourite` (use `home` only when verified), `home_non_loss_rate`, `under_2_5_rate`, and `avg_total_goals`. Rates are decimals from 0 to 1. Profiles must be league-scoped/verified before production use; do not combine teams with the same name across competitions.
- Current screening thresholds are initial conservative rules and must be backtested and calibrated before being treated as a production model.
