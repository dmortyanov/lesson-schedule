from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import DepartmentViewSet, GroupViewSet, TeacherViewSet, StudentViewSet, DisciplineViewSet, RoomViewSet, LessonViewSet

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
]

