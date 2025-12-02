from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import (
    DepartmentViewSet, GroupViewSet, TeacherViewSet, StudentViewSet,
    DisciplineViewSet, RoomViewSet, LessonViewSet, CurrentUserView, RegisterView,
    TeacherDisciplinesView, TeacherGroupsView
)

router = DefaultRouter()
router.register(r"departments", DepartmentViewSet)
router.register(r"groups", GroupViewSet)
router.register(r"teachers", TeacherViewSet)
router.register(r"students", StudentViewSet)
router.register(r"disciplines", DisciplineViewSet)
router.register(r"rooms", RoomViewSet)
router.register(r"lessons", LessonViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("auth/me/", CurrentUserView.as_view(), name="current_user"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("teacher/disciplines/", TeacherDisciplinesView.as_view(), name="teacher_disciplines"),
    path("teacher/groups/", TeacherGroupsView.as_view(), name="teacher_groups"),
]

