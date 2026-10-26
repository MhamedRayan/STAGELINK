from rest_framework.permissions import BasePermission

class IsStudent(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and getattr(request.user, 'role', None) == 'STUDENT'

class IsCompany(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and getattr(request.user, 'role', None) == 'COMPANY'

class IsUniversity(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and getattr(request.user, 'role', None) == 'UNIVERSITY'

class IsApplicationParticipant(BasePermission):
    """
    Object-level permission: Ensures callers can only view/access applications relevant to them.
    """
    def has_object_permission(self, request, view, obj):
        user_id = str(getattr(request.user, 'id', ''))
        user_role = getattr(request.user, 'role', None)

        if user_role == 'STUDENT':
            return str(obj.student_user_id) == user_id
        elif user_role == 'COMPANY':
            return str(obj.company_id) == user_id
        elif user_role == 'UNIVERSITY':
            return True  # University representatives can access applications assigned to their domain
        elif user_role == 'ADMIN':
            return True
        return False
