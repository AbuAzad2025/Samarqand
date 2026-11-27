"""URL routes: admin leads (website enquiries)."""

from django.urls import path

from website import api as api_views

urlpatterns = [
    path("api/admin/leads", api_views.admin_leads),
    path("api/admin/leads/assignees", api_views.admin_leads_assignees),
    path(
        "api/admin/leads/<int:lead_id>/update",
        api_views.admin_leads_update,
    ),
]
