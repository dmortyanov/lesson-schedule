// Управление аутентификацией и ролями
class AuthManager {
  constructor() {
    this.user = null;
    this.roles = [];
  }

  async checkAuth() {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      return false;
    }

    // Проверяем, есть ли токен и валиден ли он
    // В реальном приложении здесь можно декодировать JWT и получить информацию о пользователе
    // Пока используем простую проверку наличия токена
    return true;
  }

  getUserRole() {
    // В реальном приложении роль должна приходить с бэкенда
    // Пока используем проверку через попытку доступа к админским endpoints
    // Это временное решение - лучше добавить endpoint /api/auth/me/
    return localStorage.getItem('userRole') || 'STUDENT';
  }

  setUserRole(role) {
    localStorage.setItem('userRole', role);
    this.roles = [role];
  }

  isAdmin() {
    return this.getUserRole() === 'ADMIN_DB';
  }

  isTeacher() {
    return this.getUserRole() === 'TEACHER';
  }

  isStudent() {
    return this.getUserRole() === 'STUDENT';
  }

  canEditLessons() {
    return this.isAdmin() || this.isTeacher();
  }

  canManageUsers() {
    return this.isAdmin();
  }

  canEditAllLessons() {
    return this.isAdmin();
  }

  async detectRole() {
    try {
      const userInfo = await api.getCurrentUser();
      if (userInfo && userInfo.role) {
        this.setUserRole(userInfo.role);
        this.user = userInfo;
        return userInfo.role;
      }
      return 'STUDENT';
    } catch (error) {
      console.error('Error detecting role:', error);
      return 'STUDENT';
    }
  }
}

const auth = new AuthManager();

