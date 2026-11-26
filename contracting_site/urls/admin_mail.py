"""URL routes: admin_mail."""

from django.urls import path

from website import api as api_views


urlpatterns = [
    path('api/admin/mail/folders', api_views.admin_mail_folders),
    path('api/admin/mail/messages', api_views.admin_mail_messages),
    path('api/admin/mail/messages/<int:msg_id>', api_views.admin_mail_message_detail),
    path('api/admin/mail/messages/send', api_views.admin_mail_messages_send),
    path('api/admin/mail/messages/<int:msg_id>/update', api_views.admin_mail_messages_update),
    path('api/admin/mail/messages/<int:msg_id>/delete', api_views.admin_mail_messages_delete),
    path('api/admin/mail/messages/<int:msg_id>/hard-delete', api_views.admin_mail_messages_hard_delete),
    path('api/admin/mail/messages/<int:msg_id>/star', api_views.admin_mail_messages_star),
    path('api/admin/mail/messages/<int:msg_id>/read', api_views.admin_mail_messages_read),
    path('api/admin/mail/messages/<int:msg_id>/unread', api_views.admin_mail_messages_unread),
    path('api/admin/mail/messages/<int:msg_id>/move', api_views.admin_mail_messages_move),
    path('api/admin/mail/users', api_views.admin_mail_users),
    path('api/admin/mail/attachments/upload', api_views.admin_mail_attachments_upload),
]
