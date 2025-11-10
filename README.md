IS "Расписание занятий и преподавателей" - backend
=================================================

Stack: Django 5, DRF, PostgreSQL 14+, JWT (SimpleJWT).

Quick start
-----------
1) Create and fill `.env` from example:

   DJANGO_SECRET_KEY=change-me
   DJANGO_DEBUG=1
   DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
   POSTGRES_DB=schedule_db
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgres
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432

2) Install deps:
   pip install -r requirements.txt

3) Migrate and create superuser:
   python manage.py migrate
   python manage.py createsuperuser

4) Load demo data (optional):
   python manage.py loaddata fixtures/seed.json

5) Run:
   python manage.py runserver

Main API
--------
- POST /api/auth/token/  -> {access, refresh}
- GET/POST/PUT/DELETE /api/departments/
- GET/POST/PUT/DELETE /api/groups/
- GET/POST/PUT/DELETE /api/teachers/
- GET/POST/PUT/DELETE /api/students/
- GET/POST/PUT/DELETE /api/rooms/
- GET /api/rooms/free/?start=...&end=...&type=lecture&capacity=30
- GET/POST/PUT/DELETE /api/lessons/
- GET /api/lessons/by_group/?group_id=1&week=12
- GET /api/lessons/by_teacher/?teacher_id=1&week=12
- GET /api/lessons/by_room/?room_id=1&week=12

Roles
-----
- ADMIN_DB: full rights on all entities
- TEACHER: read all, edit only own lessons
- STUDENT: read-only

Backup/Archiving (ops notes)
----------------------------
- Use `pg_dump` daily and keep 7 copies; weekly cold copy; 4-hour incremental via WAL archiving; semester end archive.

Testing
-------
   python manage.py test

