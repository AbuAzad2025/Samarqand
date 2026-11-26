"""URL routes: site."""

from django.urls import path

from website import api as api_views


urlpatterns = [
    path('api/calculator/calculate', api_views.calculate),
    path('api/images/generate-visualization', api_views.generate_visualization),
    path('api/site/company', api_views.site_company),
    path('api/site/config', api_views.site_config),
    path('api/site/home', api_views.site_home),
    path('api/site/services', api_views.site_services),
    path('api/site/projects', api_views.site_projects),
    path('api/site/team', api_views.site_team),
    path('api/site/testimonials', api_views.site_testimonials),
    path('api/site/home-sections', api_views.site_home_sections),
]
