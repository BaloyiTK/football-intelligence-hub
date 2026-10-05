# Fixture Discovery Rules

- ChatGPT public-web research is the primary fixture-discovery layer; football-data.org, API-Football, Tavily or any single API/provider are not required.
- For a daily run, resolve the requested run date in Africa/Johannesburg. For historical/backtest work, use the explicitly requested calendar date and normalize fixture timezone/date boundaries before mapping.
- Discover the date's worldwide senior-football fixture universe first using at least TWO independent global date-indexed fixture sources.
- Freeze the `data/leagues.json` registry snapshot at run start and map verified fixtures against every configured competition in that snapshot.
- Worldwide discovery is broader than the registry: legitimate senior competitions found outside the snapshot must be recorded as coverage-gap candidates for verification/later registry inclusion, not silently discarded and not automatically modelled unless configured.
- The daily prediction feed is PRE-MATCH ONLY: exclude started, live, completed, abandoned and cancelled fixtures.
- Re-check kickoff/status before freezing or publishing because a match may start while a long scan is running.
- Normalize country, competition and team aliases; generic names such as Premier League or Serie A must be country-disambiguated.
- Youth, academy, reserve/U21/U23, women's competitions and club friendlies must not be silently mapped into men's senior configured competitions. Women's competitions require explicit distinct configuration.
- Prefer official competition/association/club sources and reputable fixture/statistics sources for targeted verification.
- Cross-check ambiguous fixtures, dates, status, classification and timezone; resolve source disagreements before modelling.
- Persist the global discovery sources and every mapped fixture before modelling.
- When both global sources agree a configured competition has zero fixtures, record a verified zero-fixture checkpoint from that date-level discovery. Absence from one provider is insufficient.
- Use targeted league/official searches only for disagreements, ambiguous mappings, missing source coverage or suspicious fixtures.
- Never create a fixture merely because a search snippet suggests one.
