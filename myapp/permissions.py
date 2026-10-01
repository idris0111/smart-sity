from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self,request,view):
        if not request.user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            return True

        return request.user.is_staff


class IsOwnerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self,request,view,obj):
        if request.user.is_staff:
            return True

        if hasattr(obj,'user'):
            return obj.user == request.user

        if hasattr(obj,'created_by'):
            return obj.created_by == request.user

        return False
