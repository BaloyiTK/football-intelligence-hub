#!/usr/bin/env python3
"""
FIH Step 2 pilot: Custom xG calculator using SofaScore public form data.
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from zoneinfo import ZoneInfo

import requests

BASE_URLS = ["https://api.sofascore.com/api/v1", "https://www.sofascore.com/api/v1"]
SAST = ZoneInfo("Africa/Johannesburg")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://www.sofascore.com/",
}

DEFAULT_GOALS = 1.2
DEFAULT_H2H_HOME = 1.3
DEFAULT_H2H_AWAY = 1.1


class SofaScoreClient:
    def __init__(self, timeout: int = 15, min_interval: float = 0.15):
        self.timeout = timeout
        self.min_interval = min_interval
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.last_request_at = 0.0
        self.team_cache: Dict[int, List[Dict]] = {}
        self.request_count = 0

    def _pace(self) -> None:
        elapsed = time.monotonic() - self.last_request_at
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)

    def get_json(self, path: str, attempts: int = 3) -> Optional[dict]:
        urls = [path] if path.startswith("http") else [f"{base}{path}" for base in BASE_URLS]

        for url in urls:
            for attempt in range(1, attempts + 1):
                try:
                    self._pace()
                    response = self.session.get(url, timeout=self.timeout)
                    self.last_request_at = time.monotonic()
                    self.request_count += 1

                    if response.status_code == 403:
                        print(f"  ⚠️  SofaScore host denied request: {url}; trying alternate public host")
                        break

                    if response.status_code == 429 or 500 <= response.status_code < 600:
                        if attempt < attempts:
                            time.sleep(0.75 * attempt)
                            continue

                    response.raise_for_status()
                    return response.json()
                except (requests.RequestException, ValueError) as exc:
                    if attempt == attempts:
                        print(f"  ⚠️  SofaScore request failed: {url}: {exc}")
                        break
                    time.sleep(0.75 * attempt)

        return None

    def scheduled_events(self, date: str) -> List[Dict]:
        data = self.get_json(f"/sport/football/scheduled-events/{date}")
        return data.get("events", []) if data else []

    def team_last_matches(self, team_id: int, pages: int = 4) -> List[Dict]:
        if team_id in self.team_cache:
            return self.team_cache[team_id]

        events: List[Dict] = []
        for page in range(pages):
            data = self.get_json(f"/team/{team_id}/events/last/{page}")
            if not data:
                break
            events.extend(data.get("events", []))
            if not data.get("hasNextPage"):
                break

        deduped: List[Dict] = []
        seen = set()
        for event in events:
            event_id = event.get("id")
            if event_id in seen:
                continue
            seen.add(event_id)
            deduped.append(event)

        self.team_cache[team_id] = deduped
        return deduped

    def h2h_events(self, event_id: int) -> List[Dict]:
        data = self.get_json(f"/event/{event_id}/h2h/events")
        return data.get("events", []) if data else []


def local_today() -> str:
    return datetime.now(SAST).strftime("%Y-%m-%d")


def finished(match: Dict) -> bool:
    return match.get("status", {}).get("type") == "finished"


def extract_goals(matches: List[Dict], team_id: int) -> Dict:
    scored: List[float] = []
    conceded: List[float] = []

    for match in matches:
        if not finished(match):
            continue

        home_id = match.get("homeTeam", {}).get("id")
        away_id = match.get("awayTeam", {}).get("id")
        hs = match.get("homeScore", {}).get("current")
        aws = match.get("awayScore", {}).get("current")

        if hs is None or aws is None:
            continue

        if home_id == team_id:
            scored.append(float(hs))
            conceded.append(float(aws))
        elif away_id == team_id:
            scored.append(float(aws))
            conceded.append(float(hs))

    return {
        "scored": scored,
        "conceded": conceded,
        "avg_scored": sum(scored) / len(scored) if scored else DEFAULT_GOALS,
        "avg_conceded": sum(conceded) / len(conceded) if conceded else DEFAULT_GOALS,
        "matches": len(scored),
    }


def form_stats(all_matches: List[Dict], team_id: int, is_home: Optional[bool], limit: int = 5) -> Dict:
    filtered: List[Dict] = []

    for match in all_matches:
        if not finished(match):
            continue

        home_id = match.get("homeTeam", {}).get("id")
        away_id = match.get("awayTeam", {}).get("id")

        if is_home is True and home_id != team_id:
            continue
        if is_home is False and away_id != team_id:
            continue
        if team_id not in (home_id, away_id):
            continue

        filtered.append(match)
        if len(filtered) >= limit:
            break

    return extract_goals(filtered, team_id)


def current_team_oriented_h2h(h2h_events: List[Dict], home_id: int, away_id: int, limit: int = 5) -> Dict:
    current_home_goals: List[float] = []
    current_away_goals: List[float] = []

    for match in h2h_events:
        if not finished(match):
            continue

        historical_home = match.get("homeTeam", {}).get("id")
        historical_away = match.get("awayTeam", {}).get("id")
        hs = match.get("homeScore", {}).get("current")
        aws = match.get("awayScore", {}).get("current")

        if hs is None or aws is None:
            continue

        if historical_home == home_id and historical_away == away_id:
            current_home_goals.append(float(hs))
            current_away_goals.append(float(aws))
        elif historical_home == away_id and historical_away == home_id:
            current_home_goals.append(float(aws))
            current_away_goals.append(float(hs))
        else:
            continue

        if len(current_home_goals) >= limit:
            break

    return {
        "avg_home_goals": (
            sum(current_home_goals) / len(current_home_goals)
            if current_home_goals
            else DEFAULT_H2H_HOME
        ),
        "avg_away_goals": (
            sum(current_away_goals) / len(current_away_goals)
            if current_away_goals
            else DEFAULT_H2H_AWAY
        ),
        "matches": len(current_home_goals),
    }


def calculate_custom_xg(client: SofaScoreClient, home_id: int, away_id: int, event_id: int) -> Dict:
    home_matches = client.team_last_matches(home_id, pages=4)
    away_matches = client.team_last_matches(away_id, pages=4)

    home_overall = form_stats(home_matches, home_id, is_home=None, limit=5)
    home_home = form_stats(home_matches, home_id, is_home=True, limit=5)
    away_overall = form_stats(away_matches, away_id, is_home=None, limit=5)
    away_away = form_stats(away_matches, away_id, is_home=False, limit=5)

    h2h = current_team_oriented_h2h(
        client.h2h_events(event_id), home_id=home_id, away_id=away_id, limit=5
    )
    h2h_avg_home = h2h["avg_home_goals"]
    h2h_avg_away = h2h["avg_away_goals"]

    home_attack = (
        0.45 * home_home["avg_scored"]
        + 0.35 * home_overall["avg_scored"]
        + 0.20 * h2h_avg_home
    )
    away_defence = (
        0.45 * away_away["avg_conceded"]
        + 0.35 * away_overall["avg_conceded"]
        + 0.20 * h2h_avg_home
    )
    away_attack = (
        0.45 * away_away["avg_scored"]
        + 0.35 * away_overall["avg_scored"]
        + 0.20 * h2h_avg_away
    )
    home_defence = (
        0.45 * home_home["avg_conceded"]
        + 0.35 * home_overall["avg_conceded"]
        + 0.20 * h2h_avg_away
    )

    xg_home = ((home_attack + away_defence) / 2) * 1.08
    xg_away = ((away_attack + home_defence) / 2) * 0.95

    return {
        "xG_home": round(xg_home, 2),
        "xG_away": round(xg_away, 2),
        "xG_total": round(xg_home + xg_away, 2),
        "home_stats": {
            "overall_scored": round(home_overall["avg_scored"], 2),
            "home_scored": round(home_home["avg_scored"], 2),
            "overall_conceded": round(home_overall["avg_conceded"], 2),
            "home_conceded": round(home_home["avg_conceded"], 2),
            "overall_matches": home_overall["matches"],
            "home_matches": home_home["matches"],
        },
        "away_stats": {
            "overall_scored": round(away_overall["avg_scored"], 2),
            "away_scored": round(away_away["avg_scored"], 2),
            "overall_conceded": round(away_overall["avg_conceded"], 2),
            "away_conceded": round(away_away["avg_conceded"], 2),
            "overall_matches": away_overall["matches"],
            "away_matches": away_away["matches"],
        },
        "h2h_avg": {
            "home_goals": round(h2h_avg_home, 2),
            "away_goals": round(h2h_avg_away, 2),
            "matches": h2h["matches"],
        },
    }


def prediction_from_xg(xg_home: float, xg_away: float) -> str:
    if xg_home > xg_away + 0.35:
        return "Home"
    if xg_away > xg_home + 0.35:
        return "Away"
    return "Draw"


def run(date: str, max_matches: int, output: Path) -> Dict:
    client = SofaScoreClient()
    matches = client.scheduled_events(date)
    selected = matches[:max_matches]

    results: List[Dict] = []
    errors: List[Dict] = []

    print(
        f"Collecting SofaScore form + custom xG for {date}: "
        f"{len(selected)} of {len(matches)} scheduled events"
    )

    for index, match in enumerate(selected, 1):
        home = match.get("homeTeam") or {}
        away = match.get("awayTeam") or {}
        event_id = match.get("id")
        home_id = home.get("id")
        away_id = away.get("id")
        label = f"{home.get('name', '?')} vs {away.get('name', '?')}"
        print(f"[{index}/{len(selected)}] {label}")

        if not all(isinstance(v, int) for v in (event_id, home_id, away_id)):
            errors.append({"match": label, "event_id": event_id, "error": "missing numeric IDs"})
            continue

        try:
            xg = calculate_custom_xg(client, home_id, away_id, event_id)
            start_ts = match.get("startTimestamp")
            kickoff = (
                datetime.fromtimestamp(start_ts, tz=SAST).isoformat()
                if isinstance(start_ts, (int, float))
                else None
            )
            record = {
                "match_id": event_id,
                "date": date,
                "kickoff": kickoff,
                "tournament": match.get("tournament", {}).get("name"),
                "home_team": home.get("name"),
                "home_team_id": home_id,
                "away_team": away.get("name"),
                "away_team_id": away_id,
                "xG_home": xg["xG_home"],
                "xG_away": xg["xG_away"],
                "xG_total": xg["xG_total"],
                "prediction": prediction_from_xg(xg["xG_home"], xg["xG_away"]),
                "details": xg,
            }
            results.append(record)
            print(
                f"   → xG: {xg['xG_home']} - {xg['xG_away']} "
                f"| Lean: {record['prediction']}"
            )
        except Exception as exc:
            errors.append({"match": label, "event_id": event_id, "error": str(exc)})
            print(f"   ⚠️  {exc}")

    payload = {
        "schema": "fih-sofascore-custom-xg-v1",
        "mode": "STEP2_PILOT",
        "date": date,
        "timezone": "Africa/Johannesburg",
        "provider": "SofaScore public JSON",
        "generatedAt": datetime.now(SAST).isoformat(),
        "scheduledEventCount": len(matches),
        "selectedEventCount": len(selected),
        "predictionCount": len(results),
        "errorCount": len(errors),
        "requestCount": client.request_count,
        "formula": {
            "form_matches": 5,
            "h2h_matches": 5,
            "home_or_away_weight": 0.45,
            "overall_weight": 0.35,
            "h2h_weight": 0.20,
            "home_multiplier": 1.08,
            "away_multiplier": 0.95,
            "lean_threshold": 0.35,
        },
        "predictions": results,
        "errors": errors,
    }

    if not results:
        raise RuntimeError("No custom xG predictions were produced")

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"✅ Saved → {output}")
    return payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="FIH SofaScore custom xG pilot")
    parser.add_argument("--date", default=local_today())
    parser.add_argument("--max-matches", type=int, default=15)
    parser.add_argument("--output", type=Path, default=None)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        datetime.strptime(args.date, "%Y-%m-%d")
    except ValueError as exc:
        raise SystemExit("--date must be YYYY-MM-DD") from exc

    if args.max_matches < 1 or args.max_matches > 15:
        raise SystemExit("--max-matches must be between 1 and 15")

    output = args.output or Path("data/step2-xg") / f"{args.date}.json"
    run(args.date, args.max_matches, output)


if __name__ == "__main__":
    main()
