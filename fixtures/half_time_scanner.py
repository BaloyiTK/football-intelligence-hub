"""Evidence-gated scanner for live 0-0 half-time football matches.

The scanner deliberately separates fixture detection from market qualification.
A 0-0 score alone is never sufficient to recommend a bet.
"""
import json
from pathlib import Path


PROFILE_FILE = Path(__file__).resolve().parent / "data" / "team_profiles.json"

MIN_PROFILE_MATCHES = 8
MIN_HOME_NON_LOSS_RATE = 0.70
MIN_UNDER_25_RATE = 0.65
MAX_AVG_TOTAL_GOALS = 2.40
MAX_FIRST_HALF_XG = 0.90
MAX_FIRST_HALF_SOT = 4


def _value(obj, *paths):
    """Return the first non-None value found at any dotted path."""
    for path in paths:
        current = obj
        for key in path.split("."):
            if not isinstance(current, dict) or key not in current:
                current = None
                break
            current = current[key]
        if current is not None:
            return current
    return None


def _number(value):
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _team_name(fixture, side):
    value = _value(
        fixture,
        f"{side}Team.name",
        f"{side}Team",
        f"{side}.name",
        f"teams.{side}.name",
        f"{side}_team.name",
        f"{side}_team",
    )
    return str(value).strip() if value else None


def _score(fixture, side):
    candidates = (
        f"scores.{side}",
        f"score.{side}",
        f"{side}Score",
        f"{side}_score",
        f"{side}Team.score",
        f"score.{side}Team",
    )
    value = _value(fixture, *candidates)
    if isinstance(value, dict):
        value = value.get("current", value.get("total", value.get("goals")))
    number = _number(value)
    return int(number) if number is not None and number.is_integer() else None


def _is_half_time(fixture):
    status = _value(
        fixture,
        "status",
        "fixture.status",
        "match.status",
        "period",
        "time.status",
    )
    if isinstance(status, dict):
        status = status.get("short", status.get("code", status.get("description")))
    normalized = str(status or "").strip().upper().replace("-", "_").replace(" ", "_")
    return normalized in {
        "HT", "HALF_TIME", "HALFTIME", "HALF_TIME_BREAK",
        "INTERVAL", "BREAK",
    }


def _live_stats(fixture):
    """Extract first-half stats only when the feed labels them as first-half data."""
    stats = _value(fixture, "statistics.firstHalf", "statistics.first_half",
                   "stats.firstHalf", "stats.first_half", "firstHalfStats",
                   "first_half_stats")
    if not isinstance(stats, dict):
        return None

    home_xg = _number(_value(stats, "home.xg", "home.expectedGoals", "home.expected_goals"))
    away_xg = _number(_value(stats, "away.xg", "away.expectedGoals", "away.expected_goals"))
    home_sot = _number(_value(stats, "home.shotsOnTarget", "home.shots_on_target", "home.sot"))
    away_sot = _number(_value(stats, "away.shotsOnTarget", "away.shots_on_target", "away.sot"))
    if home_xg is None or away_xg is None or home_sot is None or away_sot is None:
        return None
    return {
        "total_xg": round(home_xg + away_xg, 2),
        "total_shots_on_target": int(home_sot + away_sot),
        "home_xg": round(home_xg, 2),
        "away_xg": round(away_xg, 2),
        "home_shots_on_target": int(home_sot),
        "away_shots_on_target": int(away_sot),
    }


def load_team_profiles():
    try:
        with PROFILE_FILE.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        teams = payload.get("teams", {})
        return teams if isinstance(teams, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def _profile(teams, league, name):
    # Profiles are league-scoped to prevent same-name clubs in different
    # competitions from inheriting one another's statistics.
    if not league or not name:
        return None
    key = f"{league}::{name}"
    return teams.get(key) or teams.get(key.lower())


def _sample_ok(profile):
    return bool(profile and (_number(profile.get("matches")) or 0) >= MIN_PROFILE_MATCHES)


def _assess_home_draw(home_profile, live_stats, fixture):
    reasons = []
    if not _sample_ok(home_profile):
        return "NO_QUALIFICATION", ["Insufficient verified home-team pre-match sample (minimum 8 matches)."]

    if str(home_profile.get("pre_match_favourite", "")).lower() != "home":
        reasons.append("Home team is not verified as the pre-match favourite.")
    non_loss = _number(home_profile.get("home_non_loss_rate"))
    if non_loss is None or non_loss < MIN_HOME_NON_LOSS_RATE:
        reasons.append("Home team's historical home non-loss rate is below the 70% screening threshold or missing.")

    if live_stats is None:
        reasons.append("Verified first-half xG and shots-on-target data are unavailable.")
    else:
        if live_stats["home_xg"] + 0.25 < live_stats["away_xg"]:
            reasons.append("Home team is being outperformed on first-half xG.")
        if live_stats["home_shots_on_target"] + 1 < live_stats["away_shots_on_target"]:
            reasons.append("Home team is being outperformed on first-half shots on target.")

    home_red = _number(_value(fixture, "cards.home.red", "statistics.home.redCards",
                              "stats.home.red_cards"))
    if home_red is not None and home_red > 0:
        reasons.append("Home team has a red card.")

    if reasons:
        return "NO_QUALIFICATION", reasons
    return "QUALIFIES_FOR_REVIEW", [
        "Home team is recorded as the pre-match favourite.",
        f"Verified home non-loss rate: {non_loss:.1%}.",
        "0-0 at half-time; this is a review candidate, not an automatic bet.",
    ]


def _assess_under_25(home_profile, away_profile, live_stats):
    reasons = []
    if not _sample_ok(home_profile) or not _sample_ok(away_profile):
        return "NO_QUALIFICATION", ["Insufficient verified pre-match samples for both teams (minimum 8 matches each)."]
    for label, profile in (("Home", home_profile), ("Away", away_profile)):
        under_rate = _number(profile.get("under_2_5_rate"))
        average = _number(profile.get("avg_total_goals"))
        if under_rate is None or under_rate < MIN_UNDER_25_RATE:
            reasons.append(f"{label} team's Under 2.5 historical rate is below 65% or missing.")
        if average is None or average > MAX_AVG_TOTAL_GOALS:
            reasons.append(f"{label} team's average total goals is above 2.40 or missing.")

    if live_stats is None:
        reasons.append("Verified first-half xG and shots-on-target data are unavailable.")
    else:
        if live_stats["total_xg"] > MAX_FIRST_HALF_XG:
            reasons.append(f"Combined first-half xG ({live_stats['total_xg']}) exceeds 0.90.")
        if live_stats["total_shots_on_target"] > MAX_FIRST_HALF_SOT:
            reasons.append(f"Combined first-half shots on target ({live_stats['total_shots_on_target']}) exceed 4.")

    if reasons:
        return "NO_QUALIFICATION", reasons
    return "QUALIFIES_FOR_REVIEW", [
        "Both teams meet the historical Under 2.5 screening thresholds.",
        f"Combined first-half xG: {live_stats['total_xg']:.2f}.",
        f"Combined first-half shots on target: {live_stats['total_shots_on_target']}.",
        "Review the live price and implied probability before any decision.",
    ]


def scan_zero_zero_half_time(fixtures, profiles=None):
    profiles = profiles if profiles is not None else load_team_profiles()
    candidates = []
    for fixture in fixtures:
        if not isinstance(fixture, dict) or not _is_half_time(fixture):
            continue
        home_goals, away_goals = _score(fixture, "home"), _score(fixture, "away")
        if home_goals != 0 or away_goals != 0:
            continue

        home, away = _team_name(fixture, "home"), _team_name(fixture, "away")
        league = _value(fixture, "league.name", "competition.name", "league")
        if isinstance(league, dict):
            league = league.get("name")
        home_profile = _profile(profiles, league, home)
        away_profile = _profile(profiles, league, away)
        live_stats = _live_stats(fixture)
        hd_status, hd_reasons = _assess_home_draw(home_profile, live_stats, fixture)
        under_status, under_reasons = _assess_under_25(home_profile, away_profile, live_stats)
        candidates.append({
            "fixture_id": _value(fixture, "id", "fixture.id", "matchId"),
            "home_team": home or "Unknown home team",
            "away_team": away or "Unknown away team",
            "score": "0-0",
            "status": "HALF_TIME",
            "league": league,
            "kickoff": _value(fixture, "startTime", "kickoff", "fixture.date", "date"),
            "live_stats": live_stats,
            "markets": {
                "home_or_draw_1x": {"status": hd_status, "reasons": hd_reasons},
                "under_2_5": {"status": under_status, "reasons": under_reasons},
            },
        })
    return candidates
