# Deterministic Model Rules

AI/web research gathers evidence. The numerical engine produces probabilities. AI must not invent probability values.

## Expected goals
Normalize researched scoring/conceding inputs against league scoring baselines where available:
- homeAttack = homeVenueGF / leagueHomeAvg
- awayDefence = awayVenueGA / leagueHomeAvg
- awayAttack = awayVenueGF / leagueAwayAvg
- homeDefence = homeVenueGA / leagueAwayAvg
- lambdaHome = leagueHomeAvg * homeAttack * awayDefence
- lambdaAway = leagueAwayAvg * awayAttack * homeDefence

Blend recent overall evidence only according to the project's deterministic implementation. Clamp unstable/extreme lambda inputs as implemented by the model.

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
Confidence means data/model confidence, not guaranteed prediction accuracy. It should reflect completeness, sample size, recency, source agreement and model concentration.

Three P's, Heat and Floors may be added as deterministic layers without replacing the base Poisson outputs.
