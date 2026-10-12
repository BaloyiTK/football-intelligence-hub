#!/usr/bin/env python3
"""Ephemeral FIH Sandbox worker: fetch fixtures and persist them to GitHub."""

from fixtures.github_sync import commit_fixtures
from fixtures.services import fetch_fixtures


def main():
    fixtures = fetch_fixtures()
    if not fixtures:
        raise RuntimeError("Livescore returned zero fixtures; refusing to commit an empty dataset")
    result = commit_fixtures(fixtures)
    print(f"FIH_SANDBOX_OK count={len(fixtures)} path={result['path']} commit={result['commit']}")


if __name__ == "__main__":
    main()
