from django.contrib.auth.models import User, Group
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from .models import Department, GroupModel, Teacher, Discipline, Room, Lesson
from datetime import datetime, timedelta


class ApiSmokeTests(APITestCase):
    def setUp(self):
        # roles
        for g in ["ADMIN_DB", "TEACHER", "STUDENT"]:
            Group.objects.get_or_create(name=g)
        self.admin = User.objects.create_user(username="admin", password="pass")
        self.admin.groups.add(Group.objects.get(name="ADMIN_DB"))
        self.teacher_user = User.objects.create_user(username="teacher", password="pass")
        self.teacher_user.groups.add(Group.objects.get(name="TEACHER"))
        self.student_user = User.objects.create_user(username="student", password="pass")
        self.student_user.groups.add(Group.objects.get(name="STUDENT"))
        self.department = Department.objects.create(name="ИТ")
        self.group = GroupModel.objects.create(name="ИВТ-31", department=self.department, year=3)
        self.teacher = Teacher.objects.create(user=self.teacher_user, department=self.department, title="")
        self.discipline = Discipline.objects.create(name="БД")
        self.room = Room.objects.create(name="А-101", capacity=30, room_type="lecture")

    def auth(self, user):
        url = reverse("token_obtain_pair")
        res = self.client.post(url, {"username": user.username, "password": "pass"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")

    def test_admin_can_create_lesson(self):
        self.auth(self.admin)
        url = "/api/lessons/"
        payload = {
            "group_id": self.group.id,
            "teacher_id": self.teacher.id,
            "discipline_id": self.discipline.id,
            "room_id": self.room.id,
            "start_time": (datetime.now() + timedelta(hours=1)).isoformat(),
            "end_time": (datetime.now() + timedelta(hours=2)).isoformat(),
            "week": 10,
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_student_read_only(self):
        # create lesson as admin
        Lesson.objects.create(
            group=self.group,
            teacher=self.teacher,
            discipline=self.discipline,
            room=self.room,
            start_time=datetime.now() + timedelta(hours=1),
            end_time=datetime.now() + timedelta(hours=2),
            week=10,
        )
        self.auth(self.student_user)
        res = self.client.get("/api/lessons/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        res = self.client.post("/api/lessons/", {})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

