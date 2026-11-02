import unittest
from unittest.mock import Mock

from fixtures.team_profile_importer import build_team_profiles, canonical_league, normalize, normalize_team


class FakeResponse:
    def __init__(self, content, status_code=200):
        self.content = content.encode("utf-8")
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError("HTTP error")


class FakeSession:
    def __init__(self, mapping):
        self.mapping = mapping
    def get(self, url, **kwargs):
        return self.mapping.get(url, FakeResponse("", 404))


class TeamProfileImporterTests(unittest.TestCase):
    def test_normalizes_team_and_league_names(self):
        self.assertEqual(normalize("  Man. United "), "man united")
        self.assertEqual(canonical_league("England Premier League"), "premier league")
        self.assertEqual(normalize_team("Manchester United"), "man united")

    def test_builds_profiles_from_real_result_fields(self):
        csv_text = (
            "HomeTeam,AwayTeam,FTHG,FTAG,FTR\n"
            "Arsenal,Chelsea,2,0,H\n"
            "Chelsea,Arsenal,1,1,D\n"
            "Arsenal,Chelsea,0,1,A\n"
        )
        fake = FakeSession({
            "https://www.football-data.co.uk/mmz4281/test/E0.csv": FakeResponse(csv_text)
        })
        payload = build_team_profiles(
            seasons=("test",), league_codes=("E0",), session=fake
        )
        home = payload["teams"]["premier league::arsenal"]
        self.assertEqual(home["matches"], 3)
        self.assertEqual(home["home_matches"], 2)
        self.assertEqual(home["home_non_loss_rate"], 0.5)
        self.assertAlmostEqual(home["under_2_5_rate"], 1.0, places=3)
        self.assertEqual(payload["team_count"], 2)

    def test_empty_history_produces_no_fabricated_profiles(self):
        fake = FakeSession({})
        payload = build_team_profiles(seasons=("test",), league_codes=("E0",), session=fake)
        self.assertEqual(payload["teams"], {})
        self.assertEqual(payload["team_count"], 0)


if __name__ == "__main__":
    unittest.main()
