from datetime import datetime
from django.db.models import Q, Exists, OuterRef
from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import Department, GroupModel, Teacher, Student, Discipline, Room, Lesson
from .serializers import (
    DepartmentSerializer,
    GroupSerializer,
    TeacherSerializer,
    StudentSerializer,
    DisciplineSerializer,
    RoomSerializer,
    LessonSerializer,
)
from .permissions import LessonPermission


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all().order_by("name")
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]


class GroupViewSet(viewsets.ModelViewSet):
    queryset = GroupModel.objects.select_related("department").all().order_by("name")
    serializer_class = GroupSerializer
    permission_classes = [IsAuthenticated]


class TeacherViewSet(viewsets.ModelViewSet):
    queryset = Teacher.objects.select_related("user", "department").all()
    serializer_class = TeacherSerializer
    permission_classes = [IsAuthenticated]


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.select_related("user", "group").all()
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]


class DisciplineViewSet(viewsets.ModelViewSet):
    queryset = Discipline.objects.all().order_by("name")
    serializer_class = DisciplineSerializer
    permission_classes = [IsAuthenticated]


class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all().order_by("name")
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def free(self, request):
        """
        Search free rooms by time range, type, capacity.
        Query params: start, end (ISO); type; capacity
        """
        start_str = request.query_params.get("start")
        end_str = request.query_params.get("end")
        room_type = request.query_params.get("type")
        capacity = request.query_params.get("capacity")
        if not start_str or not end_str:
            return Response({"detail": "start and end are required ISO datetime"}, status=status.HTTP_400_BAD_REQUEST)
        start = datetime.fromisoformat(start_str)
        end = datetime.fromisoformat(end_str)

        busy_qs = Lesson.objects.filter(room=OuterRef("pk")).filter(start_time__lt=end, end_time__gt=start)
        qs = Room.objects.all()
        if room_type:
            qs = qs.filter(room_type=room_type)
        if capacity:
            qs = qs.filter(capacity__gte=int(capacity))
        qs = qs.annotate(is_busy=Exists(busy_qs)).filter(is_busy=False)
        page = self.paginate_queryset(qs)
        ser = RoomSerializer(page or qs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)


class LessonViewSet(viewsets.ModelViewSet):
    queryset = Lesson.objects.select_related("group", "teacher__user", "discipline", "room").all()
    serializer_class = LessonSerializer
    permission_classes = [LessonPermission]

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def by_group(self, request):
        group_id = request.query_params.get("group_id")
        week = request.query_params.get("week")
        if not group_id:
            return Response({"detail": "group_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        qs = self.queryset.filter(group_id=group_id)
        if week:
            qs = qs.filter(week=int(week))
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def by_teacher(self, request):
        teacher_id = request.query_params.get("teacher_id")
        week = request.query_params.get("week")
        if not teacher_id:
            return Response({"detail": "teacher_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        qs = self.queryset.filter(teacher_id=teacher_id)
        if week:
            qs = qs.filter(week=int(week))
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def by_room(self, request):
        room_id = request.query_params.get("room_id")
        week = request.query_params.get("week")
        if not room_id:
            return Response({"detail": "room_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        qs = self.queryset.filter(room_id=room_id)
        if week:
            qs = qs.filter(week=int(week))
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)

