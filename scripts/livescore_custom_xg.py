#!/usr/bin/env python3
"""
FIH Step 2 pilot: custom xG using persisted LiveScore match history.

Formula is derived from the user-supplied SofaScore prototype:
- last 5 overall matches
- last 5 home matches for today's home team
- last 5 away matches for today's away team
- up to 5 H2H meetings
- weights 0.45 venue / 0.35 overall / 0.20 H2H
- home multiplier 1.08 / away multiplier 0.95
- lean threshold 0.35
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from zoneinfo import ZoneInfo

SAST = ZoneInfo("Africa/Johannesburg")
DEFAULT_GOALS = 1.2
DEFAULT_H2H_HOME = 1.3
DEFAULT_H2H_AWAY = 1.1


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def numeric_score(value) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def flatten_step1_events(snapshot: dict) -> List[dict]:
    rows: List[dict] = []
    for stage in snapshot.get("payload", {}).get("Stages", []) or []:
        for event in stage.get("Events", []) or []:
            home = (event.get("T1") or [{}])[0]
            away = (event.get("T2") or [{}])[0]
            if not home.get("ID") or not away.get("ID") or not event.get("Eid"):
                continue
            rows.append(
                {
                    "fixture_id": str(event.get("Eid")),
                    "kickoff": str(event.get("Esd") or ""),
                    "status": str(event.get("Eps") or ""),
                    "competition": stage.get("CompN") or stage.get("Snm") or "",
                    "stage": stage.get("Snm") or "",
                    "country": stage.get("CompD") or stage.get("Cnm") or "",
                    "home_id": str(home.get("ID")),
                    "home": home.get("Nm") or "",
                    "away_id": str(away.get("ID")),
                    "away": away.get("Nm") or "",
                    "home_goals": numeric_score(event.get("Tr1")),
                    "away_goals": numeric_score(event.get("Tr2")),
                }
            )
    return rows


def historical_rows(history_dir: Path, target_date: str) -> List[dict]:
    rows: List[dict] = []
    for path in sorted(history_dir.glob("*.json")):
        file_date = path.stem
        if file_date >= target_date:
            continue
        try:
            snapshot = load_json(path)
        except (OSError, json.JSONDecodeError):
            continue

        if snapshot.get("date") != file_date:
            continue

        for row in flatten_step1_events(snapshot):
            if row["home_goals"] is None or row["away_goals"] is None:
                continue
            status = row["status"].lower()
            if status in {"ns", "postp.", "postp", "canc.", "canc", "abd.", "abd"}:
                continue
            row["date"] = file_date
            rows.append(row)

    rows.sort(key=lambda r: (r.get("date", ""), r.get("kickoff", "")), reverse=True)
    return rows


def take_team_matches(
    rows: Iterable[dict],
    team_id: str,
    is_home: Optional[bool],
    limit: int = 5,
) -> List[dict]:
    selected: List[dict] = []
    for row in rows:
        if team_id not in (row["home_id"], row["away_id"]):
            continue
        if is_home is True and row["home_id"] != team_id:
            continue
        if is_home is False and row["away_id"] != team_id:
            continue
        selected.append(row)
        if len(selected) >= limit:
            break
    return selected


def extract_goals(matches: List[dict], team_id: str) -> Dict:
    scored: List[float] = []
    conceded: List[float] = []

    for match in matches:
        if match["home_id"] == team_id:
            scored.append(float(match["home_goals"]))
            conceded.append(float(match["away_goals"]))
        elif match["away_id"] == team_id:
            scored.append(float(match["away_goals"]))
            conceded.append(float(match["home_goals"]))

    return {
        "scored": scored,
        "conceded": conceded,
        "avg_scored": sum(scored) / len(scored) if scored else DEFAULT_GOALS,
        "avg_conceded": sum(conceded) / len(conceded) if conceded else DEFAULT_GOALS,
        "matches": len(scored),
    }


def form_stats(rows: List[dict], team_id: str, is_home: Optional[bool], limit: int = 5) -> Dict:
    return extract_goals(take_team_matches(rows, team_id, is_home, limit), team_id)


def h2h_stats(rows: List[dict], current_home_id: str, current_away_id: str, limit: int = 5) -> Dict:
    home_goals: List[float] = []
    away_goals: List[float] = []
    pair = {current_home_id, current_away_id}

    for row in rows:
        if {row["home_id"], row["away_id"]} != pair:
            continue

        if row["home_id"] == current_home_id:
            home_goals.append(float(row["home_goals"]))
            away_goals.append(float(row["away_goals"]))
        else:
            home_goals.append(float(row["away_goals"]))
            away_goals.append(float(row["home_goals"]))

        if len(home_goals) >= limit:
            break

    return {
        "avg_home_goals": sum(home_goals) / len(home_goals) if home_goals else DEFAULT_H2H_HOME,
        "avg_away_goals": sum(away_goals) / len(away_goals) if away_goals else DEFAULT_H2H_AWAY,
        "matches": len(home_goals),
    }


def calculate_custom_xg(rows: List[dict], home_id: str, away_id: str) -> Dict:
    home_overall = form_stats(rows, home_id, is_home=None, limit=5)
    home_home = form_stats(rows, home_id, is_home=True, limit=5)
    away_overall = form_stats(rows, away_id, is_home=None, limit=5)
    away_away = form_stats(rows, away_id, is_home=False, limit=5)
    h2h = h2h_stats(rows, home_id, away_id, limit=5)

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


def prediction_from_xg(home_xg: float, away_xg: float) -> str:
    if home_xg > away_xg + 0.35:
        return "Home"
    if away_xg > home_xg + 0.35:
        return "Away"
    return "Draw"


def resolve_step1_path(date: str) -> Path:
    prediction = Path("data/prediction-fixtures") / f"{date}.json"
    backtest = Path("data/backtest/fixtures") / f"{date}.json"
    if prediction.exists():
        return prediction
    if backtest.exists():
        return backtest
    raise FileNotFoundError(f"No Step 1 fixture file for {date}")


def run(date: str, max_matches: int, output: Path) -> dict:
    step1_path = resolve_step1_path(date)
    step1 = load_json(step1_path)
    if step1.get("date") != date or int(step1.get("fixtureCount") or 0) < 1:
        raise RuntimeError("Step 1 fixture gate failed")

    fixtures = flatten_step1_events(step1)
    selected = fixtures[:max_matches]
    history_dir = Path("data/backtest/fixtures")
    history = historical_rows(history_dir, date)
    history_dates = sorted({row["date"] for row in history})

    if not selected:
        raise RuntimeError("No Step 1 fixtures selected")
    if not history:
        raise RuntimeError("No completed LiveScore history available before target date")

    predictions: List[dict] = []
    for index, fixture in enumerate(selected, 1):
        xg = calculate_custom_xg(history, fixture["home_id"], fixture["away_id"])
        prediction = {
            "match_id": fixture["fixture_id"],
            "date": date,
            "kickoff": fixture["kickoff"],
            "tournament": fixture["competition"],
            "country": fixture["country"],
            "home_team": fixture["home"],
            "home_team_id": fixture["home_id"],
            "away_team": fixture["away"],
            "away_team_id": fixture["away_id"],
            "xG_home": xg["xG_home"],
            "xG_away": xg["xG_away"],
            "xG_total": xg["xG_total"],
            "prediction": prediction_from_xg(xg["xG_home"], xg["xG_away"]),
            "details": xg,
        }
        predictions.append(prediction)
        print(
            f"[{index}/{len(selected)}] {fixture['home']} vs {fixture['away']} "
            f"-> {xg['xG_home']} - {xg['xG_away']} | {prediction['prediction']} "
            f"| form {xg['home_stats']['overall_matches']}/{xg['home_stats']['home_matches']} "
            f"vs {xg['away_stats']['overall_matches']}/{xg['away_stats']['away_matches']} "
            f"| h2h {xg['h2h_avg']['matches']}"
        )

    full_overall = sum(
        1
        for p in predictions
        if p["details"]["home_stats"]["overall_matches"] >= 5
        and p["details"]["away_stats"]["overall_matches"] >= 5
    )
    full_venue = sum(
        1
        for p in predictions
        if p["details"]["home_stats"]["home_matches"] >= 5
        and p["details"]["away_stats"]["away_matches"] >= 5
    )
    full_h2h = sum(1 for p in predictions if p["details"]["h2h_avg"]["matches"] >= 5)

    payload = {
        "schema": "fih-livescore-custom-xg-v1",
        "mode": "STEP2_PILOT",
        "date": date,
        "timezone": "Africa/Johannesburg",
        "provider": "LiveScore via RapidAPI historical fixture snapshots",
        "generatedAt": datetime.now(SAST).isoformat(),
        "step1Path": str(step1_path),
        "step1FixtureCount": int(step1["fixtureCount"]),
        "historyDateCount": len(history_dates),
        "historyFirstDate": history_dates[0] if history_dates else None,
        "historyLastDate": history_dates[-1] if history_dates else None,
        "historyMatchCount": len(history),
        "selectedEventCount": len(selected),
        "predictionCount": len(predictions),
        "coverage": {
            "fixturesWithFullOverall5": full_overall,
            "fixturesWithFullVenue5": full_venue,
            "fixturesWithFullH2H5": full_h2h,
        },
        "formula": {
            "form_matches": 5,
            "h2h_matches": 5,
            "home_or_away_weight": 0.45,
            "overall_weight": 0.35,
            "h2h_weight": 0.20,
            "home_multiplier": 1.08,
            "away_multiplier": 0.95,
            "lean_threshold": 0.35,
            "default_goals_when_no_form": DEFAULT_GOALS,
            "default_h2h_home_when_none": DEFAULT_H2H_HOME,
            "default_h2h_away_when_none": DEFAULT_H2H_AWAY,
        },
        "predictions": predictions,
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Saved {output} with {len(predictions)} predictions")
    return payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="FIH LiveScore custom xG pilot")
    parser.add_argument("--date", required=True)
    parser.add_argument("--max-matches", type=int, default=15)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    datetime.strptime(args.date, "%Y-%m-%d")
    if args.max_matches < 1 or args.max_matches > 15:
        raise SystemExit("--max-matches must be between 1 and 15")
    output = args.output or Path("data/step2-xg") / f"{args.date}.json"
    run(args.date, args.max_matches, output)


if __name__ == "__main__":
    main()
