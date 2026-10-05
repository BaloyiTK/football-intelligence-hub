# Deterministic Model Rules — V2.3.1 Supported Selector

V2.3.1 keeps the normalized Dixon-Coles score engine and reliability adjustment, and adds mandatory support-gating for safer derivative picks.

## Core
- Separate attack/defence strengths and league home/away baselines.
- 65/35 stable/recent blend where both exist.
- Lambda clamp 0.2–4.0; rho default -0.08; normalized 0–8 score grid.
- Evidence factor: Full 1.00, Standard 0.96, Basic 0.90; sample factor 8+ 1.00, 5–7 0.97, 3–4 0.92, 1–2 0.84.

## Approved prediction markets
FIH may recommend only:
- 1X2: Home / Draw / Away
- Total Goals: Over 1.5
- Double Chance: 1X / X2

The model must also calculate the supporting probabilities needed to justify safer picks:
- Over 2.5 supports Over 1.5
- Home win supports 1X
- Away win supports X2

## Support-gated recommendation rules
A safer derivative pick is eligible only when BOTH the safer line and the underlying harder signal are strong enough.

- Over 1.5:
  - Over 1.5 raw >=72
  - Over 2.5 raw >=68
  - adjusted Over 1.5 >=68
- 1X:
  - 1X raw >=72
  - Home win raw >=62
  - adjusted 1X >=68
- X2:
  - X2 raw >=72
  - Away win raw >=62
  - adjusted X2 >=68
- Direct 1X2:
  - Home / Draw / Away raw >=62
  - adjusted probability >=68

Rank eligible candidates by reliability-adjusted probability. Recommend at most one; otherwise NO BET.

Store rawProbability, reliability, adjusted probability and the support signal for derivative picks.

Rating: Elite >=85, Strong >=75, Good >=68.

## Principle
A high-probability safer market is not enough by itself. The underlying harder outcome must also be strong. Do not use the draw or the lower goal line to manufacture confidence.

## NO BET
NO BET and NO MODEL remain audit decisions and are excluded from recommendation performance metrics.
