from django.conf import settings
from django.contrib.auth.models import Group
from django.db import models


class Department(models.Model):
    name = models.CharField(max_length=255, unique=True)

    class Meta:
        verbose_name = "Кафедра"
        verbose_name_plural = "Кафедры"

    def __str__(self) -> str:
        return self.name


class GroupModel(models.Model):
    name = models.CharField(max_length=50, unique=True)
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="groups")
    year = models.PositiveIntegerField()

    class Meta:
        verbose_name = "Группа"
        verbose_name_plural = "Группы"

    def __str__(self) -> str:
        return self.name


class Teacher(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="teacher")
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="teachers")
    title = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = "Преподаватель"
        verbose_name_plural = "Преподаватели"

    def __str__(self) -> str:
        return self.user.get_full_name() or self.user.username


class Student(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="student")
    group = models.ForeignKey(GroupModel, on_delete=models.PROTECT, related_name="students")

    class Meta:
        verbose_name = "Студент"
        verbose_name_plural = "Студенты"

    def __str__(self) -> str:
        return self.user.get_full_name() or self.user.username


class Discipline(models.Model):
    name = models.CharField(max_length=255, unique=True)

    class Meta:
        verbose_name = "Дисциплина"
        verbose_name_plural = "Дисциплины"

    def __str__(self) -> str:
        return self.name


class Room(models.Model):
    LECTURE = "lecture"
    LAB = "lab"
    ROOM_TYPES = [(LECTURE, "Лекционная"), (LAB, "Лабораторная")]

    name = models.CharField(max_length=50, unique=True)
    capacity = models.PositiveIntegerField()
    room_type = models.CharField(max_length=16, choices=ROOM_TYPES, default=LECTURE)

    class Meta:
        verbose_name = "Аудитория"
        verbose_name_plural = "Аудитории"

    def __str__(self) -> str:
        return self.name


class Lesson(models.Model):
    group = models.ForeignKey(GroupModel, on_delete=models.PROTECT, related_name="lessons")
    teacher = models.ForeignKey(Teacher, on_delete=models.PROTECT, related_name="lessons")
    discipline = models.ForeignKey(Discipline, on_delete=models.PROTECT, related_name="lessons")
    room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name="lessons")
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    week = models.PositiveIntegerField()

    class Meta:
        verbose_name = "Занятие"
        verbose_name_plural = "Занятия"
        indexes = [
            models.Index(fields=["start_time", "end_time", "room"]),
            models.Index(fields=["week", "group"]),
        ]
        constraints = [
            models.CheckConstraint(check=models.Q(end_time__gt=models.F("start_time")), name="lesson_time_order"),
        ]

    def __str__(self) -> str:
        return f"{self.discipline} {self.group} {self.start_time:%Y-%m-%d %H:%M}"


class ChangeRequest(models.Model):
    NEW = "new"
    DONE = "done"
    STATES = [(NEW, "Новая"), (DONE, "Обработана")]

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    payload = models.JSONField()
    state = models.CharField(max_length=8, choices=STATES, default=NEW)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Заявка на изменение"
        verbose_name_plural = "Заявки на изменения"


def ensure_default_groups() -> None:
    for name in ["ADMIN_DB", "TEACHER", "STUDENT"]:
        Group.objects.get_or_create(name=name)

