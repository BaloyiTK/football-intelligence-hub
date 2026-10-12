from django.urls import path
from fixtures.views import fixtures_today
urlpatterns=[path("fixtures/today/", fixtures_today)]
