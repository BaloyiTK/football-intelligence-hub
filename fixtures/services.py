from datetime import date
import requests

BASE_URL="https://api.sofascore.com/api/v1"
HEADERS={"User-Agent":"Mozilla/5.0","Accept":"application/json","Referer":"https://www.sofascore.com/"}

def fetch_fixtures(day=None):
    day=day or date.today().isoformat()
    url=f"{BASE_URL}/sport/football/scheduled-events/{day}"
    response=requests.get(url,headers=HEADERS,timeout=15)
    response.raise_for_status()
    data=response.json()
    return [event for event in data.get("events",[]) if event.get("status",{}).get("type")=="notstarted"]
