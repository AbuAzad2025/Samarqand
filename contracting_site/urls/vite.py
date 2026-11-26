"""URL routes: vite."""

from django.http import HttpResponse
from django.urls import path

from website import api as api_views


urlpatterns = [
    path('@vite/client', lambda request: HttpResponse('', content_type='application/javascript')),
]
