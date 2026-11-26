"""URL routes: vite."""

from django.http import HttpResponse
from django.urls import path

urlpatterns = [
    path(
        "@vite/client",
        lambda request: HttpResponse("", content_type="application/javascript"),
    ),
]
