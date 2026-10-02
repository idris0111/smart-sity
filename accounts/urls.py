from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import ProfileView, PromoteUserView, RegisterView, LogoutView
 
urlpatterns = [
    path('register/', RegisterView.as_view()),
    path('promote/', PromoteUserView.as_view()),
    path('login/',TokenObtainPairView.as_view()),
    path('token/refresh/',TokenRefreshView.as_view()),
    path('logout/', LogoutView.as_view()),
    path('profile/', ProfileView.as_view()),
]