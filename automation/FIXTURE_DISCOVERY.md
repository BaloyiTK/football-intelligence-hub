# Fixture Discovery Rules

- Use public web research; football-data.org, API-Football and Tavily are not required.
- Process every competition in `data/leagues.json`.
- Search specifically for fixtures on today's Africa/Johannesburg calendar date.
- Use competition aliases where naming differs between sources (example: Segunda Division / LaLiga 2).
- Prefer official competition/club sources and reputable fixture/statistics sources.
- Cross-check ambiguous fixtures, dates, postponed/cancelled status and timezone.
- Collect ALL verified fixtures for the league before moving on.
- Never create a fixture merely because a search snippet suggests one.
- Record zero-fixture leagues as checked.
