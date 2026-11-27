"""URL routes: ai."""

from django.urls import path

from website import api as api_views

urlpatterns = [
    path(
        "api/ai/analyze-design",
        api_views.analyze_design,
        name="api_ai_analyze_design",
    ),
    path(
        "api/ai/generate-content",
        api_views.generate_content,
        name="api_ai_generate_content",
    ),
    path("api/ai/chat", api_views.chat, name="api_ai_chat"),
]
