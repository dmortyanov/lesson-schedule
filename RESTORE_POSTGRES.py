"""
Скрипт для восстановления настроек PostgreSQL в settings.py
Запустите этот скрипт, когда будете готовы вернуть настройки PostgreSQL
"""

import re
from pathlib import Path

# Пути к файлам
SETTINGS_FILE = Path("schedule/settings.py")
BACKUP_FILE = Path("POSTGRES_SETTINGS_BACKUP.txt")

# Настройки PostgreSQL для восстановления
POSTGRES_CONFIG = '''DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "schedule_db"),
        "USER": os.getenv("POSTGRES_USER", "postgres"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "postgres"),
        "HOST": os.getenv("POSTGRES_HOST", "localhost"),
        "PORT": int(os.getenv("POSTGRES_PORT", "5432")),
    }
}'''

def restore_postgres_settings():
    """Восстанавливает настройки PostgreSQL в settings.py"""
    
    if not SETTINGS_FILE.exists():
        print(f"❌ Файл {SETTINGS_FILE} не найден!")
        return False
    
    # Читаем текущий файл settings.py
    with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Находим и заменяем блок DATABASES
    # Паттерн для поиска блока DATABASES (включая комментарии и пустые строки)
    pattern = r'(# ВРЕМЕННАЯ КОНФИГУРАЦИЯ.*?)(?=\n[A-Z_])'
    replacement = POSTGRES_CONFIG
    
    # Если не найдено, пытаемся найти просто блок DATABASES
    if "# ВРЕМЕННАЯ КОНФИГУРАЦИЯ" not in content:
        pattern = r'DATABASES = \{[\s\S]*?\n\}'
        replacement = POSTGRES_CONFIG
    
    new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    # Если ничего не изменилось, используем более простой подход
    if new_content == content:
        # Находим строку с DATABASES и заменяем всё до следующей секции
        lines = content.split('\n')
        new_lines = []
        skip_until_next_section = False
        
        for i, line in enumerate(lines):
            if 'DATABASES = {' in line or '# ВРЕМЕННАЯ КОНФИГУРАЦИЯ' in line:
                skip_until_next_section = True
                # Добавляем настройки PostgreSQL
                new_lines.append('DATABASES = {')
                new_lines.append('    "default": {')
                new_lines.append('        "ENGINE": "django.db.backends.postgresql",')
                new_lines.append('        "NAME": os.getenv("POSTGRES_DB", "schedule_db"),')
                new_lines.append('        "USER": os.getenv("POSTGRES_USER", "postgres"),')
                new_lines.append('        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "postgres"),')
                new_lines.append('        "HOST": os.getenv("POSTGRES_HOST", "localhost"),')
                new_lines.append('        "PORT": int(os.getenv("POSTGRES_PORT", "5432")),')
                new_lines.append('    }')
                new_lines.append('}')
                continue
            elif skip_until_next_section:
                # Пропускаем строки до закрывающей скобки блока DATABASES
                if line.strip() == '}' and i > 0 and '}' in lines[i-1]:
                    skip_until_next_section = False
                continue
            else:
                new_lines.append(line)
        
        new_content = '\n'.join(new_lines)
    
    # Сохраняем изменения
    with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("✅ Настройки PostgreSQL успешно восстановлены в settings.py!")
    print(f"📁 Файл обновлён: {SETTINGS_FILE}")
    return True

if __name__ == "__main__":
    print("🔄 Восстановление настроек PostgreSQL...")
    if restore_postgres_settings():
        print("\n✅ Готово! Теперь settings.py использует PostgreSQL.")
        print("⚠️  Не забудьте запустить миграции: python manage.py migrate")
    else:
        print("\n❌ Ошибка при восстановлении настроек.")

