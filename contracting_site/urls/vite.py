"""URL routes: vite."""

from django.http import HttpResponse
from django.urls import path
from django.views.decorators.http import require_GET


@require_GET
def vite_client(request):
    return HttpResponse("", content_type="application/javascript")


urlpatterns = [
    path("@vite/client", vite_client, name="vite_client"),
]
