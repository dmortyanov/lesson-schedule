from datetime import datetime
from django.db.models import Q, Exists, OuterRef
from rest_framework import viewsets, mixins, status, serializers as drf_serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView

from .models import Department, GroupModel, Teacher, Student, Discipline, Room, Lesson
from .serializers import (
    DepartmentSerializer,
    GroupSerializer,
    TeacherSerializer,
    StudentSerializer,
    DisciplineSerializer,
    RoomSerializer,
    LessonSerializer,
    UserRegistrationSerializer,
)
from .permissions import LessonPermission, IsTeacher


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
        Поиск свободных аудиторий в указанный промежуток времени (п. 4.2.3 ТЗ)
        
        Query params:
        - start: начальное время (ISO format, обязательный)
        - end: конечное время (ISO format, обязательный)
        - type: тип аудитории (lecture/lab, опционально)
        - capacity: минимальная вместимость (опционально)
        """
        start_str = request.query_params.get("start")
        end_str = request.query_params.get("end")
        room_type = request.query_params.get("type")
        capacity = request.query_params.get("capacity")
        
        if not start_str or not end_str:
            return Response(
                {"detail": "Параметры start и end обязательны (ISO format datetime)"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Парсинг дат
        try:
            start = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
        except ValueError:
            return Response(
                {"detail": "Неверный формат start. Используйте ISO format (например: 2024-01-01T09:00:00)"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            end = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
        except ValueError:
            return Response(
                {"detail": "Неверный формат end. Используйте ISO format (например: 2024-01-01T10:30:00)"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Валидация временного диапазона
        if start >= end:
            return Response(
                {"detail": "Время начала должно быть меньше времени окончания"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Поиск занятых аудиторий в указанный промежуток времени
        # Аудитория занята, если есть занятие, которое пересекается с запрашиваемым временем
        busy_qs = Lesson.objects.filter(room=OuterRef("pk")).filter(
            start_time__lt=end, 
            end_time__gt=start
        )
        
        # Базовый запрос всех аудиторий
        qs = Room.objects.all()
        
        # Фильтрация по типу
        if room_type:
            if room_type not in [Room.LECTURE, Room.LAB]:
                return Response(
                    {"detail": f"Тип аудитории должен быть '{Room.LECTURE}' или '{Room.LAB}'"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            qs = qs.filter(room_type=room_type)
        
        # Фильтрация по вместимости
        if capacity:
            try:
                min_capacity = int(capacity)
                if min_capacity <= 0:
                    return Response(
                        {"detail": "Вместимость должна быть положительным числом"}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                qs = qs.filter(capacity__gte=min_capacity)
            except ValueError:
                return Response(
                    {"detail": "Параметр capacity должен быть числом"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Исключаем занятые аудитории
        qs = qs.annotate(is_busy=Exists(busy_qs)).filter(is_busy=False)
        
        # Сортировка по имени
        qs = qs.order_by("name")
        
        page = self.paginate_queryset(qs)
        ser = RoomSerializer(page or qs, many=True)
        
        response_data = {
            "time_range": {
                "start": start.isoformat(),
                "end": end.isoformat()
            },
            "count": qs.count(),
            "rooms": ser.data
        }
        
        return self.get_paginated_response(response_data) if page is not None else Response(response_data)


class LessonViewSet(viewsets.ModelViewSet):
    queryset = Lesson.objects.select_related("group", "teacher__user", "discipline", "room").all()
    serializer_class = LessonSerializer
    permission_classes = [LessonPermission]

    def _validate_time_conflicts(
        self, *, start_time, end_time, room, teacher, group, instance=None
    ):
        from rest_framework import serializers as drf_serializers
        from .models import Lesson, Room

        overlap_q = Q(start_time__lt=end_time, end_time__gt=start_time)
        base_qs = Lesson.objects.all()
        if instance is not None and instance.pk:
            base_qs = base_qs.exclude(pk=instance.pk)

        room_conflicts = base_qs.filter(overlap_q, room=room)
        teacher_conflicts = base_qs.filter(overlap_q, teacher=teacher)
        group_conflicts = base_qs.filter(overlap_q, group=group)

        if not (room_conflicts.exists() or teacher_conflicts.exists() or group_conflicts.exists()):
            return

        errors = {}
        if room_conflicts.exists():
            msg = f"Аудитория {room.name} уже занята в интервале {start_time:%d.%m.%Y %H:%M} - {end_time:%d.%m.%Y %H:%M}."
            errors.setdefault("room_id", []).append(msg)

        if teacher_conflicts.exists():
            msg = f"Преподаватель {teacher} уже ведёт занятие в интервале {start_time:%d.%m.%Y %H:%M} - {end_time:%d.%m.%Y %H:%M}."
            errors.setdefault("teacher_id", []).append(msg)

        if group_conflicts.exists():
            msg = f"Группа {group} уже занята в интервале {start_time:%d.%m.%Y %H:%M} - {end_time:%d.%m.%Y %H:%M}."
            errors.setdefault("group_id", []).append(msg)

        raise drf_serializers.ValidationError(errors)

    def get_queryset(self):
        """Фильтруем queryset для преподавателей - показываем только их занятия"""
        qs = super().get_queryset()
        if IsTeacher().has_permission(self.request, self):
            try:
                teacher = Teacher.objects.get(user=self.request.user)
                qs = qs.filter(teacher=teacher)
            except Teacher.DoesNotExist:
                pass
        return qs

    def perform_create(self, serializer):
        """При создании занятия преподавателем автоматически устанавливаем его как преподавателя и валидируем"""
        if IsTeacher().has_permission(self.request, self):
            try:
                teacher = Teacher.objects.select_related('department').get(user=self.request.user)

                # Валидация: проверяем, что группа принадлежит кафедре преподавателя
                group_id = serializer.validated_data.get('group_id') or serializer.validated_data.get('group').id
                group = GroupModel.objects.select_related('department').get(id=group_id)
                
                if group.department_id != teacher.department_id:
                    raise drf_serializers.ValidationError({
                        'group_id': f'Вы можете создавать занятия только для групп своей кафедры ({teacher.department.name})'
                    })

                # Валидация конфликтов по времени (аудитория / преподаватель)
                start_time = serializer.validated_data.get("start_time")
                end_time = serializer.validated_data.get("end_time")
                room = serializer.validated_data.get("room")
                if room is None:
                    room_id = serializer.validated_data.get("room_id")
                    room = Room.objects.get(id=room_id)

                week_number = start_time.isocalendar().week

                self._validate_time_conflicts(
                    start_time=start_time,
                    end_time=end_time,
                    room=room,
                    teacher=teacher,
                    group=group,
                    instance=None,
                )

                # Устанавливаем преподавателя автоматически
                serializer.save(teacher=teacher, week=week_number)
            except Teacher.DoesNotExist:
                # Для пользователя без Teacher-связи просто сохраняем, вычислив неделю
                start_time = serializer.validated_data.get("start_time")
                if start_time is not None:
                    week_number = start_time.isocalendar().week
                    serializer.save(week=week_number)
                else:
                    serializer.save()
        else:
            # Для администратора БД: тоже автоматически проставляем неделю
            start_time = serializer.validated_data.get("start_time")
            if start_time is not None:
                week_number = start_time.isocalendar().week
                serializer.save(week=week_number)
            else:
                serializer.save()
    
    def perform_update(self, serializer):
        """При обновлении занятия преподавателем валидируем ограничения"""
        if IsTeacher().has_permission(self.request, self):
            try:
                teacher = Teacher.objects.select_related('department').get(user=self.request.user)

                # Валидация группы
                instance = self.get_object()
                group = serializer.validated_data.get('group') or instance.group
                if group.department_id != teacher.department_id:
                    raise drf_serializers.ValidationError({
                        'group_id': f'Вы можете создавать занятия только для групп своей кафедры ({teacher.department.name})'
                    })

                # Валидация конфликтов по времени (аудитория / преподаватель)
                start_time = serializer.validated_data.get("start_time") or instance.start_time
                end_time = serializer.validated_data.get("end_time") or instance.end_time
                room = serializer.validated_data.get("room") or instance.room

                # Автоматически пересчитываем номер недели по (возможно изменённой) дате начала
                week_number = start_time.isocalendar().week

                self._validate_time_conflicts(
                    start_time=start_time,
                    end_time=end_time,
                    room=room,
                    teacher=teacher,
                    group=group,
                    instance=instance,
                )

                serializer.save(week=week_number)
            except Teacher.DoesNotExist:
                # Если нет Teacher-связи, просто обновляем и проставляем неделю
                instance = self.get_object()
                start_time = serializer.validated_data.get("start_time") or instance.start_time
                week_number = start_time.isocalendar().week
                serializer.save(week=week_number)
        else:
            # Для администратора БД: тоже автоматически проставляем неделю
            instance = self.get_object()
            start_time = serializer.validated_data.get("start_time") or instance.start_time
            week_number = start_time.isocalendar().week
            serializer.save(week=week_number)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def by_group(self, request):
        """
        Поиск занятий по группе (п. 4.2.3 ТЗ)
        
        Query params:
        - group_id: ID группы (обязательный)
        - start_date: начальная дата (ISO format, опционально)
        - end_date: конечная дата (ISO format, опционально)
        """
        group_id = request.query_params.get("group_id")
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")
        
        if not group_id:
            return Response(
                {"detail": "Параметр group_id обязателен"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Проверяем существование группы
        try:
            group = GroupModel.objects.get(id=group_id)
        except GroupModel.DoesNotExist:
            return Response(
                {"detail": f"Группа с ID {group_id} не найдена"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        qs = self.queryset.filter(group_id=group_id)
        
        # Фильтрация по дате
        if start_date_str:
            try:
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                qs = qs.filter(start_time__gte=start_date)
            except ValueError:
                return Response(
                    {"detail": "Неверный формат start_date. Используйте ISO format (например: 2024-01-01T00:00:00)"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        if end_date_str:
            try:
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                qs = qs.filter(end_time__lte=end_date)
            except ValueError:
                return Response(
                    {"detail": "Неверный формат end_date. Используйте ISO format (например: 2024-01-01T23:59:59)"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Сортировка по времени начала
        qs = qs.order_by("start_time")
        
        ser = self.get_serializer(qs, many=True)
        return Response({
            "group": {"id": group.id, "name": group.name},
            "count": qs.count(),
            "lessons": ser.data
        })

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def by_teacher(self, request):
        """
        Поиск занятий по преподавателю (п. 4.2.3 ТЗ)
        
        Query params:
        - teacher_id: ID преподавателя (обязательный)
        - start_date: начальная дата (ISO format, опционально)
        - end_date: конечная дата (ISO format, опционально)
        """
        teacher_id = request.query_params.get("teacher_id")
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")
        
        if not teacher_id:
            return Response(
                {"detail": "Параметр teacher_id обязателен"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Проверяем существование преподавателя
        try:
            teacher = Teacher.objects.select_related("user").get(id=teacher_id)
        except Teacher.DoesNotExist:
            return Response(
                {"detail": f"Преподаватель с ID {teacher_id} не найден"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        qs = self.queryset.filter(teacher_id=teacher_id)
        
        # Фильтрация по дате
        if start_date_str:
            try:
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                qs = qs.filter(start_time__gte=start_date)
            except ValueError:
                return Response(
                    {"detail": "Неверный формат start_date. Используйте ISO format (например: 2024-01-01T00:00:00)"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        if end_date_str:
            try:
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                qs = qs.filter(end_time__lte=end_date)
            except ValueError:
                return Response(
                    {"detail": "Неверный формат end_date. Используйте ISO format (например: 2024-01-01T23:59:59)"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Сортировка по времени начала
        qs = qs.order_by("start_time")
        
        ser = self.get_serializer(qs, many=True)
        return Response({
            "teacher": {
                "id": teacher.id,
                "name": teacher.user.get_full_name() or teacher.user.username
            },
            "count": qs.count(),
            "lessons": ser.data
        })

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def by_room(self, request):
        """
        Поиск занятий по аудитории (п. 4.2.3 ТЗ)
        
        Query params:
        - room_id: ID аудитории (обязательный)
        - start_date: начальная дата (ISO format, опционально)
        - end_date: конечная дата (ISO format, опционально)
        """
        room_id = request.query_params.get("room_id")
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")
        
        if not room_id:
            return Response(
                {"detail": "Параметр room_id обязателен"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Проверяем существование аудитории
        try:
            room = Room.objects.get(id=room_id)
        except Room.DoesNotExist:
            return Response(
                {"detail": f"Аудитория с ID {room_id} не найдена"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        qs = self.queryset.filter(room_id=room_id)
        
        # Фильтрация по дате
        if start_date_str:
            try:
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                qs = qs.filter(start_time__gte=start_date)
            except ValueError:
                return Response(
                    {"detail": "Неверный формат start_date. Используйте ISO format (например: 2024-01-01T00:00:00)"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        if end_date_str:
            try:
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                qs = qs.filter(end_time__lte=end_date)
            except ValueError:
                return Response(
                    {"detail": "Неверный формат end_date. Используйте ISO format (например: 2024-01-01T23:59:59)"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Сортировка по времени начала
        qs = qs.order_by("start_time")
        
        ser = self.get_serializer(qs, many=True)
        return Response({
            "room": {"id": room.id, "name": room.name, "capacity": room.capacity, "room_type": room.room_type},
            "count": qs.count(),
            "lessons": ser.data
        })


class CurrentUserView(APIView):
    """Получить информацию о текущем пользователе"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        groups = list(user.groups.values_list('name', flat=True))
        
        # Определяем роль
        role = 'STUDENT'
        if 'ADMIN_DB' in groups:
            role = 'ADMIN_DB'
        elif 'TEACHER' in groups:
            role = 'TEACHER'
        
        # Получаем связанные данные
        teacher = None
        student = None
        
        try:
            teacher = Teacher.objects.select_related('department').get(user=user)
        except Teacher.DoesNotExist:
            pass
        
        try:
            student = Student.objects.get(user=user)
        except Student.DoesNotExist:
            pass

        response_data = {
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'groups': groups,
            'role': role,
            'teacher_id': teacher.id if teacher else None,
            'student_id': student.id if student else None,
        }
        
        # Добавляем информацию о кафедре и дисциплинах для преподавателя
        if teacher:
            response_data['teacher_department_id'] = teacher.department.id
            response_data['teacher_department_name'] = teacher.department.name
            # Получаем дисциплины преподавателя через его занятия
            from .models import Discipline
            disciplines = Discipline.objects.filter(lessons__teacher=teacher).distinct()
            response_data['teacher_disciplines'] = [
                {'id': d.id, 'name': d.name} for d in disciplines
            ]

        return Response(response_data)


class RegisterView(APIView):
    """Регистрация нового пользователя"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                'message': 'Пользователь успешно зарегистрирован',
                'username': user.username,
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TeacherDisciplinesView(APIView):
    """Получить дисциплины преподавателя"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Получить список дисциплин текущего преподавателя"""
        try:
            teacher = Teacher.objects.get(user=request.user)
        except Teacher.DoesNotExist:
            return Response(
                {"detail": "Пользователь не является преподавателем"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Получаем дисциплины через занятия преподавателя
        disciplines = Discipline.objects.filter(lessons__teacher=teacher).distinct()
        serializer = DisciplineSerializer(disciplines, many=True)
        
        return Response({
            "teacher_id": teacher.id,
            "department_id": teacher.department.id,
            "department_name": teacher.department.name,
            "disciplines": serializer.data
        })


class TeacherGroupsView(APIView):
    """Получить группы кафедры преподавателя"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Получить список групп кафедры текущего преподавателя"""
        try:
            teacher = Teacher.objects.select_related('department').get(user=request.user)
        except Teacher.DoesNotExist:
            return Response(
                {"detail": "Пользователь не является преподавателем"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Получаем группы кафедры преподавателя
        groups = GroupModel.objects.filter(department=teacher.department)
        serializer = GroupSerializer(groups, many=True)
        
        return Response({
            "teacher_id": teacher.id,
            "department_id": teacher.department.id,
            "department_name": teacher.department.name,
            "groups": serializer.data
        })
