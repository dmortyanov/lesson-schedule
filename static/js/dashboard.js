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
  
  try {
    // Загружаем данные для выпадающих списков
    const [groups, teachers, rooms] = await Promise.all([
      api.getGroups().catch(() => []),
      api.getTeachers().catch(() => []),
      api.getRooms().catch(() => [])
    ]);

  content.innerHTML = `
    <div class="card">
      <h2>Поиск</h2>
        
        <!-- Поиск занятий по группе -->
        <div class="search-section">
          <h3>Поиск занятий по группе</h3>
          <form id="searchByGroupForm" class="search-form">
            <div class="form-group">
              <label for="searchGroup">Группа:</label>
              <select id="searchGroup" class="form-control" required>
                <option value="">Выберите группу</option>
                ${groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="searchGroupWeek">Неделя (опционально):</label>
              <input type="number" id="searchGroupWeek" class="form-control" min="1" placeholder="Номер недели">
            </div>
            <div class="form-group">
              <label for="searchGroupStartDate">Начальная дата (опционально):</label>
              <input type="datetime-local" id="searchGroupStartDate" class="form-control">
            </div>
            <div class="form-group">
              <label for="searchGroupEndDate">Конечная дата (опционально):</label>
              <input type="datetime-local" id="searchGroupEndDate" class="form-control">
            </div>
            <button type="submit" class="btn btn-primary">Найти</button>
          </form>
          <div id="searchGroupResults" class="search-results"></div>
        </div>

        <!-- Поиск занятий по преподавателю -->
        <div class="search-section">
          <h3>Поиск занятий по преподавателю</h3>
          <form id="searchByTeacherForm" class="search-form">
            <div class="form-group">
              <label for="searchTeacher">Преподаватель:</label>
              <select id="searchTeacher" class="form-control" required>
                <option value="">Выберите преподавателя</option>
                ${teachers.map(t => `<option value="${t.id}">${t.user.first_name} ${t.user.last_name} (${t.user.username})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="searchTeacherWeek">Неделя (опционально):</label>
              <input type="number" id="searchTeacherWeek" class="form-control" min="1" placeholder="Номер недели">
            </div>
            <div class="form-group">
              <label for="searchTeacherStartDate">Начальная дата (опционально):</label>
              <input type="datetime-local" id="searchTeacherStartDate" class="form-control">
            </div>
            <div class="form-group">
              <label for="searchTeacherEndDate">Конечная дата (опционально):</label>
              <input type="datetime-local" id="searchTeacherEndDate" class="form-control">
            </div>
            <button type="submit" class="btn btn-primary">Найти</button>
          </form>
          <div id="searchTeacherResults" class="search-results"></div>
        </div>

        <!-- Поиск занятий по аудитории -->
        <div class="search-section">
          <h3>Поиск занятий по аудитории</h3>
          <form id="searchByRoomForm" class="search-form">
            <div class="form-group">
              <label for="searchRoom">Аудитория:</label>
              <select id="searchRoom" class="form-control" required>
                <option value="">Выберите аудиторию</option>
                ${rooms.map(r => `<option value="${r.id}">${r.name} (${r.room_type === 'lecture' ? 'Лекционная' : 'Лабораторная'}, ${r.capacity} мест)</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="searchRoomWeek">Неделя (опционально):</label>
              <input type="number" id="searchRoomWeek" class="form-control" min="1" placeholder="Номер недели">
            </div>
            <div class="form-group">
              <label for="searchRoomStartDate">Начальная дата (опционально):</label>
              <input type="datetime-local" id="searchRoomStartDate" class="form-control">
            </div>
            <div class="form-group">
              <label for="searchRoomEndDate">Конечная дата (опционально):</label>
              <input type="datetime-local" id="searchRoomEndDate" class="form-control">
            </div>
            <button type="submit" class="btn btn-primary">Найти</button>
          </form>
          <div id="searchRoomResults" class="search-results"></div>
        </div>

        <!-- Поиск свободных аудиторий -->
        <div class="search-section">
          <h3>Поиск свободных аудиторий</h3>
          <form id="searchFreeRoomsForm" class="search-form">
            <div class="form-group">
              <label for="freeRoomsStart">Начальное время:</label>
              <input type="datetime-local" id="freeRoomsStart" class="form-control" required>
            </div>
            <div class="form-group">
              <label for="freeRoomsEnd">Конечное время:</label>
              <input type="datetime-local" id="freeRoomsEnd" class="form-control" required>
            </div>
            <div class="form-group">
              <label for="freeRoomsType">Тип аудитории (опционально):</label>
              <select id="freeRoomsType" class="form-control">
                <option value="">Все типы</option>
                <option value="lecture">Лекционная</option>
                <option value="lab">Лабораторная</option>
              </select>
            </div>
            <div class="form-group">
              <label for="freeRoomsCapacity">Минимальная вместимость (опционально):</label>
              <input type="number" id="freeRoomsCapacity" class="form-control" min="1" placeholder="Количество мест">
            </div>
            <button type="submit" class="btn btn-primary">Найти</button>
          </form>
          <div id="searchFreeRoomsResults" class="search-results"></div>
        </div>
      </div>
    `;

    // Привязываем обработчики форм
    setupSearchForms();
  } catch (error) {
    console.error('Error loading search page:', error);
    content.innerHTML = `<div class="alert alert-error">Ошибка загрузки страницы поиска: ${error.message}</div>`;
  }
}

// Настройка обработчиков форм поиска
function setupSearchForms() {
  // Поиск по группе
  document.getElementById('searchByGroupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const groupId = document.getElementById('searchGroup').value;
    const week = document.getElementById('searchGroupWeek').value;
    const startDate = document.getElementById('searchGroupStartDate').value;
    const endDate = document.getElementById('searchGroupEndDate').value;
    const resultsDiv = document.getElementById('searchGroupResults');
    
    resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Поиск...</p></div>';
    
    try {
      let params = new URLSearchParams({ group_id: groupId });
      if (week) params.append('week', week);
      if (startDate) params.append('start_date', new Date(startDate).toISOString());
      if (endDate) params.append('end_date', new Date(endDate).toISOString());
      
      const data = await api.request(`/lessons/by_group/?${params.toString()}`);
      displayLessonsResults(resultsDiv, data);
    } catch (error) {
      resultsDiv.innerHTML = `<div class="alert alert-error">Ошибка: ${error.message}</div>`;
    }
  });

  // Поиск по преподавателю
  document.getElementById('searchByTeacherForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const teacherId = document.getElementById('searchTeacher').value;
    const week = document.getElementById('searchTeacherWeek').value;
    const startDate = document.getElementById('searchTeacherStartDate').value;
    const endDate = document.getElementById('searchTeacherEndDate').value;
    const resultsDiv = document.getElementById('searchTeacherResults');
    
    resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Поиск...</p></div>';
    
    try {
      let params = new URLSearchParams({ teacher_id: teacherId });
      if (week) params.append('week', week);
      if (startDate) params.append('start_date', new Date(startDate).toISOString());
      if (endDate) params.append('end_date', new Date(endDate).toISOString());
      
      const data = await api.request(`/lessons/by_teacher/?${params.toString()}`);
      displayLessonsResults(resultsDiv, data);
    } catch (error) {
      resultsDiv.innerHTML = `<div class="alert alert-error">Ошибка: ${error.message}</div>`;
    }
  });

  // Поиск по аудитории
  document.getElementById('searchByRoomForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const roomId = document.getElementById('searchRoom').value;
    const week = document.getElementById('searchRoomWeek').value;
    const startDate = document.getElementById('searchRoomStartDate').value;
    const endDate = document.getElementById('searchRoomEndDate').value;
    const resultsDiv = document.getElementById('searchRoomResults');
    
    resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Поиск...</p></div>';
    
    try {
      let params = new URLSearchParams({ room_id: roomId });
      if (week) params.append('week', week);
      if (startDate) params.append('start_date', new Date(startDate).toISOString());
      if (endDate) params.append('end_date', new Date(endDate).toISOString());
      
      const data = await api.request(`/lessons/by_room/?${params.toString()}`);
      displayLessonsResults(resultsDiv, data);
    } catch (error) {
      resultsDiv.innerHTML = `<div class="alert alert-error">Ошибка: ${error.message}</div>`;
    }
  });

  // Поиск свободных аудиторий
  document.getElementById('searchFreeRoomsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const start = document.getElementById('freeRoomsStart').value;
    const end = document.getElementById('freeRoomsEnd').value;
    const type = document.getElementById('freeRoomsType').value;
    const capacity = document.getElementById('freeRoomsCapacity').value;
    const resultsDiv = document.getElementById('searchFreeRoomsResults');
    
    resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Поиск...</p></div>';
    
    try {
      let params = new URLSearchParams({
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString()
      });
      if (type) params.append('type', type);
      if (capacity) params.append('capacity', capacity);
      
      const data = await api.request(`/rooms/free/?${params.toString()}`);
      displayFreeRoomsResults(resultsDiv, data);
    } catch (error) {
      resultsDiv.innerHTML = `<div class="alert alert-error">Ошибка: ${error.message}</div>`;
    }
  });
}

// Отображение результатов поиска занятий
function displayLessonsResults(container, data) {
  if (!data.lessons || data.lessons.length === 0) {
    container.innerHTML = '<div class="alert alert-info">Занятия не найдены</div>';
    return;
  }

  let html = `<div class="search-results-header">
    <h4>Найдено занятий: ${data.count || data.lessons.length}</h4>
  </div>`;
  
  if (data.group) {
    html += `<p><strong>Группа:</strong> ${data.group.name}</p>`;
  }
  if (data.teacher) {
    html += `<p><strong>Преподаватель:</strong> ${data.teacher.name}</p>`;
  }
  if (data.room) {
    html += `<p><strong>Аудитория:</strong> ${data.room.name} (${data.room.room_type === 'lecture' ? 'Лекционная' : 'Лабораторная'}, ${data.room.capacity} мест)</p>`;
  }

  html += '<div class="lessons-list">';
  data.lessons.forEach(lesson => {
    const startTime = new Date(lesson.start_time);
    const endTime = new Date(lesson.end_time);
    html += `
      <div class="lesson-card">
        <div class="lesson-header">
          <strong>${lesson.discipline.name}</strong>
          <span class="lesson-week">Неделя ${lesson.week}</span>
        </div>
        <div class="lesson-details">
          <p><strong>Группа:</strong> ${lesson.group.name}</p>
          <p><strong>Преподаватель:</strong> ${lesson.teacher.user.first_name} ${lesson.teacher.user.last_name}</p>
          <p><strong>Аудитория:</strong> ${lesson.room.name} (${lesson.room.room_type === 'lecture' ? 'Лекционная' : 'Лабораторная'})</p>
          <p><strong>Время:</strong> ${startTime.toLocaleString('ru-RU')} - ${endTime.toLocaleString('ru-RU')}</p>
        </div>
      </div>
    `;
  });
  html += '</div>';
  
  container.innerHTML = html;
}

// Отображение результатов поиска свободных аудиторий
function displayFreeRoomsResults(container, data) {
  // Обработка пагинации
  const rooms = data.results || data.rooms || [];
  const count = data.count || rooms.length;
  
  if (rooms.length === 0) {
    container.innerHTML = '<div class="alert alert-info">Свободных аудиторий не найдено</div>';
    return;
  }

  let html = `<div class="search-results-header">
    <h4>Найдено свободных аудиторий: ${count}</h4>
  </div>`;

  html += '<div class="rooms-list">';
  rooms.forEach(room => {
    // Форматируем время для каждой аудитории
    let timeInfo = '';
    if (data.time_range) {
      const start = new Date(data.time_range.start);
      const end = new Date(data.time_range.end);
      const startStr = start.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const endStr = end.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      timeInfo = `<p class="room-time"><strong>Свободна:</strong> ${startStr} - ${endStr}</p>`;
    }
    
    html += `
      <div class="room-card">
        <div class="room-header">
          <strong>${room.name}</strong>
          <span class="room-type">${room.room_type === 'lecture' ? 'Лекционная' : 'Лабораторная'}</span>
        </div>
        <div class="room-details">
          ${timeInfo}
          <p><strong>Вместимость:</strong> ${room.capacity} мест</p>
        </div>
    </div>
  `;
  });
  html += '</div>';
  
  container.innerHTML = html;
}

// Загрузка страницы управления
async function loadManagePage() {
  const content = document.getElementById('content');
  
  if (!auth.canEditLessons()) {
    content.innerHTML = '<div class="alert alert-error">У вас нет прав доступа к этой странице</div>';
    return;
  }
  
  try {
    const userInfo = await api.getCurrentUser();
    const role = userInfo.role;
    
    if (role === 'TEACHER') {
      // Панель управления для преподавателя
      await loadTeacherManagePage(userInfo);
    } else if (role === 'ADMIN_DB') {
      // Панель управления для администратора
      await loadAdminManagePage();
    } else {
      content.innerHTML = '<div class="alert alert-error">У вас нет прав доступа к этой странице</div>';
    }
  } catch (error) {
    console.error('Error loading manage page:', error);
    content.innerHTML = `<div class="alert alert-error">Ошибка загрузки: ${error.message}</div>`;
  }
}

// Панель управления для преподавателя
async function loadTeacherManagePage(userInfo) {
  const content = document.getElementById('content');
  
  try {
    // Загружаем данные преподавателя
    const [teacherGroups, teacherDisciplines, teacherLessons, allRooms] = await Promise.all([
      api.getTeacherGroups().catch(() => ({ groups: [] })),
      api.getTeacherDisciplines().catch(() => ({ disciplines: [] })),
      api.getLessons().catch(() => []),
      api.getRooms().catch(() => [])
    ]);
    
    const groups = teacherGroups.groups || [];
    const disciplines = teacherDisciplines.disciplines || [];
    const lessons = teacherLessons.results || teacherLessons || [];
    const departmentName = teacherGroups.department_name || userInfo.teacher_department_name || 'Не указана';
    
    content.innerHTML = `
      <div class="card">
        <h2>Управление расписанием</h2>
        <div class="teacher-info">
          <p><strong>Кафедра:</strong> ${departmentName}</p>
          <p><strong>Доступные дисциплины:</strong> ${disciplines.length > 0 ? disciplines.map(d => d.name).join(', ') : 'Нет (создайте первое занятие)'}</p>
          <p><strong>Доступные группы:</strong> ${groups.length > 0 ? groups.map(g => g.name).join(', ') : 'Нет'}</p>
        </div>
        
        <div class="manage-actions">
          <button class="btn btn-primary" onclick="showAddLessonModalForTeacher()">
            ➕ Добавить занятие
          </button>
        </div>
        
        <div class="lessons-section">
          <h3>Мои занятия (${lessons.length})</h3>
          ${lessons.length === 0 
            ? '<p class="text-muted">У вас пока нет занятий. Создайте первое занятие.</p>'
            : `<div class="lessons-list">
                ${lessons.map(lesson => {
                  const startTime = new Date(lesson.start_time);
                  const endTime = new Date(lesson.end_time);
                  return `
                    <div class="lesson-card">
                      <div class="lesson-header">
                        <strong>${lesson.discipline.name}</strong>
                        <span class="lesson-week">Неделя ${lesson.week}</span>
                      </div>
                      <div class="lesson-details">
                        <p><strong>Группа:</strong> ${lesson.group.name}</p>
                        <p><strong>Аудитория:</strong> ${lesson.room.name} (${lesson.room.room_type === 'lecture' ? 'Лекционная' : 'Лабораторная'})</p>
                        <p><strong>Время:</strong> ${startTime.toLocaleString('ru-RU')} - ${endTime.toLocaleString('ru-RU')}</p>
                      </div>
                      <div class="lesson-actions">
                        <button class="btn btn-small" onclick="editLesson(${lesson.id})">✏️ Редактировать</button>
                        <button class="btn btn-small btn-danger" onclick="deleteLesson(${lesson.id})">🗑️ Удалить</button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>`
          }
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Error loading teacher manage page:', error);
    content.innerHTML = `<div class="alert alert-error">Ошибка загрузки: ${error.message}</div>`;
  }
}

// Панель управления для администратора
async function loadAdminManagePage() {
  const content = document.getElementById('content');
  
  content.innerHTML = `
    <div class="card">
      <h2>Управление</h2>
      <p>Панель управления администратора в разработке...</p>
      <p>Для полного управления используйте админ-панель Django: <a href="/admin/" target="_blank">/admin/</a></p>
    </div>
  `;
}

// Модальное окно для добавления занятия преподавателем (с ограничениями)
async function showAddLessonModalForTeacher() {
  try {
    const userInfo = await api.getCurrentUser();
    const [teacherGroups, teacherDisciplines, allRooms] = await Promise.all([
      api.getTeacherGroups().catch(() => ({ groups: [] })),
      api.getTeacherDisciplines().catch(() => ({ disciplines: [] })),
      api.getRooms().catch(() => [])
    ]);
    
    const groups = teacherGroups.groups || [];
    const disciplines = teacherDisciplines.disciplines || [];
    
    // Если у преподавателя еще нет дисциплин, показываем все (для первого занятия)
    let availableDisciplines = disciplines;
    if (disciplines.length === 0) {
      const allDisciplines = await api.getDisciplines().catch(() => []);
      availableDisciplines = allDisciplines;
    }
    
    if (groups.length === 0) {
      showError('Нет доступных групп вашей кафедры. Обратитесь к администратору.');
      return;
    }
    
    const content = `
      <form id="lessonForm" onsubmit="saveLesson(event)">
        <div class="form-group">
          <label>Группа * (только группы вашей кафедры)</label>
          <select id="lessonGroup" required>
            ${groups.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Дисциплина *</label>
          <select id="lessonDiscipline" required>
            ${availableDisciplines.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')}
          </select>
          ${disciplines.length === 0 ? '<small class="text-muted">Вы можете выбрать любую дисциплину для первого занятия</small>' : ''}
        </div>
        <div class="form-group">
          <label>Аудитория *</label>
          <select id="lessonRoom" required>
            ${allRooms.map(r => `<option value="${r.id}">${escapeHtml(r.name)} (${r.room_type === 'lecture' ? 'Лекционная' : 'Лабораторная'}, ${r.capacity} мест)</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Начало *</label>
          <input type="datetime-local" id="lessonStart" required>
        </div>
        <div class="form-group">
          <label>Окончание *</label>
          <input type="datetime-local" id="lessonEnd" required>
        </div>
        <div class="form-group">
          <label>Неделя *</label>
          <input type="number" id="lessonWeek" min="1" max="52" value="${getWeekNumber(new Date())}" required>
        </div>
        <div class="d-flex gap-2 justify-between">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
          <button type="submit" class="btn">Сохранить</button>
        </div>
      </form>
    `;

    const modal = createModal('Добавить занятие', content);
    window.currentLessonId = null;
  } catch (error) {
    showError('Ошибка загрузки данных: ' + error.message);
  }
}

// Функция удаления занятия
async function deleteLesson(id) {
  if (!confirm('Вы уверены, что хотите удалить это занятие?')) {
    return;
  }
  
  try {
    await api.deleteLesson(id);
    showSuccess('Занятие удалено');
    // Перезагружаем страницу управления
    await loadManagePage();
  } catch (error) {
    showError('Ошибка удаления: ' + error.message);
  }
}

// Экспорт функций
window.showAddLessonModalForTeacher = showAddLessonModalForTeacher;
window.deleteLesson = deleteLesson;

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

