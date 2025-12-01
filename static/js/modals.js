// Модальные окна для создания и редактирования сущностей

// Модальное окно для занятия
async function showAddLessonModal() {
  try {
    const [groups, teachers, disciplines, rooms] = await Promise.all([
      api.getGroups(),
      api.getTeachers(),
      api.getDisciplines(),
      api.getRooms(),
    ]);

    const content = `
      <form id="lessonForm" onsubmit="saveLesson(event)">
        <div class="form-group">
          <label>Группа *</label>
          <select id="lessonGroup" required>
            ${groups.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Преподаватель *</label>
          <select id="lessonTeacher" required>
            ${teachers.map(t => {
              const user = t.user;
              const name = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : '';
              return `<option value="${t.id}">${escapeHtml(name)}</option>`;
            }).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Дисциплина *</label>
          <select id="lessonDiscipline" required>
            ${disciplines.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Аудитория *</label>
          <select id="lessonRoom" required>
            ${rooms.map(r => `<option value="${r.id}">${escapeHtml(r.name)} (${r.room_type === 'lecture' ? 'Лекционная' : 'Лабораторная'}, ${r.capacity} мест)</option>`).join('')}
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

async function editLesson(id) {
  try {
    const lesson = await api.request(`/lessons/${id}/`);
    const [groups, teachers, disciplines, rooms] = await Promise.all([
      api.getGroups(),
      api.getTeachers(),
      api.getDisciplines(),
      api.getRooms(),
    ]);

    const content = `
      <form id="lessonForm" onsubmit="saveLesson(event)">
        <div class="form-group">
          <label>Группа *</label>
          <select id="lessonGroup" required>
            ${groups.map(g => `<option value="${g.id}" ${g.id === lesson.group_id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Преподаватель *</label>
          <select id="lessonTeacher" required>
            ${teachers.map(t => {
              const user = t.user;
              const name = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : '';
              return `<option value="${t.id}" ${t.id === lesson.teacher_id ? 'selected' : ''}>${escapeHtml(name)}</option>`;
            }).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Дисциплина *</label>
          <select id="lessonDiscipline" required>
            ${disciplines.map(d => `<option value="${d.id}" ${d.id === lesson.discipline_id ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Аудитория *</label>
          <select id="lessonRoom" required>
            ${rooms.map(r => `<option value="${r.id}" ${r.id === lesson.room_id ? 'selected' : ''}>${escapeHtml(r.name)} (${r.room_type === 'lecture' ? 'Лекционная' : 'Лабораторная'}, ${r.capacity} мест)</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Начало *</label>
          <input type="datetime-local" id="lessonStart" value="${toLocalDateTimeString(lesson.start_time)}" required>
        </div>
        <div class="form-group">
          <label>Окончание *</label>
          <input type="datetime-local" id="lessonEnd" value="${toLocalDateTimeString(lesson.end_time)}" required>
        </div>
        <div class="form-group">
          <label>Неделя *</label>
          <input type="number" id="lessonWeek" min="1" max="52" value="${lesson.week}" required>
        </div>
        <div class="d-flex gap-2 justify-between">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
          <button type="submit" class="btn">Сохранить</button>
        </div>
      </form>
    `;

    const modal = createModal('Редактировать занятие', content);
    window.currentLessonId = id;
  } catch (error) {
    showError('Ошибка загрузки данных: ' + error.message);
  }
}

async function saveLesson(event) {
  event.preventDefault();
  
  const formData = {
    group_id: parseInt(document.getElementById('lessonGroup').value),
    teacher_id: parseInt(document.getElementById('lessonTeacher').value),
    discipline_id: parseInt(document.getElementById('lessonDiscipline').value),
    room_id: parseInt(document.getElementById('lessonRoom').value),
    start_time: new Date(document.getElementById('lessonStart').value).toISOString(),
    end_time: new Date(document.getElementById('lessonEnd').value).toISOString(),
    week: parseInt(document.getElementById('lessonWeek').value),
  };

  try {
    if (window.currentLessonId) {
      await api.updateLesson(window.currentLessonId, formData);
      showSuccess('Занятие обновлено');
    } else {
      await api.createLesson(formData);
      showSuccess('Занятие создано');
    }
    
    document.querySelector('.modal').remove();
    if (typeof updateScheduleView === 'function') {
      updateScheduleView();
    }
  } catch (error) {
    showError('Ошибка сохранения: ' + error.message);
  }
}

// Модальные окна для других сущностей (заглушки)
async function showAddDepartmentModal() {
  const content = `
    <form onsubmit="saveEntity(event, 'departments')">
      <div class="form-group">
        <label>Название *</label>
        <input type="text" id="entityName" required>
      </div>
      <div class="d-flex gap-2 justify-between">
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
        <button type="submit" class="btn">Сохранить</button>
      </div>
    </form>
  `;
  createModal('Добавить кафедру', content);
  window.currentEntityType = 'departments';
  window.currentEntityId = null;
}

async function showAddGroupModal() {
  try {
    const departments = await api.getDepartments();
    const content = `
      <form onsubmit="saveEntity(event, 'groups')">
        <div class="form-group">
          <label>Название *</label>
          <input type="text" id="entityName" required>
        </div>
        <div class="form-group">
          <label>Кафедра *</label>
          <select id="entityDepartment" required>
            ${departments.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Год *</label>
          <input type="number" id="entityYear" min="1" max="6" required>
        </div>
        <div class="d-flex gap-2 justify-between">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
          <button type="submit" class="btn">Сохранить</button>
        </div>
      </form>
    `;
    createModal('Добавить группу', content);
    window.currentEntityType = 'groups';
    window.currentEntityId = null;
  } catch (error) {
    showError('Ошибка загрузки данных: ' + error.message);
  }
}

async function showAddDisciplineModal() {
  const content = `
    <form onsubmit="saveEntity(event, 'disciplines')">
      <div class="form-group">
        <label>Название *</label>
        <input type="text" id="entityName" required>
      </div>
      <div class="d-flex gap-2 justify-between">
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
        <button type="submit" class="btn">Сохранить</button>
      </div>
    </form>
  `;
  createModal('Добавить дисциплину', content);
  window.currentEntityType = 'disciplines';
  window.currentEntityId = null;
}

async function showAddRoomModal() {
  const content = `
    <form onsubmit="saveEntity(event, 'rooms')">
      <div class="form-group">
        <label>Название *</label>
        <input type="text" id="entityName" required>
      </div>
      <div class="form-group">
        <label>Вместимость *</label>
        <input type="number" id="entityCapacity" min="1" required>
      </div>
      <div class="form-group">
        <label>Тип *</label>
        <select id="entityRoomType" required>
          <option value="lecture">Лекционная</option>
          <option value="lab">Лабораторная</option>
        </select>
      </div>
      <div class="d-flex gap-2 justify-between">
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
        <button type="submit" class="btn">Сохранить</button>
      </div>
    </form>
  `;
  createModal('Добавить аудиторию', content);
  window.currentEntityType = 'rooms';
  window.currentEntityId = null;
}

async function saveEntity(event, entityType) {
  event.preventDefault();
  
  let formData = {};
  
  if (entityType === 'departments' || entityType === 'disciplines') {
    formData = { name: document.getElementById('entityName').value };
  } else if (entityType === 'groups') {
    formData = {
      name: document.getElementById('entityName').value,
      department_id: parseInt(document.getElementById('entityDepartment').value),
      year: parseInt(document.getElementById('entityYear').value),
    };
  } else if (entityType === 'rooms') {
    formData = {
      name: document.getElementById('entityName').value,
      capacity: parseInt(document.getElementById('entityCapacity').value),
      room_type: document.getElementById('entityRoomType').value,
    };
  }

  try {
    const apiMethod = entityType === 'departments' ? 'Department' :
                     entityType === 'groups' ? 'Group' :
                     entityType === 'disciplines' ? 'Discipline' :
                     entityType === 'rooms' ? 'Room' : null;
    
    if (!apiMethod) {
      showError('Неизвестный тип сущности');
      return;
    }

    const createMethod = `create${apiMethod}`;
    const updateMethod = `update${apiMethod}`;

    if (window.currentEntityId) {
      await api[updateMethod](window.currentEntityId, formData);
      showSuccess('Данные обновлены');
    } else {
      await api[createMethod](formData);
      showSuccess('Данные созданы');
    }
    
    const modal = event.target.closest('.modal');
    if (modal) modal.remove();
    
    if (typeof manageEntity === 'function') {
      manageEntity(entityType);
    }
  } catch (error) {
    showError('Ошибка сохранения: ' + error.message);
  }
}

// Функции редактирования для всех сущностей
async function editDepartment(id) {
  try {
    const dept = await api.request(`/departments/${id}/`);
    const content = `
      <form onsubmit="saveEntity(event, 'departments')">
        <div class="form-group">
          <label>Название *</label>
          <input type="text" id="entityName" value="${escapeHtml(dept.name)}" required>
        </div>
        <div class="d-flex gap-2 justify-between">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
          <button type="submit" class="btn">Сохранить</button>
        </div>
      </form>
    `;
    createModal('Редактировать кафедру', content);
    window.currentEntityType = 'departments';
    window.currentEntityId = id;
  } catch (error) {
    showError('Ошибка загрузки данных: ' + error.message);
  }
}

async function editGroup(id) {
  try {
    const group = await api.request(`/groups/${id}/`);
    const departments = await api.getDepartments();
    const content = `
      <form onsubmit="saveEntity(event, 'groups')">
        <div class="form-group">
          <label>Название *</label>
          <input type="text" id="entityName" value="${escapeHtml(group.name)}" required>
        </div>
        <div class="form-group">
          <label>Кафедра *</label>
          <select id="entityDepartment" required>
            ${departments.map(d => `<option value="${d.id}" ${d.id === group.department_id ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Год *</label>
          <input type="number" id="entityYear" min="1" max="6" value="${group.year}" required>
        </div>
        <div class="d-flex gap-2 justify-between">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
          <button type="submit" class="btn">Сохранить</button>
        </div>
      </form>
    `;
    createModal('Редактировать группу', content);
    window.currentEntityType = 'groups';
    window.currentEntityId = id;
  } catch (error) {
    showError('Ошибка загрузки данных: ' + error.message);
  }
}

async function editDiscipline(id) {
  try {
    const disc = await api.request(`/disciplines/${id}/`);
    const content = `
      <form onsubmit="saveEntity(event, 'disciplines')">
        <div class="form-group">
          <label>Название *</label>
          <input type="text" id="entityName" value="${escapeHtml(disc.name)}" required>
        </div>
        <div class="d-flex gap-2 justify-between">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
          <button type="submit" class="btn">Сохранить</button>
        </div>
      </form>
    `;
    createModal('Редактировать дисциплину', content);
    window.currentEntityType = 'disciplines';
    window.currentEntityId = id;
  } catch (error) {
    showError('Ошибка загрузки данных: ' + error.message);
  }
}

async function editRoom(id) {
  try {
    const room = await api.request(`/rooms/${id}/`);
    const content = `
      <form onsubmit="saveEntity(event, 'rooms')">
        <div class="form-group">
          <label>Название *</label>
          <input type="text" id="entityName" value="${escapeHtml(room.name)}" required>
        </div>
        <div class="form-group">
          <label>Вместимость *</label>
          <input type="number" id="entityCapacity" min="1" value="${room.capacity}" required>
        </div>
        <div class="form-group">
          <label>Тип *</label>
          <select id="entityRoomType" required>
            <option value="lecture" ${room.room_type === 'lecture' ? 'selected' : ''}>Лекционная</option>
            <option value="lab" ${room.room_type === 'lab' ? 'selected' : ''}>Лабораторная</option>
          </select>
        </div>
        <div class="d-flex gap-2 justify-between">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
          <button type="submit" class="btn">Сохранить</button>
        </div>
      </form>
    `;
    createModal('Редактировать аудиторию', content);
    window.currentEntityType = 'rooms';
    window.currentEntityId = id;
  } catch (error) {
    showError('Ошибка загрузки данных: ' + error.message);
  }
}

// Экспорт функций в глобальную область
window.showAddLessonModal = showAddLessonModal;
window.editLesson = editLesson;
window.saveLesson = saveLesson;
window.showAddDepartmentModal = showAddDepartmentModal;
window.showAddGroupModal = showAddGroupModal;
window.showAddDisciplineModal = showAddDisciplineModal;
window.showAddRoomModal = showAddRoomModal;
window.saveEntity = saveEntity;
window.editDepartment = editDepartment;
window.editGroup = editGroup;
window.editDiscipline = editDiscipline;
window.editRoom = editRoom;

