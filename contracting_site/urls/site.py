"""URL routes: public site API (GET only, except the leads endpoint)."""

from django.urls import path
from django.views.decorators.http import require_GET

from website import api as api_views

# Public read endpoints must never accept writes via a loose method match.
site_company = require_GET(api_views.site_company)
site_config = require_GET(api_views.site_config)
site_home = require_GET(api_views.site_home)
site_content = require_GET(api_views.site_content)
site_services = require_GET(api_views.site_services)
site_projects = require_GET(api_views.site_projects)
site_team = require_GET(api_views.site_team)
site_testimonials = require_GET(api_views.site_testimonials)
site_home_sections = require_GET(api_views.site_home_sections)
site_content_list = require_GET(api_views.site_content_list)
site_content_detail = require_GET(api_views.site_content_detail)

urlpatterns = [
    path(
        "api/calculator/calculate",
        api_views.calculate,
        name="api_calculator_calculate",
    ),
    path(
        "api/images/generate-visualization",
        api_views.generate_visualization,
        name="api_images_generate_visualization",
    ),
    path("api/site/leads", api_views.site_leads_create, name="api_site_leads"),
    path("api/site/company", site_company, name="api_site_company"),
    path("api/site/config", site_config, name="api_site_config"),
    path("api/site/home", site_home, name="api_site_home"),
    path("api/site/content", site_content, name="api_site_content"),
    path("api/site/services", site_services, name="api_site_services"),
    path("api/site/projects", site_projects, name="api_site_projects"),
    path("api/site/team", site_team, name="api_site_team"),
    path(
        "api/site/testimonials", site_testimonials, name="api_site_testimonials"
    ),
    path(
        "api/site/home-sections",
        site_home_sections,
        name="api_site_home_sections",
    ),
    path(
        "api/site/<str:kind>", site_content_list, name="api_site_content_list"
    ),
    path(
        "api/site/<str:kind>/<str:slug>",
        site_content_detail,
        name="api_site_content_detail",
    ),
]
