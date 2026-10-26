from django.contrib import admin
from django.urls import include, path

from offers.views import health

urlpatterns = [
    path('health/', health, name='health'),
    path('admin/', admin.site.urls),
    path('api/', include('offers.urls')),
]
