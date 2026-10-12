import asyncio
import os

from vercel import sandbox
from vercel.sandbox import GitSource, NetworkPolicy

REPO_URL = "https://github.com/BaloyiTK/football-intelligence-hub.git"


async def _run():
    required = ("ls_api_url", "ls_api_key", "FIH_GITHUB_TOKEN")
    missing = [key for key in required if not os.environ.get(key)]
    if missing:
        raise RuntimeError(f"Missing Vercel project environment variables: {', '.join(missing)}")

    env = {key: os.environ[key] for key in required}

    async with sandbox.create_sandbox(
        source=GitSource(url=REPO_URL, revision="main", depth=1),
        persistent=False,
        execution_time_limit=900,
        network_policy=NetworkPolicy.allow_all(),
        env=env,
        region="cpt1",
    ) as box:
        install = await box.run_process(
            "python",
            ["-m", "pip", "install", "-r", "requirements.txt"],
            capture_output=True,
        )
        if install.returncode != 0:
            raise RuntimeError(f"Sandbox dependency install failed: {install.stderr[-1500:]}")

        result = await box.run_process(
            "python",
            ["sandbox_worker.py"],
            capture_output=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"Sandbox worker failed: {result.stderr[-1500:]}")

        marker = next(
            (line for line in result.stdout.splitlines() if line.startswith("FIH_SANDBOX_OK ")),
            None,
        )
        if not marker:
            raise RuntimeError("Sandbox worker completed without success marker")
        return marker


def launch_fixture_sandbox():
    return asyncio.run(_run())
