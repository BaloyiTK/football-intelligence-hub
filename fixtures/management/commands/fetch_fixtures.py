from django.core.management.base import BaseCommand
from fixtures.services import fetch_fixtures

class Command(BaseCommand):
    help="Fetch today's scheduled football fixtures"

    def handle(self,*args,**options):
        fixtures=fetch_fixtures()
        self.stdout.write(f"Fetched {len(fixtures)} fixtures")
        for event in fixtures:
            home=event.get("homeTeam",{}).get("name","?")
            away=event.get("awayTeam",{}).get("name","?")
            self.stdout.write(f"{event.get('id')}: {home} vs {away}")
