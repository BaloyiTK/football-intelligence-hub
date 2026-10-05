# Match Research Rules

Research every verified upcoming fixture. The goal is to produce the strongest defensible pre-match model possible from public evidence, not to require premium statistics before modelling.

## Market scope
Research must support the authoritative FIH recommendation scope in `MODEL_RULES.md`: 1X2, Over 1.5 with Over 2.5 support, and Double Chance 1X/X2 with Home/Away win support.

Research inputs such as goals, xG, form, venue splits, table context, H2H and team news must support both the primary recommendation and any required underlying support signal.

## Research targets
Collect where available:
- recent 5-10 results and goals for/against
- home team's home form
- away team's away form
- league position/table context
- head-to-head
- xG/xGA
- shots and shots on target
- clean-sheet rate
- BTTS and totals history
- injuries, suspensions and relevant team news
- current context such as rotation/congestion

Use multiple useful public sources where practical. Preserve source title/URL and research timestamp. Prefer official competition/club sources and reputable statistical sources.

Never fabricate a missing statistic. Missing xG, injuries, odds, shots or another field is null/unknown, never zero.

## Mandatory fallback hierarchy
For every upcoming verified fixture, attempt these levels in order:

### Level A — Full
Use venue-specific scoring/conceding form, recent form, league scoring baselines and additional evidence such as xG/xGA, shots, table context, H2H and team news when available.

### Level B — Standard
If premium metrics are unavailable, use recent goals scored/conceded for both teams, home/away form where available, league/table context and league scoring baseline where available.

### Level C — Basic
If venue splits or league baselines are unavailable, use each team's recent 5-10 completed matches and actual goals scored/conceded to derive conservative expected-goal inputs. Missing premium statistics MUST NOT by itself prevent a prediction.

### No Model — last resort only
Use No Model only when reliable recent scoring/conceding evidence cannot be obtained for one or both teams, the fixture itself cannot be verified, or the match has already started/finished before research is completed. Record the exact reason.

The agent must try Full, then Standard, then Basic before choosing No Model.
