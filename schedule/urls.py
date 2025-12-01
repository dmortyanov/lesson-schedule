from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/", include("core.urls")),
    # Frontend pages
    path("", TemplateView.as_view(template_name="login.html"), name="login"),
    path("dashboard/", TemplateView.as_view(template_name="dashboard.html"), name="dashboard"),
    # Legacy API demo page
    path("api-demo/", TemplateView.as_view(template_name="index.html"), name="api_demo"),
]

