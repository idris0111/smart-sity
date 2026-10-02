
from django.contrib import admin
from django.urls import include, path, re_path
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

schema_view = get_schema_view(
    openapi.Info(
        title="Smart City API",
        default_version='v1',
        description="Smart City: аккаунт, парковки, транспорт и обращения",
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)
urlpatterns = [
    re_path(
        r'^swagger/$',
        schema_view.with_ui('swagger', cache_timeout=0),
        name='schema-swagger-ui'
    ),

    re_path(
        r'^redoc/$',
        schema_view.with_ui('redoc', cache_timeout=0),
        name='schema-redoc'
    ),
]

urlpatterns += [
    path('admin/', admin.site.urls),
    path('account/', include('accounts.urls')),
    path('auth/', include('accounts.urls')),
    path('api/', include('myapp.urls')),
]
