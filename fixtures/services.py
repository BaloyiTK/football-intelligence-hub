import os
import requests

def fetch_fixtures(day=None):
    url = os.environ["ls_api_url"]
    api_key = os.environ["ls_api_key"]
    headers = {"Accept": "application/json", "Authorization": f"Bearer {api_key}"}
    response = requests.get(url, headers=headers, timeout=20)
    if response.status_code in (401, 403):
        response = requests.get(url, params={"api_token": api_key}, headers={"Accept": "application/json"}, timeout=20)
    response.raise_for_status()
    payload = response.json()
    data = payload.get("data", payload)
    return data if isinstance(data, list) else []
