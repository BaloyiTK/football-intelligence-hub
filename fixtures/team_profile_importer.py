"""Build league-scoped team profiles from free historical CSV results.

Source: football-data.co.uk. Missing seasons/leagues are skipped; no synthetic
statistics are generated. The importer is run by the existing daily FIH worker.
"""
import csv
import io
import re
from collections import defaultdict
from datetime import datetime, timezone

import requests

SEASONS = ("2627", "2526", "2425")
LEAGUES = {
    "E0": "Premier League", "E1": "Championship", "E2": "League One",
    "E3": "League Two", "EC": "National League",
    "SC0": "Scottish Premiership", "SC1": "Scottish Championship",
    "D1": "Bundesliga", "D2": "2. Bundesliga",
    "I1": "Serie A", "I2": "Serie B",
    "SP1": "La Liga", "SP2": "Segunda Division",
    "F1": "Ligue 1", "F2": "Ligue 2",
    "N1": "Eredivisie", "B1": "Belgian Pro League",
    "P1": "Primeira Liga", "T1": "Super Lig",
    "G1": "Super League Greece", "A1": "Austrian Bundesliga",
    " A1": "Austrian Bundesliga", "AUT": "Austrian Bundesliga",
    "BRA": "Brazil Serie A", "ARG": "Argentina Primera Division",
}


def normalize(value):
    value = str(value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return " ".join(value.split())


ALIASES = {
    "england premier league": "premier league",
    "english premier league": "premier league",
    "england championship": "championship",
    "germany bundesliga": "bundesliga",
    "german bundesliga": "bundesliga",
    "italy serie a": "serie a",
    "italian serie a": "serie a",
    "spain la liga": "la liga",
    "spanish la liga": "la liga",
    "france ligue 1": "ligue 1",
    "portugal primeira liga": "primeira liga",
    "portuguese primeira liga": "primeira liga",
    "turkey super lig": "super lig",
    "netherlands eredivisie": "eredivisie",
    "holland eredivisie": "eredivisie",
    "scotland premiership": "scottish premiership",
}


def canonical_league(name):
    normalized = normalize(name)
    return ALIASES.get(normalized, normalized)


def _float(row, *keys):
    for key in keys:
        try:
            value = row.get(key)
            if value not in (None, ""):
                return float(value)
        except (TypeError, ValueError):
            pass
    return None


def _rows_for_season(session, code, timeout=20):
    url = f"https://www.football-data.co.uk/mmz4281/{session}/{code}.csv"
    response = requests.get(url, timeout=timeout, headers={"User-Agent": "Football-Intelligence-Hub/1.0"})
    if response.status_code == 404:
        return []
    response.raise_for_status()
    content = response.content.decode("utf-8-sig", errors="replace")
    # football-data occasionally emits a UTF-8 BOM or inconsistent line endings.
    return list(csv.DictReader(io.StringIO(content)))


def build_team_profiles(seasons=SEASONS, league_codes=None, session=None):
    """Return profile JSON payload; optionally inject a requests-like session in tests."""
    http = session or requests
    codes = league_codes or tuple(LEAGUES)
    aggregates = defaultdict(lambda: {
        "matches": 0, "home_matches": 0, "home_non_loss": 0,
        "under_2_5": 0, "total_goals": 0,
    })
    imported_files = []
    for season in seasons:
        for code in codes:
            league = LEAGUES.get(code)
            if not league:
                continue
            try:
                rows = _rows_for_season_with(http, season, code)
            except (requests.RequestException, UnicodeError, csv.Error):
                continue
            if not rows:
                continue
            imported_files.append(f"{season}/{code}.csv")
            league_key = canonical_league(league)
            for row in rows:
                home = normalize(row.get("HomeTeam"))
                away = normalize(row.get("AwayTeam"))
                hg, ag = _float(row, "FTHG"), _float(row, "FTAG")
                if not home or not away or hg is None or ag is None:
                    continue
                hg, ag = int(hg), int(ag)
                total = hg + ag
                for team in (home, away):
                    item = aggregates[(league_key, team)]
                    item["matches"] += 1
                    item["under_2_5"] += int(total <= 2)
                    item["total_goals"] += total
                home_item = aggregates[(league_key, home)]
                home_item["home_matches"] += 1
                home_item["home_non_loss"] += int(hg >= ag)

    teams = {}
    for (league, team), item in aggregates.items():
        if item["matches"] == 0:
            continue
        teams[f"{league}::{team}"] = {
            "matches": item["matches"],
            "home_matches": item["home_matches"],
            "home_non_loss_rate": round(item["home_non_loss"] / item["home_matches"], 4)
                if item["home_matches"] else None,
            "under_2_5_rate": round(item["under_2_5"] / item["matches"], 4),
            "avg_total_goals": round(item["total_goals"] / item["matches"], 3),
        }
    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": "football-data.co.uk",
        "seasons": list(seasons),
        "files_imported": imported_files,
        "team_count": len(teams),
        "teams": teams,
    }


def _rows_for_season_with(http, season, code):
    url = f"https://www.football-data.co.uk/mmz4281/{season}/{code}.csv"
    response = http.get(url, timeout=20, headers={"User-Agent": "Football-Intelligence-Hub/1.0"})
    if response.status_code == 404:
        return []
    response.raise_for_status()
    return list(csv.DictReader(io.StringIO(response.content.decode("utf-8-sig", errors="replace"))))
