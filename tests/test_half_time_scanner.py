import unittest

from fixtures.half_time_scanner import scan_zero_zero_half_time


class HalfTimeScannerTests(unittest.TestCase):
    def test_only_explicit_zero_zero_half_time_fixtures_are_included(self):
        fixtures = [
            {"id": 1, "status": "HT", "homeTeam": {"name": "Home"}, "awayTeam": {"name": "Away"},
             "scores": {"home": 0, "away": 0}},
            {"id": 2, "status": "2H", "homeTeam": {"name": "Home"}, "awayTeam": {"name": "Away"},
             "scores": {"home": 0, "away": 0}},
            {"id": 3, "status": "HT", "homeTeam": {"name": "Home"}, "awayTeam": {"name": "Away"},
             "scores": {"home": 1, "away": 0}},
        ]
        result = scan_zero_zero_half_time(fixtures, profiles={})
        self.assertEqual([item["fixture_id"] for item in result], [1])

    def test_missing_profiles_never_qualify_a_market(self):
        fixture = {"id": 1, "status": "HT", "homeTeam": {"name": "Home"},
                   "awayTeam": {"name": "Away"}, "scores": {"home": 0, "away": 0}}
        result = scan_zero_zero_half_time([fixture], profiles={})[0]
        self.assertEqual(result["markets"]["home_or_draw_1x"]["status"], "NO_QUALIFICATION")
        self.assertEqual(result["markets"]["under_2_5"]["status"], "NO_QUALIFICATION")

    def test_under_25_requires_both_team_profiles_and_first_half_stats(self):
        fixture = {
            "id": 1, "status": "HT", "homeTeam": {"name": "Home"}, "awayTeam": {"name": "Away"},
            "scores": {"home": 0, "away": 0},
            "statistics": {"firstHalf": {
                "home": {"xg": 0.2, "shotsOnTarget": 1},
                "away": {"xg": 0.1, "shotsOnTarget": 1},
            }},
        }
        profiles = {
            "Home": {"matches": 12, "pre_match_favourite": "home", "home_non_loss_rate": 0.75,
                     "under_2_5_rate": 0.75, "avg_total_goals": 2.1},
            "Away": {"matches": 12, "under_2_5_rate": 0.70, "avg_total_goals": 2.2},
        }
        result = scan_zero_zero_half_time([fixture], profiles=profiles)[0]
        self.assertEqual(result["markets"]["under_2_5"]["status"], "QUALIFIES_FOR_REVIEW")
        self.assertEqual(result["markets"]["home_or_draw_1x"]["status"], "QUALIFIES_FOR_REVIEW")


if __name__ == "__main__":
    unittest.main()
