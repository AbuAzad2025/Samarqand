"""URL routes: admin_fleet."""

from django.urls import path

from website import api as api_views


urlpatterns = [
    path('api/admin/fleet/vehicles', api_views.admin_fleet_vehicles),
    path('api/admin/fleet/vehicles/create', api_views.admin_fleet_vehicles_create),
    path('api/admin/fleet/vehicles/<int:vehicle_id>/update', api_views.admin_fleet_vehicles_update),
    path('api/admin/fleet/vehicles/<int:vehicle_id>/delete', api_views.admin_fleet_vehicles_delete),
    path('api/admin/fleet/fuel-logs', api_views.admin_fleet_fuel_logs),
    path('api/admin/fleet/fuel-logs/create', api_views.admin_fleet_fuel_logs_create),
    path('api/admin/fleet/fuel-logs/<int:log_id>/update', api_views.admin_fleet_fuel_logs_update),
    path('api/admin/fleet/fuel-logs/<int:log_id>/delete', api_views.admin_fleet_fuel_logs_delete),
    path('api/admin/fleet/maintenance', api_views.admin_fleet_maintenance),
    path('api/admin/fleet/maintenance/create', api_views.admin_fleet_maintenance_create),
    path('api/admin/fleet/maintenance/<int:record_id>/update', api_views.admin_fleet_maintenance_update),
    path('api/admin/fleet/maintenance/<int:record_id>/delete', api_views.admin_fleet_maintenance_delete),
]
