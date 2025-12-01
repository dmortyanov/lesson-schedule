#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Скрипт для пересоздания тестовых данных с правильной кодировкой
Запустите: python recreate_data.py
"""
import os
import sys
import django

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'schedule.settings')
django.setup()

from django.contrib.auth.models import User, Group
from core.models import Department, GroupModel, Teacher, Student, Discipline, Room, Lesson
from datetime import datetime, timedelta
from django.utils import timezone

# Устанавливаем кодировку для вывода
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

print("🔧 Создание тестовых данных...")

# Создаём группы ролей, если их нет
for group_name in ["ADMIN_DB", "TEACHER", "STUDENT"]:
    Group.objects.get_or_create(name=group_name)

# 1. Создаём кафедру
department, created = Department.objects.get_or_create(name="Информатика")
if created:
    print(f"✓ Создана кафедра: {department.name}")

# 2. Создаём группу
group, created = GroupModel.objects.get_or_create(
    name="ИВТ-31",
    defaults={"department": department, "year": 3}
)
if created:
    print(f"✓ Создана группа: {group.name}")

# 3. Создаём пользователя-преподавателя
teacher_user, created = User.objects.get_or_create(
    username="teacher1",
    defaults={
        "first_name": "Иван",
        "last_name": "Иванов",
        "email": "teacher1@example.com"
    }
)
if created:
    teacher_user.set_password("teacher123")
    teacher_user.save()
    teacher_user.groups.add(Group.objects.get(name="TEACHER"))
    print(f"✓ Создан преподаватель: {teacher_user.username} (пароль: teacher123)")

# 4. Создаём запись преподавателя
teacher, created = Teacher.objects.get_or_create(
    user=teacher_user,
    defaults={"department": department, "title": "Доцент"}
)
if created:
    print(f"✓ Создана запись преподавателя: {teacher}")

# 5. Создаём дисциплины
disciplines_data = [
    {"name": "Базы данных"},
    {"name": "Программирование"},
    {"name": "Веб-разработка"},
]

for disc_data in disciplines_data:
    discipline, created = Discipline.objects.get_or_create(**disc_data)
    if created:
        print(f"✓ Создана дисциплина: {discipline.name}")

# 6. Создаём аудитории
rooms_data = [
    {"name": "А-101", "capacity": 40, "room_type": "lecture"},
    {"name": "А-102", "capacity": 30, "room_type": "lecture"},
    {"name": "Л-201", "capacity": 20, "room_type": "lab"},
    {"name": "Л-202", "capacity": 25, "room_type": "lab"},
]

for room_data in rooms_data:
    room, created = Room.objects.get_or_create(**room_data)
    if created:
        print(f"✓ Создана аудитория: {room.name}")

# 7. Создаём занятия (расписание)
# Берём текущую дату и создаём занятия на ближайшие дни
today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
# Начинаем с понедельника текущей недели
days_since_monday = today.weekday()
monday = today - timedelta(days=days_since_monday)

# Получаем объекты
db_discipline = Discipline.objects.get(name="Базы данных")
prog_discipline = Discipline.objects.get(name="Программирование")
web_discipline = Discipline.objects.get(name="Веб-разработка")
room_a101 = Room.objects.get(name="А-101")
room_l201 = Room.objects.get(name="Л-201")

# Создаём занятия на неделю (12-я неделя семестра)
week = 12
lessons_data = [
    # Понедельник
    {
        "group": group,
        "teacher": teacher,
        "discipline": db_discipline,
        "room": room_a101,
        "start_time": monday + timedelta(days=0, hours=9, minutes=0),
        "end_time": monday + timedelta(days=0, hours=10, minutes=30),
        "week": week,
    },
    {
        "group": group,
        "teacher": teacher,
        "discipline": prog_discipline,
        "room": room_l201,
        "start_time": monday + timedelta(days=0, hours=11, minutes=0),
        "end_time": monday + timedelta(days=0, hours=12, minutes=30),
        "week": week,
    },
    # Вторник
    {
        "group": group,
        "teacher": teacher,
        "discipline": web_discipline,
        "room": room_a101,
        "start_time": monday + timedelta(days=1, hours=9, minutes=0),
        "end_time": monday + timedelta(days=1, hours=10, minutes=30),
        "week": week,
    },
    # Среда
    {
        "group": group,
        "teacher": teacher,
        "discipline": db_discipline,
        "room": room_l201,
        "start_time": monday + timedelta(days=2, hours=13, minutes=0),
        "end_time": monday + timedelta(days=2, hours=14, minutes=30),
        "week": week,
    },
    # Четверг
    {
        "group": group,
        "teacher": teacher,
        "discipline": prog_discipline,
        "room": room_a101,
        "start_time": monday + timedelta(days=3, hours=10, minutes=0),
        "end_time": monday + timedelta(days=3, hours=11, minutes=30),
        "week": week,
    },
    # Пятница
    {
        "group": group,
        "teacher": teacher,
        "discipline": web_discipline,
        "room": room_l201,
        "start_time": monday + timedelta(days=4, hours=14, minutes=0),
        "end_time": monday + timedelta(days=4, hours=15, minutes=30),
        "week": week,
    },
]

created_count = 0
for lesson_data in lessons_data:
    # Проверяем, нет ли уже такого занятия
    existing = Lesson.objects.filter(
        group=lesson_data["group"],
        teacher=lesson_data["teacher"],
        discipline=lesson_data["discipline"],
        room=lesson_data["room"],
        start_time=lesson_data["start_time"],
        week=lesson_data["week"]
    ).first()
    
    if not existing:
        lesson = Lesson.objects.create(**lesson_data)
        created_count += 1
        print(f"✓ Создано занятие: {lesson.discipline.name} в {lesson.start_time.strftime('%d.%m.%Y %H:%M')}")

print(f"\n✅ Готово! Создано {created_count} занятий.")
print(f"\n📋 Данные для входа:")
print(f"   Преподаватель: teacher1 / teacher123")
print(f"   Группа: {group.name}")
print(f"   Неделя: {week}")

