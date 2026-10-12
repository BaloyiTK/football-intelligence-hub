import os

from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from .github_sync import commit_fixtures
from .sandbox_launcher import launch_fixture_sandbox
from .services import fetch_fixtures


def fixtures_today(request):
    try:
        fixtures = fetch_fixtures()
        return JsonResponse({"count": len(fixtures), "fixtures": fixtures})
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=502)


@require_POST
def sync_fixtures(request):
    try:
        fixtures = fetch_fixtures()
        result = commit_fixtures(fixtures)
        return JsonResponse({"count": len(fixtures), **result})
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=502)


@require_GET
def launch_sandbox(request):
    cron_secret = os.environ.get("CRON_SECRET")
    if cron_secret and request.headers.get("Authorization") != f"Bearer {cron_secret}":
        return JsonResponse({"error": "unauthorized"}, status=401)

    try:
        marker = launch_fixture_sandbox()
        return JsonResponse({"ok": True, "worker": marker})
    except Exception as exc:
        return JsonResponse({"ok": False, "error": str(exc)}, status=502)
