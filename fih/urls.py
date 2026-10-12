from django.urls import path
from fixtures.views import fixtures_today, sync_fixtures

urlpatterns = [
    path("fixtures/today/", fixtures_today),
    path("fixtures/sync/", sync_fixtures),
]
