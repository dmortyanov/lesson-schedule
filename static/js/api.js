// API клиент для работы с backend
class ApiClient {
  constructor() {
    this.baseURL = '/api';
    this.token = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  async request(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        ...options,
        headers,
      });

      // Если токен истек, пытаемся обновить
      if (response.status === 401 && this.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${this.token}`;
          return fetch(`${this.baseURL}${url}`, { ...options, headers });
        } else {
          this.logout();
          throw new Error('Сессия истекла. Пожалуйста, войдите снова.');
        }
      }

      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        throw new Error(data.detail || data.message || `Ошибка ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async refreshAccessToken() {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setTokens(data.access, this.refreshToken);
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    return false;
  }

  setTokens(access, refresh) {
    this.token = access;
    this.refreshToken = refresh;
    if (access) localStorage.setItem('accessToken', access);
    if (refresh) localStorage.setItem('refreshToken', refresh);
  }

  clearTokens() {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  logout() {
    this.clearTokens();
    localStorage.removeItem('userRole');
    // Небольшая задержка для лучшего UX
    setTimeout(() => {
      window.location.href = '/';
    }, 100);
  }

  // Аутентификация
  async login(username, password) {
    const data = await this.request('/auth/token/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setTokens(data.access, data.refresh);
    return data;
  }

  // Регистрация нового пользователя
  async register(userData) {
    // Регистрация не требует токена, поэтому используем fetch напрямую
    const response = await fetch(`${this.baseURL}/auth/register/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      // Обработка ошибок валидации Django REST Framework
      const errorMessages = [];
      if (typeof data === 'object' && data !== null) {
        // Обрабатываем ошибки полей
        for (const [field, errors] of Object.entries(data)) {
          if (Array.isArray(errors)) {
            errorMessages.push(...errors);
          } else if (typeof errors === 'string') {
            errorMessages.push(errors);
          } else {
            errorMessages.push(`${field}: ${JSON.stringify(errors)}`);
          }
        }
      }
      
      const errorMsg = errorMessages.length > 0 
        ? errorMessages.join(', ')
        : (data.detail || data.message || `Ошибка ${response.status}`);
      
      throw new Error(errorMsg);
    }
    
    return data;
  }

  // Получить информацию о текущем пользователе
  async getCurrentUser() {
    return this.request('/auth/me/');
  }

  // Кафедры
  async getDepartments() {
    return this.request('/departments/');
  }

  async createDepartment(data) {
    return this.request('/departments/', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateDepartment(id, data) {
    return this.request(`/departments/${id}/`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteDepartment(id) {
    return this.request(`/departments/${id}/`, { method: 'DELETE' });
  }

  // Группы
  async getGroups() {
    return this.request('/groups/');
  }

  async createGroup(data) {
    return this.request('/groups/', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateGroup(id, data) {
    return this.request(`/groups/${id}/`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteGroup(id) {
    return this.request(`/groups/${id}/`, { method: 'DELETE' });
  }

  // Преподаватели
  async getTeachers() {
    return this.request('/teachers/');
  }

  async createTeacher(data) {
    return this.request('/teachers/', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateTeacher(id, data) {
    return this.request(`/teachers/${id}/`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteTeacher(id) {
    return this.request(`/teachers/${id}/`, { method: 'DELETE' });
  }

  // Студенты
  async getStudents() {
    return this.request('/students/');
  }

  async createStudent(data) {
    return this.request('/students/', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateStudent(id, data) {
    return this.request(`/students/${id}/`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteStudent(id) {
    return this.request(`/students/${id}/`, { method: 'DELETE' });
  }

  // Дисциплины
  async getDisciplines() {
    return this.request('/disciplines/');
  }

  async createDiscipline(data) {
    return this.request('/disciplines/', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateDiscipline(id, data) {
    return this.request(`/disciplines/${id}/`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteDiscipline(id) {
    return this.request(`/disciplines/${id}/`, { method: 'DELETE' });
  }

  // Аудитории
  async getRooms() {
    return this.request('/rooms/');
  }

  async getFreeRooms(start, end, type = null, capacity = null) {
    const params = new URLSearchParams({ start, end });
    if (type) params.append('type', type);
    if (capacity) params.append('capacity', capacity);
    return this.request(`/rooms/free/?${params.toString()}`);
  }

  async createRoom(data) {
    return this.request('/rooms/', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateRoom(id, data) {
    return this.request(`/rooms/${id}/`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteRoom(id) {
    return this.request(`/rooms/${id}/`, { method: 'DELETE' });
  }

  // Занятия
  async getLessons() {
    return this.request('/lessons/');
  }

  async getLessonsByGroup(groupId, week = null) {
    const params = new URLSearchParams({ group_id: groupId });
    if (week) params.append('week', week);
    return this.request(`/lessons/by_group/?${params.toString()}`);
  }

  async getLessonsByTeacher(teacherId, week = null) {
    const params = new URLSearchParams({ teacher_id: teacherId });
    if (week) params.append('week', week);
    return this.request(`/lessons/by_teacher/?${params.toString()}`);
  }

  async getLessonsByRoom(roomId, week = null) {
    const params = new URLSearchParams({ room_id: roomId });
    if (week) params.append('week', week);
    return this.request(`/lessons/by_room/?${params.toString()}`);
  }

  async createLesson(data) {
    return this.request('/lessons/', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateLesson(id, data) {
    return this.request(`/lessons/${id}/`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteLesson(id) {
    return this.request(`/lessons/${id}/`, { method: 'DELETE' });
  }
}

// Глобальный экземпляр API клиента
const api = new ApiClient();

