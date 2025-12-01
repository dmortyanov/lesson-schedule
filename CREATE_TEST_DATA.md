# Как создать тестовое расписание

## Способ 1: Через Python скрипт (рекомендуется)

Самый простой способ - использовать готовый скрипт:

```powershell
python manage.py shell < create_test_data.py
```

Или через интерактивную оболочку:

```powershell
python manage.py shell
```

Затем скопируйте и вставьте содержимое файла `create_test_data.py`.

## Способ 2: Через Django Admin (визуально)

1. Зайдите в админ-панель: `http://127.0.0.1:8000/admin/`
2. Войдите под суперпользователем
3. Создайте данные в следующем порядке:

### Шаг 1: Создайте кафедру
- Перейдите в "Departments" → "Add Department"
- Название: `Информатика`
- Сохраните

### Шаг 2: Создайте группу
- Перейдите в "Group models" → "Add Group model"
- Название: `ИВТ-31`
- Кафедра: выберите "Информатика"
- Год: `3`
- Сохраните

### Шаг 3: Создайте пользователя-преподавателя
- Перейдите в "Users" → "Add user"
- Username: `teacher1`
- Password: `teacher123` (и подтвердите)
- First name: `Иван`
- Last name: `Иванов`
- Сохраните
- В разделе "Groups" добавьте пользователя в группу `TEACHER`

### Шаг 4: Создайте запись преподавателя
- Перейдите в "Teachers" → "Add Teacher"
- User: выберите `teacher1`
- Department: выберите "Информатика"
- Title: `Доцент` (или оставьте пустым)
- Сохраните

### Шаг 5: Создайте дисциплины
- Перейдите в "Disciplines" → "Add Discipline"
- Создайте несколько дисциплин:
  - `Базы данных`
  - `Программирование`
  - `Веб-разработка`

### Шаг 6: Создайте аудитории
- Перейдите в "Rooms" → "Add Room"
- Создайте несколько аудиторий:
  - `А-101`, тип: `lecture`, вместимость: `40`
  - `А-102`, тип: `lecture`, вместимость: `30`
  - `Л-201`, тип: `lab`, вместимость: `20`
  - `Л-202`, тип: `lab`, вместимость: `25`

### Шаг 7: Создайте занятия
- Перейдите в "Lessons" → "Add Lesson"
- Заполните:
  - Group: `ИВТ-31`
  - Teacher: `teacher1`
  - Discipline: выберите одну из дисциплин
  - Room: выберите аудиторию
  - Start time: например, `2025-12-02 09:00:00` (формат: ГГГГ-ММ-ДД ЧЧ:ММ:СС)
  - End time: например, `2025-12-02 10:30:00`
  - Week: `12` (номер недели семестра)
- Сохраните
- Создайте несколько занятий на разные дни недели

## Способ 3: Через Django Shell (вручную)

```powershell
python manage.py shell
```

Затем выполните:

```python
from django.contrib.auth.models import User, Group
from core.models import Department, GroupModel, Teacher, Discipline, Room, Lesson
from datetime import datetime, timedelta
from django.utils import timezone

# Создаём кафедру
dept = Department.objects.get_or_create(name="Информатика")[0]

# Создаём группу
group = GroupModel.objects.get_or_create(name="ИВТ-31", defaults={"department": dept, "year": 3})[0]

# Создаём преподавателя
teacher_user = User.objects.get_or_create(username="teacher1", defaults={"first_name": "Иван", "last_name": "Иванов"})[0]
teacher_user.set_password("teacher123")
teacher_user.save()
teacher_user.groups.add(Group.objects.get_or_create(name="TEACHER")[0])

teacher = Teacher.objects.get_or_create(user=teacher_user, defaults={"department": dept})[0]

# Создаём дисциплину
discipline = Discipline.objects.get_or_create(name="Базы данных")[0]

# Создаём аудиторию
room = Room.objects.get_or_create(name="А-101", defaults={"capacity": 40, "room_type": "lecture"})[0]

# Создаём занятие
start = timezone.now().replace(hour=9, minute=0, second=0, microsecond=0)
lesson = Lesson.objects.create(
    group=group,
    teacher=teacher,
    discipline=discipline,
    room=room,
    start_time=start,
    end_time=start + timedelta(hours=1, minutes=30),
    week=12
)
print(f"Создано занятие: {lesson}")
```

## Формат даты и времени для занятий

При создании занятий используйте формат ISO:
- `2025-12-02T09:00:00` (через API)
- `2025-12-02 09:00:00` (через Django admin или shell)

**Важно:** 
- `start_time` и `end_time` должны быть в формате datetime
- `end_time` должен быть позже `start_time`
- `week` - номер недели семестра (1-52)

## Проверка

После создания данных:
1. Зайдите на сайт: `http://127.0.0.1:8000/`
2. Войдите под созданным пользователем
3. Перейдите в раздел "Расписание"
4. Выберите группу - должно отобразиться расписание

