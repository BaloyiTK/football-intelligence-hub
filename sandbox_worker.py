#!/usr/bin/env python3
"""Daily FIH worker: fetch fixtures and refresh historical profiles in one run."""

from fixtures.github_sync import commit_fixtures, commit_team_profiles
from fixtures.services import fetch_fixtures
from fixtures.team_profile_importer import build_team_profiles


def main():
    fixtures = fetch_fixtures()
    if not fixtures:
        raise RuntimeError("Livescore returned zero fixtures; refusing to commit an empty dataset")
    fixture_result = commit_fixtures(fixtures)

    profiles = build_team_profiles()
    if not profiles.get("teams"):
        raise RuntimeError(
            "Historical profile import returned zero teams; preserving previous profile snapshot"
        )
    profile_result = commit_team_profiles(profiles)
    print(
        "FIH_SANDBOX_OK "
        f"fixtures={len(fixtures)} fixture_path={fixture_result['path']} "
        f"profile_teams={profiles['team_count']} profile_path={profile_result['path']} "
        f"source={profiles['source']}"
    )


if __name__ == "__main__":
    main()
