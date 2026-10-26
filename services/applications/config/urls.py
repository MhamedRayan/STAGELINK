from django.contrib import admin
from django.urls import path, include

from applications.views import health

urlpatterns = [
    path('health/', health, name='health'),
    path('admin/', admin.site.urls),
    path('api/', include('applications.urls')),
]
