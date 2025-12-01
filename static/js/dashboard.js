// Dashboard инициализация и управление страницами

document.addEventListener('DOMContentLoaded', async function() {
  console.log('Dashboard initializing...');
  
  try {
    // Загружаем информацию о пользователе
    await loadUserInfo();
    
    // Инициализируем навигацию
    initNavigation();
    
    // Загружаем начальную страницу (расписание)
    await loadPage('schedule');
    
  } catch (error) {
    console.error('Dashboard initialization error:', error);
    showError('Ошибка инициализации: ' + error.message);
  }
});

// Загрузка информации о пользователе
async function loadUserInfo() {
  try {
    const userInfo = await api.getCurrentUser();
    const userInfoElement = document.getElementById('userInfo');
    
    if (userInfoElement) {
      const displayName = userInfo.first_name && userInfo.last_name
        ? `${userInfo.first_name} ${userInfo.last_name}`
        : userInfo.username || 'Пользователь';
      userInfoElement.textContent = displayName;
    }
    
    // Определяем роль и настраиваем интерфейс
    if (userInfo.role) {
      auth.setUserRole(userInfo.role);
      
      // Показываем/скрываем кнопку управления в зависимости от роли
      const manageNavItem = document.getElementById('manageNavItem');
      if (manageNavItem && (userInfo.role === 'ADMIN_DB' || userInfo.role === 'TEACHER')) {
        manageNavItem.classList.remove('hidden');
      }
    }
  } catch (error) {
    console.error('Error loading user info:', error);
    // Если ошибка авторизации, перенаправляем на страницу входа
    if (error.message && (error.message.includes('401') || error.message.includes('авториз'))) {
      alert('Сессия истекла. Пожалуйста, войдите снова.');
      api.logout();
      return;
    }
    // Не блокируем загрузку, если не удалось загрузить информацию о пользователе
  }
}

// Инициализация навигации
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link[data-page]');
  
  navLinks.forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      
      // Обновляем активное состояние
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      // Загружаем страницу
      const page = link.getAttribute('data-page');
      await loadPage(page);
    });
  });
}

// Загрузка страницы
async function loadPage(page) {
  const content = document.getElementById('content');
  if (!content) return;
  
  try {
    content.innerHTML = '<div class="loading"><div class="spinner"></div><p>Загрузка...</p></div>';
    
    switch (page) {
      case 'schedule':
        await loadSchedulePage();
        break;
      case 'search':
        await loadSearchPage();
        break;
      case 'manage':
        await loadManagePage();
        break;
      case 'rooms':
        await loadRoomsPage();
        break;
      default:
        content.innerHTML = '<div class="alert alert-info">Страница не найдена</div>';
    }
  } catch (error) {
    console.error(`Error loading page ${page}:`, error);
    content.innerHTML = `<div class="alert alert-error">Ошибка загрузки: ${error.message}</div>`;
  }
}

// Загрузка страницы расписания
async function loadSchedulePage() {
  const content = document.getElementById('content');
  
  try {
    // Проверяем наличие токена перед запросом
    const token = localStorage.getItem('accessToken');
    if (!token) {
      content.innerHTML = '<div class="alert alert-error">Сессия истекла. Пожалуйста, <a href="/?expired=true">войдите снова</a>.</div>';
      return;
    }
    
    // Загружаем группы для выбора
    const groups = await api.getGroups();
    
    // Простой интерфейс для просмотра расписания
    let html = `
      <div class="card">
        <h2>Расписание занятий</h2>
        <div class="form-group">
          <label for="groupSelect">Выберите группу:</label>
          <select id="groupSelect" class="form-control">
            <option value="">-- Выберите группу --</option>
            ${groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
          </select>
        </div>
        <div id="scheduleContent" style="margin-top: 20px;"></div>
      </div>
    `;
    
    content.innerHTML = html;
    
    // Обработчик выбора группы
    const groupSelect = document.getElementById('groupSelect');
    if (groupSelect) {
      groupSelect.addEventListener('change', async (e) => {
        const groupId = e.target.value;
        if (groupId) {
          await loadGroupSchedule(groupId);
        } else {
          document.getElementById('scheduleContent').innerHTML = '';
        }
      });
    }
  } catch (error) {
    // Проверяем, не ошибка ли авторизации
    if (error.message && (error.message.includes('401') || error.message.includes('Учетные данные') || error.message.includes('авториз'))) {
      content.innerHTML = '<div class="alert alert-error">Сессия истекла. Пожалуйста, <a href="/?expired=true">войдите снова</a>.</div>';
    } else if (error.message && error.message.includes('404')) {
      content.innerHTML = '<div class="alert alert-info">База данных пуста. Сначала добавьте данные через админ-панель.</div>';
    } else {
      content.innerHTML = `<div class="alert alert-error">Ошибка загрузки: ${error.message || 'Неизвестная ошибка'}</div>`;
    }
  }
}

// Загрузка расписания группы
async function loadGroupSchedule(groupId) {
  const scheduleContent = document.getElementById('scheduleContent');
  if (!scheduleContent) return;
  
  try {
    scheduleContent.innerHTML = '<div class="loading"><div class="spinner"></div><p>Загрузка расписания...</p></div>';
    
    const lessons = await api.getLessonsByGroup(groupId);
    
    if (lessons.length === 0) {
      scheduleContent.innerHTML = '<div class="alert alert-info">Расписание не найдено</div>';
      return;
    }
    
    // Группируем занятия по дням
    const scheduleByDay = {};
    lessons.forEach(lesson => {
      const date = new Date(lesson.start_time);
      const dateKey = date.toLocaleDateString('ru-RU');
      if (!scheduleByDay[dateKey]) {
        scheduleByDay[dateKey] = { date: date, lessons: [] };
      }
      scheduleByDay[dateKey].lessons.push(lesson);
    });
    
    // Функция для форматирования имени преподавателя в "Фамилия И.О."
    function formatTeacherName(user) {
      if (!user) return 'Преподаватель';
      const lastName = user.last_name || '';
      const firstName = user.first_name || '';
      if (lastName && firstName) {
        const firstInitial = firstName.charAt(0).toUpperCase() + '.';
        const middleInitial = ''; // Если есть отчество, можно добавить
        return `${lastName} ${firstInitial}${middleInitial}`.trim();
      }
      return `${firstName} ${lastName}`.trim() || user.username || 'Преподаватель';
    }
    
    // Отображаем расписание
    let html = '<div class="schedule-list">';
    Object.keys(scheduleByDay).sort().forEach(dateKey => {
      const dayData = scheduleByDay[dateKey];
      const date = dayData.date;
      
      // Получаем название дня недели
      const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
      const dayName = dayNames[date.getDay()];
      
      html += `<h3 class="schedule-day-title">${dayName}</h3>`;
      html += '<div class="schedule-day-lessons">';
      
      // Сортируем занятия по времени
      dayData.lessons.sort((a, b) => {
        return new Date(a.start_time) - new Date(b.start_time);
      });
      
      dayData.lessons.forEach(lesson => {
        const startDate = new Date(lesson.start_time);
        const endDate = new Date(lesson.end_time);
        
        // Форматируем время в формат "ЧЧ:ММ"
        const formatTime = (date) => {
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          return `${hours}:${minutes}`;
        };
        
        const startTime = formatTime(startDate);
        const endTime = formatTime(endDate);
        
        const disciplineName = lesson.discipline?.name || 'Дисциплина';
        const roomName = lesson.room?.name || 'Аудитория';
        const roomType = lesson.room?.room_type || 'lecture';
        const lessonType = roomType === 'lecture' ? 'лк' : 'лб';
        
        const teacherName = formatTeacherName(lesson.teacher?.user);
        
        html += `
          <div class="lesson-card">
            <div class="lesson-time">${startTime}<br>${endTime}</div>
            <div class="lesson-details">
              ${escapeHtml(lessonType)}, ${escapeHtml(roomName)}, ${escapeHtml(teacherName)}, ${escapeHtml(disciplineName)}, поток
            </div>
          </div>
        `;
      });
      
      html += '</div>';
    });
    html += '</div>';
    
    scheduleContent.innerHTML = html;
  } catch (error) {
    scheduleContent.innerHTML = `<div class="alert alert-error">Ошибка загрузки расписания: ${error.message}</div>`;
  }
}

// Загрузка страницы поиска
async function loadSearchPage() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card">
      <h2>Поиск</h2>
      <p>Функционал поиска в разработке...</p>
    </div>
  `;
}

// Загрузка страницы управления
async function loadManagePage() {
  const content = document.getElementById('content');
  
  if (!auth.canEditLessons()) {
    content.innerHTML = '<div class="alert alert-error">У вас нет прав доступа к этой странице</div>';
    return;
  }
  
  content.innerHTML = `
    <div class="card">
      <h2>Управление</h2>
      <p>Панель управления в разработке...</p>
    </div>
  `;
}

// Загрузка страницы аудиторий
async function loadRoomsPage() {
  const content = document.getElementById('content');
  
  try {
    // Проверяем наличие токена перед запросом
    const token = localStorage.getItem('accessToken');
    if (!token) {
      content.innerHTML = '<div class="alert alert-error">Сессия истекла. Пожалуйста, <a href="/?expired=true">войдите снова</a>.</div>';
      return;
    }
    
    const rooms = await api.getRooms();
    
    let html = `
      <div class="card">
        <h2>Аудитории</h2>
        <div class="rooms-list">
    `;
    
    if (rooms.length === 0) {
      html += '<p>Аудитории не найдены</p>';
    } else {
      rooms.forEach(room => {
        html += `
          <div class="room-item">
            <strong>${room.name}</strong><br>
            Тип: ${room.room_type || 'Не указан'} | Вместимость: ${room.capacity || 'Не указана'}
          </div>
        `;
      });
    }
    
    html += '</div></div>';
    content.innerHTML = html;
  } catch (error) {
    // Проверяем, не ошибка ли авторизации
    if (error.message && (error.message.includes('401') || error.message.includes('Учетные данные') || error.message.includes('авториз'))) {
      content.innerHTML = '<div class="alert alert-error">Сессия истекла. Пожалуйста, <a href="/?expired=true">войдите снова</a>.</div>';
    } else if (error.message && error.message.includes('404')) {
      content.innerHTML = '<div class="alert alert-info">База данных пуста. Сначала добавьте данные через админ-панель.</div>';
    } else {
      content.innerHTML = `<div class="alert alert-error">Ошибка загрузки: ${error.message || 'Неизвестная ошибка'}</div>`;
    }
  }
}

// Показать ошибку
function showError(message) {
  const content = document.getElementById('content');
  if (content) {
    content.innerHTML = `<div class="alert alert-error">${escapeHtml(message)}</div>`;
  }
}

