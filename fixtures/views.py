from django.http import JsonResponse
from .services import fetch_fixtures

def fixtures_today(request):
    try:
        fixtures=fetch_fixtures()
        return JsonResponse({"count":len(fixtures),"fixtures":fixtures})
    except Exception as exc:
        return JsonResponse({"error":str(exc)},status=502)
