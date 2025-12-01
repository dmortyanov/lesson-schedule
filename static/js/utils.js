// Утилиты для работы с датами, форматированием и т.д.

// Форматирование даты и времени
function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Получить номер недели от начала года
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

// Получить дату начала недели
function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Понедельник
  return new Date(d.setDate(diff));
}

// Получить дату конца недели
function getWeekEnd(date = new Date()) {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

// Преобразовать ISO строку в формат для input[type="datetime-local"]
function toLocalDateTimeString(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Показать уведомление
function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  
  const container = document.querySelector('.container') || document.body;
  container.insertBefore(alertDiv, container.firstChild);
  
  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}

// Показать ошибку
function showError(message) {
  showAlert(message, 'error');
}

// Показать успех
function showSuccess(message) {
  showAlert(message, 'success');
}

// Показать предупреждение
function showWarning(message) {
  showAlert(message, 'warning');
}

// Создать модальное окно
function createModal(title, content, onClose = null) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      <div class="modal-body">
        ${content}
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (onClose) onClose();
      modal.remove();
    }
  });

  const closeBtn = modal.querySelector('.modal-close');
  closeBtn.addEventListener('click', () => {
    if (onClose) onClose();
    modal.remove();
  });

  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('active'), 10);
  
  return modal;
}

// Создать таблицу расписания
function createScheduleTable(lessons, options = {}) {
  const { showGroup = true, showTeacher = true, showRoom = true, showDiscipline = true } = options;
  
  if (!lessons || lessons.length === 0) {
    return '<p class="text-center">Нет занятий</p>';
  }

  let html = '<div class="table-wrapper"><table class="schedule-table"><thead><tr>';
  
  if (showDiscipline) html += '<th>Дисциплина</th>';
  if (showGroup) html += '<th>Группа</th>';
  if (showTeacher) html += '<th>Преподаватель</th>';
  if (showRoom) html += '<th>Аудитория</th>';
  html += '<th>Дата и время</th>';
  html += '<th>Неделя</th>';
  if (auth.canEditLessons()) html += '<th>Действия</th>';
  
  html += '</tr></thead><tbody>';

  lessons.forEach(lesson => {
    html += '<tr>';
    if (showDiscipline) html += `<td>${escapeHtml(lesson.discipline?.name || '')}</td>`;
    if (showGroup) html += `<td>${escapeHtml(lesson.group?.name || '')}</td>`;
    if (showTeacher) {
      const teacher = lesson.teacher?.user;
      const teacherName = teacher ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.username : '';
      html += `<td>${escapeHtml(teacherName)}</td>`;
    }
    if (showRoom) html += `<td>${escapeHtml(lesson.room?.name || '')}</td>`;
    html += `<td>${formatDateTime(lesson.start_time)} - ${formatTime(lesson.end_time)}</td>`;
    html += `<td>${lesson.week || ''}</td>`;
    
    if (auth.canEditLessons()) {
      html += '<td>';
      if (auth.canEditAllLessons() || (auth.isTeacher() && lesson.teacher?.id)) {
        html += `<button class="btn btn-small" onclick="editLesson(${lesson.id})">Редактировать</button> `;
        if (auth.canEditAllLessons()) {
          html += `<button class="btn btn-small btn-danger" onclick="deleteLesson(${lesson.id})">Удалить</button>`;
        }
      }
      html += '</td>';
    }
    
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

// Экранирование HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Загрузка данных с индикатором
async function loadWithSpinner(loader, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Загрузка...</p></div>';
  
  try {
    const data = await loader();
    return data;
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Ошибка загрузки: ${error.message}</div>`;
    throw error;
  }
}

