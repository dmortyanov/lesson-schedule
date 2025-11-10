from rest_framework.permissions import BasePermission, SAFE_METHODS
from .models import Lesson, Teacher


class IsAdminDB(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated and request.user.groups.filter(name="ADMIN_DB").exists())


class IsTeacher(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated and request.user.groups.filter(name="TEACHER").exists())


class LessonPermission(BasePermission):
    """
    Implements matrix:
      - Admin: full access
      - Teacher: R for all, W only own lessons
      - Student: R
    """

    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return request.user.is_authenticated
        if IsAdminDB().has_permission(request, view):
            return True
        # teachers can modify via object-level check
        return IsTeacher().has_permission(request, view)

    def has_object_permission(self, request, view, obj: Lesson) -> bool:
        if request.method in SAFE_METHODS:
            return True
        if IsAdminDB().has_permission(request, view):
            return True
        if IsTeacher().has_permission(request, view):
            try:
                teacher: Teacher = request.user.teacher  # type: ignore[attr-defined]
            except Teacher.DoesNotExist:
                return False
            return obj.teacher_id == teacher.id
        return False

