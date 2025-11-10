from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Department, GroupModel, Teacher, Student, Discipline, Room, Lesson


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name"]


class GroupSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)
    department_id = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), source="department", write_only=True)

    class Meta:
        model = GroupModel
        fields = ["id", "name", "year", "department", "department_id"]


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email"]


class TeacherSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source="user", write_only=True)
    department = DepartmentSerializer(read_only=True)
    department_id = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), source="department", write_only=True)

    class Meta:
        model = Teacher
        fields = ["id", "user", "user_id", "department", "department_id", "title"]


class StudentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source="user", write_only=True)
    group = GroupSerializer(read_only=True)
    group_id = serializers.PrimaryKeyRelatedField(queryset=GroupModel.objects.all(), source="group", write_only=True)

    class Meta:
        model = Student
        fields = ["id", "user", "user_id", "group", "group_id"]


class DisciplineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Discipline
        fields = ["id", "name"]


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ["id", "name", "capacity", "room_type"]


class LessonSerializer(serializers.ModelSerializer):
    group = GroupSerializer(read_only=True)
    group_id = serializers.PrimaryKeyRelatedField(queryset=GroupModel.objects.all(), source="group", write_only=True)
    teacher = TeacherSerializer(read_only=True)
    teacher_id = serializers.PrimaryKeyRelatedField(queryset=Teacher.objects.all(), source="teacher", write_only=True)
    discipline = DisciplineSerializer(read_only=True)
    discipline_id = serializers.PrimaryKeyRelatedField(queryset=Discipline.objects.all(), source="discipline", write_only=True)
    room = RoomSerializer(read_only=True)
    room_id = serializers.PrimaryKeyRelatedField(queryset=Room.objects.all(), source="room", write_only=True)

    class Meta:
        model = Lesson
        fields = [
            "id",
            "group",
            "group_id",
            "teacher",
            "teacher_id",
            "discipline",
            "discipline_id",
            "room",
            "room_id",
            "start_time",
            "end_time",
            "week",
        ]

