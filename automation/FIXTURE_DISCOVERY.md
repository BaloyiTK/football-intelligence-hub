# Fixture Discovery Rules

- Use public web research; football-data.org, API-Football and Tavily are not required.
- Process every competition in `data/leagues.json`.
- Search specifically for fixtures on today's Africa/Johannesburg calendar date.
- The prediction feed is PRE-MATCH ONLY: exclude started, live, completed, abandoned and cancelled fixtures.
- Re-check kickoff/status before saving because a match may start while a long scan is running.
- Use competition aliases where naming differs between sources.
- Prefer official competition/club sources and reputable fixture/statistics sources.
- Cross-check ambiguous fixtures, dates, status and timezone.
- Collect ALL verified upcoming fixtures for the league before moving on.
- Never create a fixture merely because a search snippet suggests one.
- Record zero-upcoming-fixture leagues as checked.
