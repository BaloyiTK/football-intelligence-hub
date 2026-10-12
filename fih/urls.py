from django.urls import path
from fixtures.views import fixtures_today, launch_sandbox, sync_fixtures

urlpatterns = [
    path("fixtures/today/", fixtures_today),
    path("fixtures/sync/", sync_fixtures),
    path("api/cron/fixtures/", launch_sandbox),
]
