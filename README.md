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
