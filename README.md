# Football Intelligence Hub

Football fixture acquisition, ChatGPT-owned source-backed research, and deterministic probability analysis.

## Pipeline

Step 1: Vercel + LiveScore fixture acquisition -> GitHub persistence/verification.

Step 2: ChatGPT consumes the frozen fixture queue, bulk-researches reusable competition/team/team-pair evidence, assembles and independently validates each fixture, then runs targeted gap repair only where needed -> validated working accumulator -> one canonical research commit after N/N.

Step 3+: normalized team evidence -> FIH model -> probabilities -> decisions/predictions.

Vercel is not a Step-2 research engine. Vercel AI Gateway and repository-hosted language-model research workers are forbidden substitutes for ChatGPT Step-2 web research.
