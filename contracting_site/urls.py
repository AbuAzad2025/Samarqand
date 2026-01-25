from coderedcms import search_urls as crx_search_urls
from coderedcms import urls as crx_urls
from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.shortcuts import redirect
from django.shortcuts import render
from django.urls import include
from django.urls import path
from django.urls import re_path
from wagtail.documents import urls as wagtaildocs_urls

from website import api_views


def spa_shell(request, *args, **kwargs):
    return render(request, "coderedcms/pages/spa_shell.html")


def cms_redirect(request, *args, **kwargs):
    return redirect("/control/dashboard", permanent=False)


urlpatterns = [
    # Admin
    path("django-admin/", admin.site.urls),
    re_path(r"^cms/.*$", cms_redirect),
    # Documents
    path("docs/", include(wagtaildocs_urls)),
    # Search
    path("search/", include(crx_search_urls)),
    path("api/ai/analyze-design", api_views.analyze_design),
    path("api/ai/generate-content", api_views.generate_content),
    path("api/ai/chat", api_views.chat),
    path("api/auth/access", api_views.auth_access),
    path("api/auth/login", api_views.auth_login),
    path("api/auth/me", api_views.auth_me),
    path("api/auth/logout", api_views.auth_logout),
    path("api/auth/change-password", api_views.auth_change_password),
    path("api/admin/users", api_views.admin_users),
    path("api/admin/summary", api_views.admin_summary),
    path("api/admin/settings/company", api_views.admin_company_settings),
    path("api/admin/settings/company/update", api_views.admin_company_settings_update),
    path("api/admin/settings/home", api_views.admin_home_settings),
    path("api/admin/settings/home/update", api_views.admin_home_settings_update),
    path("api/admin/settings/ai", api_views.admin_ai_settings),
    path("api/admin/settings/ai/update", api_views.admin_ai_settings_update),
    path("api/admin/settings/calculator", api_views.admin_calculator_settings),
    path("api/admin/settings/calculator/update", api_views.admin_calculator_settings_update),
    path("api/admin/settings/visibility", api_views.admin_visibility_settings),
    path("api/admin/settings/visibility/update", api_views.admin_visibility_settings_update),
    path("api/admin/team", api_views.admin_team),
    path("api/admin/team/create", api_views.admin_team_create),
    path("api/admin/team/reorder", api_views.admin_team_reorder),
    path("api/admin/team/<int:member_id>/update", api_views.admin_team_update),
    path("api/admin/team/<int:member_id>/delete", api_views.admin_team_delete),
    path("api/admin/testimonials", api_views.admin_testimonials),
    path("api/admin/testimonials/create", api_views.admin_testimonials_create),
    path("api/admin/testimonials/reorder", api_views.admin_testimonials_reorder),
    path("api/admin/testimonials/<int:item_id>/update", api_views.admin_testimonials_update),
    path("api/admin/testimonials/<int:item_id>/delete", api_views.admin_testimonials_delete),
    path("api/admin/home/trust-badges", api_views.admin_home_trust_badges),
    path("api/admin/home/trust-badges/create", api_views.admin_home_trust_badges_create),
    path("api/admin/home/trust-badges/reorder", api_views.admin_home_trust_badges_reorder),
    path("api/admin/home/trust-badges/<int:item_id>/update", api_views.admin_home_trust_badges_update),
    path("api/admin/home/trust-badges/<int:item_id>/delete", api_views.admin_home_trust_badges_delete),
    path("api/admin/home/stats", api_views.admin_home_stats),
    path("api/admin/home/stats/create", api_views.admin_home_stats_create),
    path("api/admin/home/stats/reorder", api_views.admin_home_stats_reorder),
    path("api/admin/home/stats/<int:item_id>/update", api_views.admin_home_stats_update),
    path("api/admin/home/stats/<int:item_id>/delete", api_views.admin_home_stats_delete),
    path("api/admin/home/timeline", api_views.admin_home_timeline),
    path("api/admin/home/timeline/create", api_views.admin_home_timeline_create),
    path("api/admin/home/timeline/reorder", api_views.admin_home_timeline_reorder),
    path("api/admin/home/timeline/<int:item_id>/update", api_views.admin_home_timeline_update),
    path("api/admin/home/timeline/<int:item_id>/delete", api_views.admin_home_timeline_delete),
    path("api/admin/home/ai-features", api_views.admin_home_ai_features),
    path("api/admin/home/ai-features/create", api_views.admin_home_ai_features_create),
    path("api/admin/home/ai-features/reorder", api_views.admin_home_ai_features_reorder),
    path("api/admin/home/ai-features/<int:item_id>/update", api_views.admin_home_ai_features_update),
    path("api/admin/home/ai-features/<int:item_id>/delete", api_views.admin_home_ai_features_delete),
    path("api/admin/home/ai-metrics", api_views.admin_home_ai_metrics),
    path("api/admin/home/ai-metrics/create", api_views.admin_home_ai_metrics_create),
    path("api/admin/home/ai-metrics/reorder", api_views.admin_home_ai_metrics_reorder),
    path("api/admin/home/ai-metrics/<int:item_id>/update", api_views.admin_home_ai_metrics_update),
    path("api/admin/home/ai-metrics/<int:item_id>/delete", api_views.admin_home_ai_metrics_delete),
    path("api/admin/pages/tree", api_views.admin_pages_tree),
    path("api/admin/pages/allowed-types", api_views.admin_pages_allowed_types),
    path("api/admin/pages/create", api_views.admin_page_create),
    path("api/admin/pages/<int:page_id>", api_views.admin_page_detail),
    path("api/admin/pages/<int:page_id>/update", api_views.admin_page_update),
    path("api/admin/pages/<int:page_id>/publish", api_views.admin_page_publish),
    path("api/admin/pages/<int:page_id>/unpublish", api_views.admin_page_unpublish),
    path("api/admin/pages/<int:page_id>/delete", api_views.admin_page_delete),
    path("api/admin/images/upload", api_views.admin_image_upload),
    path("api/admin/media/images", api_views.admin_media_images),
    path("api/admin/media/images/<int:image_id>/delete", api_views.admin_media_images_delete),
    path("api/admin/media/documents", api_views.admin_media_documents),
    path("api/admin/media/documents/upload", api_views.admin_media_documents_upload),
    path("api/admin/media/documents/<int:doc_id>/delete", api_views.admin_media_documents_delete),
    path("api/admin/backup/export", api_views.admin_backup_export),
    path("api/admin/backup/import", api_views.admin_backup_import),
    path("api/admin/services", api_views.admin_services),
    path("api/admin/services/create", api_views.admin_service_create),
    path("api/admin/services/<int:service_id>", api_views.admin_service_detail),
    path("api/admin/services/<int:service_id>/update", api_views.admin_service_update),
    path("api/admin/services/<int:service_id>/publish", api_views.admin_service_publish),
    path("api/admin/services/<int:service_id>/unpublish", api_views.admin_service_unpublish),
    path("api/admin/services/<int:service_id>/delete", api_views.admin_service_delete),
    path("api/admin/projects", api_views.admin_projects),
    path("api/admin/projects/create", api_views.admin_project_create),
    path("api/admin/projects/<int:project_id>", api_views.admin_project_detail),
    path("api/admin/projects/<int:project_id>/update", api_views.admin_project_update),
    path("api/admin/projects/<int:project_id>/publish", api_views.admin_project_publish),
    path("api/admin/projects/<int:project_id>/unpublish", api_views.admin_project_unpublish),
    path("api/admin/projects/<int:project_id>/delete", api_views.admin_project_delete),
    path("api/admin/projects/<int:project_id>/gallery/add", api_views.admin_project_gallery_add),
    path("api/admin/projects/<int:project_id>/gallery/<int:item_id>/remove", api_views.admin_project_gallery_remove),
    path("api/admin/articles", api_views.admin_articles),
    path("api/admin/articles/create", api_views.admin_article_create),
    path("api/admin/articles/<int:article_id>", api_views.admin_article_detail),
    path("api/admin/articles/<int:article_id>/update", api_views.admin_article_update),
    path("api/admin/articles/<int:article_id>/publish", api_views.admin_article_publish),
    path("api/admin/articles/<int:article_id>/unpublish", api_views.admin_article_unpublish),
    path("api/admin/articles/<int:article_id>/delete", api_views.admin_article_delete),
    path("api/admin/rfq/documents", api_views.admin_rfq_documents),
    path("api/admin/rfq/documents/create", api_views.admin_rfq_document_create),
    path("api/admin/rfq/documents/<int:doc_id>", api_views.admin_rfq_document_detail),
    path("api/admin/rfq/documents/<int:doc_id>/update", api_views.admin_rfq_document_update),
    path("api/admin/rfq/documents/<int:doc_id>/delete", api_views.admin_rfq_document_delete),
    path("api/admin/rfq/documents/<int:doc_id>/pdf", api_views.admin_rfq_document_pdf),
    path("api/calculator/calculate", api_views.calculate),
    path("api/images/generate-visualization", api_views.generate_visualization),
    path("api/site/company", api_views.site_company),
    path("api/site/config", api_views.site_config),
    path("api/site/home", api_views.site_home),
    path("api/site/services", api_views.site_services),
    path("api/site/projects", api_views.site_projects),
    path("api/site/team", api_views.site_team),
    path("api/site/testimonials", api_views.site_testimonials),
    path("api/site/home-sections", api_views.site_home_sections),
    path("@vite/client", lambda request: HttpResponse("", content_type="application/javascript")),
    path("admin/", spa_shell),
    path("services/", spa_shell),
    path("tools/", spa_shell),
    path("showcase/", spa_shell),
    path("request-quote/", spa_shell),
    path("", spa_shell),
    re_path(r"^(?!django-admin/|cms/|api/|docs/|search/|static/|media/).*$", spa_shell),
    path("", include(crx_urls)),
    # Alternatively, if you want pages to be served from a subpath
    # of your site, rather than the site root:
    #    path("pages/", include(crx_urls)),
]


# fmt: off
if settings.DEBUG:
    from django.conf.urls.static import static

    # Serve static and media files from development server
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)  # type: ignore
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)  # type: ignore
# fmt: on
