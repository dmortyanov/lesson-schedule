"""
Скрипт для исправления кодировки базы данных и пересоздания данных
"""
from django.core.management import execute_from_command_line
import django
import os
import sys

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'schedule.settings')
django.setup()

from django.db import connection
from core.models import Lesson, Discipline, Room, GroupModel, Teacher, Department, Student
from django.contrib.auth.models import User

print("🔧 Исправление кодировки базы данных...")

# 1. Удаляем все данные
print("\n1. Удаление старых данных...")
Lesson.objects.all().delete()
Discipline.objects.all().delete()
Room.objects.all().delete()
Student.objects.all().delete()
Teacher.objects.filter(user__username='teacher1').delete()
User.objects.filter(username='teacher1').delete()
GroupModel.objects.all().delete()
Department.objects.all().delete()
print("✓ Старые данные удалены")

# 2. Проверяем и исправляем кодировку базы данных
print("\n2. Проверка кодировки базы данных...")
with connection.cursor() as cursor:
    # Проверяем кодировку базы данных
    cursor.execute("SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()")
    db_info = cursor.fetchone()
    print(f"   Текущая кодировка БД: {db_info[0]}, collation: {db_info[1]}")
    
    if db_info[0] != 'utf8mb4':
        print("   ⚠️  База данных не использует utf8mb4!")
        print("   💡 Рекомендуется пересоздать базу данных через phpMyAdmin:")
        print("      1. Откройте http://localhost/phpmyadmin")
        print("      2. Удалите базу данных 'schedule_db'")
        print("      3. Создайте новую базу 'schedule_db' с кодировкой utf8mb4_unicode_ci")
        print("      4. Затем запустите: python manage.py migrate")
    else:
        print("   ✓ База данных использует utf8mb4")

print("\n✅ Готово! Теперь запустите скрипт create_test_data.py для создания новых данных.")

