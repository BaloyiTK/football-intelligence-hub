# Deterministic Model Rules

Web research gathers evidence. The numerical engine produces probabilities. Never invent probability values.

## Model levels

### Full
When venue splits and league baselines exist:
- homeAttack = homeVenueGF / leagueHomeAvg
- awayDefence = awayVenueGA / leagueHomeAvg
- awayAttack = awayVenueGF / leagueAwayAvg
- homeDefence = homeVenueGA / leagueAwayAvg
- lambdaHome = leagueHomeAvg * homeAttack * awayDefence
- lambdaAway = leagueAwayAvg * awayAttack * homeDefence
Use researched recent/xG evidence only through deterministic blending implemented by the project.

### Standard
When some Full inputs are missing, derive lambda from verified recent GF/GA for both teams, using venue splits when available and league baselines when available. Do not replace missing fields with zero. Weight better/venue-specific samples more heavily than generic samples.

### Basic
When only reliable recent match results are available:
- homeGF = home recent goals scored per match
- homeGA = home recent goals conceded per match
- awayGF = away recent goals scored per match
- awayGA = away recent goals conceded per match
- lambdaHome = (homeGF + awayGA) / 2
- lambdaAway = (awayGF + homeGA) / 2
Use preferably 5-10 completed matches per team. Clamp lambda to the project's safe range (minimum 0.2, maximum 4.0).

Basic is a legitimate model with lower data confidence; it is preferable to No Model when its inputs are reliable.

## Poisson
P(k; lambda) = exp(-lambda) * lambda^k / k!
Build a score matrix at least 0..7.

Derive from the same matrix:
- Home / Draw / Away
- 1X / X2 / 12
- BTTS
- Over 1.5 / 2.5 / 3.5
- Home 2+ / Away 2+
- primary correct score = highest-probability cell
- at least 3 alternative correct scores sorted by probability

## Confidence
Store both modelLevel (full | standard | basic) and confidence (high | medium | low). Confidence describes evidence/model quality, NOT the chance that the predicted score will be correct.

Full normally begins high/medium, Standard medium, and Basic low. Adjust downward for small samples, stale data, source disagreement or missing context. Never increase confidence merely because one Poisson cell has a high probability.

Three P's, Heat and Floors may be added as deterministic layers without replacing the base Poisson outputs.
