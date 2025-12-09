"""
Скрипт для создания «реальной» учебной недели:
- несколько преподавателей
- несколько групп
- несколько аудиторий
- ВСЯ рабочая неделя (Пн–Пт) занята парами
  слоты: 08:30–10:00, 10:20–11:50, 12:10–13:40, 14:00–15:30, 15:50–17:20

Запуск:
    python manage.py shell < create_test_data.py
или:
    python manage.py shell
    >>> exec(open('create_test_data.py', encoding='utf-8').read())
"""

from datetime import timedelta

from django.contrib.auth.models import Group, User
from django.utils import timezone

from core.models import Department, Discipline, GroupModel, Lesson, Room, Teacher


# ---------- Роли ----------
for group_name in ["ADMIN_DB", "TEACHER", "STUDENT"]:
    Group.objects.get_or_create(name=group_name)

# ---------- Кафедра ----------
department, created = Department.objects.get_or_create(name="Информатика")
if created:
    print(f"✓ Создана кафедра: {department.name}")

# ---------- Группы ----------
groups_data = [
    ("ИВТ-31", 3),
    ("ИВТ-32", 3),
    ("ИВТ-33", 3),
]
groups: list[GroupModel] = []
for name, year in groups_data:
    group, created = GroupModel.objects.get_or_create(
        name=name,
        defaults={"department": department, "year": year},
    )
    if created:
        print(f"✓ Создана группа: {group.name}")
    groups.append(group)

# ---------- Преподаватели (пользователи + Teacher) ----------
teachers_info = [
    ("teacher1", "Иван", "Иванов"),
    ("teacher2", "Пётр", "Петров"),
    ("teacher3", "Сергей", "Сергеев"),
]
teachers: list[Teacher] = []
teacher_group = Group.objects.get(name="TEACHER")

for username, first_name, last_name in teachers_info:
    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            "first_name": first_name,
            "last_name": last_name,
            "email": f"{username}@example.com",
        },
    )
    if created:
        user.set_password("teacher123")
        user.save()
        print(f"✓ Создан пользователь-преподаватель: {username} (пароль: teacher123)")
    # Добавляем в группу TEACHER (если ещё не в ней)
    user.groups.add(teacher_group)

    teacher, t_created = Teacher.objects.get_or_create(
        user=user,
        defaults={"department": department, "title": "Преподаватель"},
    )
    if t_created:
        print(f"  ✓ Создана запись Teacher: {teacher}")
    teachers.append(teacher)

# ---------- Дисциплины ----------
disciplines_data = [
    "Базы данных",
    "Программирование",
    "Веб-разработка",
    "Алгоритмы",
    "Операционные системы",
]
disciplines: list[Discipline] = []
for name in disciplines_data:
    disc, created = Discipline.objects.get_or_create(name=name)
    if created:
        print(f"✓ Создана дисциплина: {disc.name}")
    disciplines.append(disc)

# ---------- Аудитории ----------
rooms_data = [
    ("А-101", 40, "lecture"),
    ("А-102", 30, "lecture"),
    ("А-103", 35, "lecture"),
    ("Л-201", 20, "lab"),
    ("Л-202", 25, "lab"),
]
rooms: list[Room] = []
for name, capacity, room_type in rooms_data:
    room, created = Room.objects.get_or_create(
        name=name,
        defaults={
            "capacity": capacity,
            "room_type": room_type,
        },
    )
    if created:
        print(f"✓ Создана аудитория: {room.name} ({room.room_type}, {room.capacity} мест)")
    rooms.append(room)

# Убедимся, что учителей и аудиторий не меньше, чем групп
if len(teachers) < len(groups):
    raise RuntimeError("Нужно, чтобы преподавателей было >= количеству групп")
if len(rooms) < len(groups):
    raise RuntimeError("Нужно, чтобы аудиторий было >= количеству групп")

# ---------- Временные слоты ----------
# Пары: 08:30–10:00, 10:20–11:50, 12:10–13:40, 14:00–15:30, 15:50–17:20
time_slots = [
    (8, 30, 10, 0),
    (10, 20, 11, 50),
    (12, 10, 13, 40),
    (14, 0, 15, 30),
    (15, 50, 17, 20),
]

# ---------- Базовая дата (понедельник текущей недели) ----------
today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
days_since_monday = today.weekday()  # 0 = Пн
monday = today - timedelta(days=days_since_monday)
week_number = monday.isocalendar().week

# ---------- Генерация полного расписания на рабочую неделю ----------
created_count = 0
days_labels = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница"]

for day_offset, day_label in enumerate(days_labels):
    day_date = monday + timedelta(days=day_offset)

    for slot_index, (sh, sm, eh, em) in enumerate(time_slots):
        start_time = day_date + timedelta(hours=sh, minutes=sm)
        end_time = day_date + timedelta(hours=eh, minutes=em)

        for group_index, group in enumerate(groups):
            teacher = teachers[group_index]  # один преподаватель на каждую группу
            room = rooms[group_index]  # одна аудитория на каждую группу
            discipline = disciplines[(slot_index + group_index) % len(disciplines)]

            lesson_data = {
                "group": group,
                "teacher": teacher,
                "discipline": discipline,
                "room": room,
                "start_time": start_time,
                "end_time": end_time,
                "week": week_number,
            }

            existing = Lesson.objects.filter(
                group=lesson_data["group"],
                teacher=lesson_data["teacher"],
                discipline=lesson_data["discipline"],
                room=lesson_data["room"],
                start_time=lesson_data["start_time"],
                week=lesson_data["week"],
            ).first()

            if existing:
                continue

            lesson = Lesson.objects.create(**lesson_data)
            created_count += 1
            print(
                f"✓ {day_label}: {lesson.group.name}, {lesson.discipline.name}, "
                f"{lesson.room.name}, {lesson.start_time.strftime('%H:%M')}–{lesson.end_time.strftime('%H:%M')}"
            )

print(f"\n✅ Готово! Создано {created_count} занятий на неделю (Пн–Пт), неделя №{week_number}.")
print("\n📋 Данные для входа преподавателей:")
for username, *_ in teachers_info:
    print(f"   {username} / teacher123")
print("\n📋 Группы: " + ", ".join(g.name for g in groups))


