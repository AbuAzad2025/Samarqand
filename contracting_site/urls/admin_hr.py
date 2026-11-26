"""URL routes: admin_hr."""

from django.urls import path

from website import api as api_views


urlpatterns = [
    path('api/admin/hr/leave', api_views.admin_hr_leave_requests),
    path('api/admin/hr/leave/create', api_views.admin_hr_leave_requests_create),
    path('api/admin/hr/leave/<int:leave_id>/update', api_views.admin_hr_leave_requests_update),
    path('api/admin/hr/leave/<int:leave_id>/delete', api_views.admin_hr_leave_requests_delete),
    path('api/admin/hr/leave/<int:leave_id>/approve', api_views.admin_hr_leave_requests_approve),
    path('api/admin/hr/leave/<int:leave_id>/reject', api_views.admin_hr_leave_requests_reject),
    path('api/admin/hr/leave/balance/<int:worker_id>', api_views.admin_hr_leave_balance),
    path('api/admin/hr/contracts', api_views.admin_hr_contracts),
    path('api/admin/hr/contracts/create', api_views.admin_hr_contracts_create),
    path('api/admin/hr/contracts/<int:contract_id>/update', api_views.admin_hr_contracts_update),
    path('api/admin/hr/contracts/<int:contract_id>/delete', api_views.admin_hr_contracts_delete),
    path('api/admin/hr/overtime', api_views.admin_hr_overtime),
    path('api/admin/hr/overtime/create', api_views.admin_hr_overtime_create),
    path('api/admin/hr/overtime/<int:overtime_id>/update', api_views.admin_hr_overtime_update),
    path('api/admin/hr/overtime/<int:overtime_id>/delete', api_views.admin_hr_overtime_delete),
    path('api/admin/hr/overtime/<int:overtime_id>/approve', api_views.admin_hr_overtime_approve),
    path('api/admin/hr/social-security', api_views.admin_hr_social_security),
    path('api/admin/hr/social-security/create', api_views.admin_hr_social_security_create),
    path('api/admin/hr/social-security/<int:record_id>/update', api_views.admin_hr_social_security_update),
    path('api/admin/hr/social-security/<int:record_id>/delete', api_views.admin_hr_social_security_delete),
    path('api/admin/hr/social-security/<int:record_id>/mark-paid', api_views.admin_hr_social_security_mark_paid),
]
