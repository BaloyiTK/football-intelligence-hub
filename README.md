# Football Intelligence Hub

Autonomous football research + deterministic probability engine.

## Pipeline
Scheduled fixture discovery → AI/web research → normalized team stats → λ → Poisson → 1X2/BTTS/O-U/2+ → confidence ranking → persisted report.

The current MVP ships the calculation engine and UI with demo normalized inputs. The research adapter and persistent store are intentionally separate so live web/search providers can be connected without changing the model or frontend.

## Run
npm install
npm run dev
