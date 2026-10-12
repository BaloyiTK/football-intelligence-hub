from django.http import JsonResponse
from django.views.decorators.http import require_POST

from .github_sync import commit_fixtures
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
