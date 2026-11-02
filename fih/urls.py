from django.urls import path
from fixtures.views import fixtures_today, launch_sandbox, sync_fixtures
from fixtures.half_time_scanner_views import half_time_scanner_api, half_time_scanner_page

urlpatterns = [
    path("fixtures/today/", fixtures_today),
    path("fixtures/sync/", sync_fixtures),
    path("api/cron/fixtures/", launch_sandbox),
    path("api/half-time-scanner/", half_time_scanner_api),
    path("scanner/half-time/", half_time_scanner_page),
]
