# Как проверить, что бэкенд настроен и запущен

## Изменения в бэкенде

Я внес **минимальные изменения** в бэкенд:

### 1. Добавлен новый endpoint `/api/auth/me/`
- **Файл:** `core/views.py` (строки 126-165)
- **Что делает:** Возвращает информацию о текущем пользователе (имя, роль, группы)
- **Зачем:** Нужен фронтенду для определения роли пользователя

### 2. Обновлены URL маршруты
- **Файл:** `core/urls.py` - добавлен маршрут для `/api/auth/me/`
- **Файл:** `schedule/urls.py` - изменена главная страница на `login.html`, добавлен `/dashboard/`

### 3. Настройка статических файлов
- **Файл:** `schedule/settings.py` - добавлен `STATICFILES_DIRS` для обслуживания CSS/JS

**Важно:** Все существующие API endpoints остались без изменений и работают как прежде!

## Быстрая проверка бэкенда

### Шаг 1: Проверка конфигурации Django

Откройте терминал в папке `lesson-schedule-main` и выполните:

```bash
python manage.py check
```

Если все хорошо, вы увидите:
```
System check identified no issues (0 silenced).
```

### Шаг 2: Проверка базы данных

```bash
python manage.py migrate
```

Если миграции применены:
```
Operations to perform:
  Apply all migrations: ...
Running migrations:
  No migrations to apply.
```

### Шаг 3: Запуск сервера

```bash
python manage.py runserver
```

Вы должны увидеть:
```
Starting development server at http://127.0.0.1:8000/
Quit the server with CTRL-BREAK.
```

### Шаг 4: Проверка через браузер

1. **Админка Django:** http://localhost:8000/admin/
   - Должна открыться страница входа в админку

2. **Главная страница:** http://localhost:8000/
   - Должна открыться страница входа фронтенда

3. **API demo (старая страница):** http://localhost:8000/api-demo/
   - Старая демо-страница все еще доступна

### Шаг 5: Проверка API endpoints

#### 5.1. Получение токена

Откройте консоль браузера (F12) на странице http://localhost:8000/ и выполните:

```javascript
fetch('/api/auth/token/', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({username: 'ваш_логин', password: 'ваш_пароль'})
})
.then(r => r.json())
.then(console.log)
```

Если все работает, вы получите объект с `access` и `refresh` токенами.

#### 5.2. Проверка нового endpoint `/api/auth/me/`

```javascript
// Сначала получите токен (см. выше), затем:
fetch('/api/auth/me/', {
  headers: {'Authorization': 'Bearer ВАШ_ACCESS_TOKEN'}
})
.then(r => r.json())
.then(console.log)
```

Ожидаемый ответ:
```json
{
  "id": 1,
  "username": "admin",
  "first_name": "",
  "last_name": "",
  "email": "",
  "groups": ["ADMIN_DB"],
  "role": "ADMIN_DB",
  "teacher_id": null,
  "student_id": null
}
```

#### 5.3. Проверка существующих endpoints

```javascript
// Получить список кафедр
fetch('/api/departments/', {
  headers: {'Authorization': 'Bearer ВАШ_ACCESS_TOKEN'}
})
.then(r => r.json())
.then(console.log)
```

## Что НЕ было изменено

✅ **Модели** (`core/models.py`) - без изменений
✅ **Сериализаторы** (`core/serializers.py`) - без изменений  
✅ **Права доступа** (`core/permissions.py`) - без изменений
✅ **Все существующие ViewSet'ы** - работают как прежде
✅ **Настройки базы данных** - без изменений

## Если что-то не работает

### Ошибка: "No module named 'rest_framework'"
**Решение:** Установите зависимости
```bash
pip install -r requirements.txt
```

### Ошибка: "could not connect to server"
**Решение:** Убедитесь, что PostgreSQL запущен и настройки в `.env` правильные

### Ошибка: "TemplateDoesNotExist"
**Решение:** Убедитесь, что папка `templates/` существует и содержит файлы

### Ошибка 404 на статические файлы
**Решение:** В режиме разработки (DEBUG=True) Django автоматически обслуживает статические файлы. Если проблема остается:
```bash
python manage.py collectstatic --noinput
```

## Сравнение: до и после

### До изменений:
- Главная страница: `/` → показывала `index.html` (API demo)
- API endpoints: все существующие
- Статические файлы: не настроены для фронтенда

### После изменений:
- Главная страница: `/` → показывает `login.html` (страница входа)
- API endpoints: все существующие + новый `/api/auth/me/`
- Статические файлы: настроены для обслуживания CSS/JS
- Новая страница: `/dashboard/` → главная страница приложения
- Старая страница: `/api-demo/` → все еще доступна

## Заключение

Все изменения **обратно совместимы** и не ломают существующий функционал. Бэкенд работает как прежде, просто добавлен один новый endpoint для фронтенда.

