"""URL routes: admin_ops."""

from django.urls import path

from website import api as api_views

urlpatterns = [
    path("api/admin/ops/clients", api_views.admin_ops_clients),
    path("api/admin/ops/clients/create", api_views.admin_ops_clients_create),
    path(
        "api/admin/ops/clients/<int:client_id>/update",
        api_views.admin_ops_clients_update,
    ),
    path(
        "api/admin/ops/clients/<int:client_id>/delete",
        api_views.admin_ops_clients_delete,
    ),
    path(
        "api/admin/ops/clients/<int:client_id>/contacts",
        api_views.admin_ops_client_contacts,
    ),
    path(
        "api/admin/ops/clients/<int:client_id>/contacts/create",
        api_views.admin_ops_client_contacts_create,
    ),
    path("api/admin/ops/suppliers", api_views.admin_ops_suppliers),
    path(
        "api/admin/ops/suppliers/create", api_views.admin_ops_suppliers_create
    ),
    path(
        "api/admin/ops/suppliers/<int:supplier_id>/update",
        api_views.admin_ops_suppliers_update,
    ),
    path(
        "api/admin/ops/suppliers/<int:supplier_id>/delete",
        api_views.admin_ops_suppliers_delete,
    ),
    path("api/admin/ops/subcontractors", api_views.admin_ops_subcontractors),
    path(
        "api/admin/ops/subcontractors/create",
        api_views.admin_ops_subcontractors_create,
    ),
    path(
        "api/admin/ops/subcontractors/<int:subcontractor_id>/update",
        api_views.admin_ops_subcontractors_update,
    ),
    path(
        "api/admin/ops/subcontractors/<int:subcontractor_id>/delete",
        api_views.admin_ops_subcontractors_delete,
    ),
    path("api/admin/ops/contracts", api_views.admin_ops_contracts),
    path(
        "api/admin/ops/contracts/create", api_views.admin_ops_contracts_create
    ),
    path(
        "api/admin/ops/contracts/<int:contract_id>/update",
        api_views.admin_ops_contracts_update,
    ),
    path(
        "api/admin/ops/contracts/<int:contract_id>/delete",
        api_views.admin_ops_contracts_delete,
    ),
    path(
        "api/admin/ops/contracts/<int:contract_id>/addendums",
        api_views.admin_ops_contract_addendums,
    ),
    path(
        "api/admin/ops/contracts/<int:contract_id>/addendums/create",
        api_views.admin_ops_contract_addendums_create,
    ),
    path(
        "api/admin/ops/contracts/<int:contract_id>/payments",
        api_views.admin_ops_contract_payments,
    ),
    path(
        "api/admin/ops/contracts/<int:contract_id>/payments/create",
        api_views.admin_ops_contract_payments_create,
    ),
    path(
        "api/admin/ops/contract-payments/<int:payment_id>/update",
        api_views.admin_ops_contract_payments_update,
    ),
    path(
        "api/admin/ops/contract-payments/<int:payment_id>/delete",
        api_views.admin_ops_contract_payments_delete,
    ),
    path("api/admin/ops/purchase-orders", api_views.admin_ops_purchase_orders),
    path(
        "api/admin/ops/purchase-orders/create",
        api_views.admin_ops_purchase_orders_create,
    ),
    path(
        "api/admin/ops/purchase-orders/<int:purchase_order_id>/update",
        api_views.admin_ops_purchase_orders_update,
    ),
    path(
        "api/admin/ops/purchase-orders/<int:purchase_order_id>/delete",
        api_views.admin_ops_purchase_orders_delete,
    ),
    path("api/admin/ops/inventory/items", api_views.admin_ops_inventory_items),
    path(
        "api/admin/ops/inventory/items/create",
        api_views.admin_ops_inventory_items_create,
    ),
    path(
        "api/admin/ops/inventory/items/<int:item_id>/update",
        api_views.admin_ops_inventory_items_update,
    ),
    path(
        "api/admin/ops/inventory/items/<int:item_id>/delete",
        api_views.admin_ops_inventory_items_delete,
    ),
    path(
        "api/admin/ops/inventory/transactions",
        api_views.admin_ops_inventory_transactions,
    ),
    path(
        "api/admin/ops/inventory/transactions/create",
        api_views.admin_ops_inventory_transactions_create,
    ),
    path("api/admin/ops/workers", api_views.admin_ops_workers),
    path("api/admin/ops/workers/create", api_views.admin_ops_workers_create),
    path(
        "api/admin/ops/workers/<int:worker_id>/update",
        api_views.admin_ops_workers_update,
    ),
    path(
        "api/admin/ops/workers/<int:worker_id>/delete",
        api_views.admin_ops_workers_delete,
    ),
    path("api/admin/ops/attendance", api_views.admin_ops_attendance),
    path(
        "api/admin/ops/attendance/create", api_views.admin_ops_attendance_create
    ),
    path(
        "api/admin/ops/timeclock/import", api_views.admin_ops_timeclock_import
    ),
    path(
        "api/admin/ops/timeclock/import-from-folder",
        api_views.admin_ops_timeclock_import_from_folder,
    ),
    path("api/admin/ops/timeclock/runs", api_views.admin_ops_timeclock_runs),
    path("api/admin/ops/audit-logs", api_views.admin_ops_audit_logs),
    path(
        "api/admin/ops/permission-rules", api_views.admin_ops_permission_rules
    ),
    path(
        "api/admin/ops/permission-rules/update",
        api_views.admin_ops_permission_rules_update,
    ),
    path(
        "api/admin/ops/attendance/<int:item_id>/update",
        api_views.admin_ops_attendance_update,
    ),
    path(
        "api/admin/ops/attendance/<int:item_id>/delete",
        api_views.admin_ops_attendance_delete,
    ),
    path(
        "api/admin/ops/attendance/<int:item_id>/submit",
        api_views.admin_ops_attendance_submit,
    ),
    path(
        "api/admin/ops/attendance/<int:item_id>/approve",
        api_views.admin_ops_attendance_approve,
    ),
    path(
        "api/admin/ops/attendance/<int:item_id>/lock",
        api_views.admin_ops_attendance_lock,
    ),
    path("api/admin/ops/payroll", api_views.admin_ops_payroll),
    path(
        "api/admin/ops/payroll/generate-from-attendance",
        api_views.admin_ops_payroll_generate_from_attendance,
    ),
    path("api/admin/ops/payroll/create", api_views.admin_ops_payroll_create),
    path(
        "api/admin/ops/payroll/<int:entry_id>/update",
        api_views.admin_ops_payroll_update,
    ),
    path(
        "api/admin/ops/payroll/<int:entry_id>/delete",
        api_views.admin_ops_payroll_delete,
    ),
    path("api/admin/ops/equipment", api_views.admin_ops_equipment),
    path(
        "api/admin/ops/equipment/create", api_views.admin_ops_equipment_create
    ),
    path(
        "api/admin/ops/equipment/<int:equipment_id>/update",
        api_views.admin_ops_equipment_update,
    ),
    path(
        "api/admin/ops/equipment/<int:equipment_id>/delete",
        api_views.admin_ops_equipment_delete,
    ),
    path("api/admin/ops/assignments", api_views.admin_ops_assignments),
    path(
        "api/admin/ops/assignments/create",
        api_views.admin_ops_assignments_create,
    ),
    path(
        "api/admin/ops/assignments/<int:assignment_id>/update",
        api_views.admin_ops_assignments_update,
    ),
    path(
        "api/admin/ops/assignments/<int:assignment_id>/delete",
        api_views.admin_ops_assignments_delete,
    ),
    path("api/admin/kpi/projects", api_views.admin_kpi_projects),
]
