import base64
import json
import os
from datetime import datetime, timezone

import requests

REPO = "BaloyiTK/football-intelligence-hub"

def commit_fixtures(fixtures):
    token = os.environ["FIH_GITHUB_TOKEN"]
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    path = f"fixtures/data/{day}.json"
    api = f"https://api.github.com/repos/{REPO}/contents/{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    existing = requests.get(api, headers=headers, timeout=20)
    body = {
        "message": f"data: save livescore fixtures for {day}",
        "content": base64.b64encode(
            json.dumps({"date": day, "count": len(fixtures), "fixtures": fixtures}, indent=2).encode()
        ).decode(),
        "branch": "main",
    }
    if existing.status_code == 200:
        body["sha"] = existing.json()["sha"]
    elif existing.status_code != 404:
        existing.raise_for_status()
    response = requests.put(api, headers=headers, json=body, timeout=20)
    response.raise_for_status()
    return {"path": path, "commit": response.json()["commit"]["sha"]}


def commit_team_profiles(payload):
    """Persist the verified historical profile snapshot on the main branch."""
    token = os.environ["FIH_GITHUB_TOKEN"]
    path = "fixtures/data/team_profiles.json"
    api = f"https://api.github.com/repos/{REPO}/contents/{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    existing = requests.get(api, headers=headers, timeout=20)
    body = {
        "message": f"data: refresh historical team profiles ({payload.get('team_count', 0)} teams)",
        "content": base64.b64encode(
            json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")
        ).decode(),
        "branch": "main",
    }
    if existing.status_code == 200:
        body["sha"] = existing.json()["sha"]
    elif existing.status_code != 404:
        existing.raise_for_status()
    response = requests.put(api, headers=headers, json=body, timeout=30)
    response.raise_for_status()
    return {"path": path, "commit": response.json()["commit"]["sha"]}
