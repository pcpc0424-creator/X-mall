/**
 * X-mall Authentication Module
 */
class Auth {
  constructor() {
    this.tokenKey = 'token';
    this.userKey = 'user';
  }

  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token) {
    localStorage.setItem(this.tokenKey, token);
  }

  removeToken() {
    localStorage.removeItem(this.tokenKey);
  }

  getUser() {
    const userStr = localStorage.getItem(this.userKey);
    return userStr ? JSON.parse(userStr) : null;
  }

  setUser(user) {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  removeUser() {
    localStorage.removeItem(this.userKey);
  }

  isLoggedIn() {
    return !!this.getToken();
  }

  isDealer() {
    const user = this.getUser();
    return user && user.grade === 'dealer';
  }

  async login(username, password) {
    const response = await authApi.login(username, password);
    if (response.success) {
      this.setToken(response.data.token);
      this.setUser(response.data.user);
    }
    return response;
  }

  async signup(data) {
    const response = await authApi.signup(data);
    if (response.success) {
      this.setToken(response.data.token);
      this.setUser(response.data.user);
    }
    return response;
  }

  logout() {
    this.removeToken();
    this.removeUser();
    // 장바구니 비우기
    localStorage.removeItem('xmall_cart');
    window.location.href = '/login.html';
  }

  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  }

  requireDealer() {
    if (!this.requireAuth()) return false;
    if (!this.isDealer()) {
      alert('대리점 회원만 이용 가능합니다.');
      window.location.href = '/index.html';
      return false;
    }
    return true;
  }
}

// Create singleton instance
const auth = new Auth();

// Update UI based on auth state
function updateAuthUI() {
  const user = auth.getUser();
  const loginLinks = document.querySelectorAll('.login-link');
  const logoutLinks = document.querySelectorAll('.logout-link');
  const userNameElements = document.querySelectorAll('.user-name');
  const userGradeElements = document.querySelectorAll('.user-grade');
  const dealerOnlyElements = document.querySelectorAll('.dealer-only');

  if (auth.isLoggedIn() && user) {
    loginLinks.forEach(el => el.style.display = 'none');
    logoutLinks.forEach(el => el.style.display = 'inline-block');
    userNameElements.forEach(el => el.textContent = user.name);
    userGradeElements.forEach(el => {
      el.textContent = user.grade === 'dealer' ? '대리점' : '소비자';
      el.className = `user-grade grade-${user.grade}`;
    });

    // Show dealer-only elements for dealers
    if (auth.isDealer()) {
      dealerOnlyElements.forEach(el => el.style.display = 'block');
    } else {
      dealerOnlyElements.forEach(el => el.style.display = 'none');
    }
  } else {
    loginLinks.forEach(el => el.style.display = 'inline-block');
    logoutLinks.forEach(el => el.style.display = 'none');
    dealerOnlyElements.forEach(el => el.style.display = 'none');
  }
}

// Logout handler
function handleLogout(event) {
  if (event) event.preventDefault();
  auth.logout();
}

// Check for impersonate token in URL (관리자 회원 마이페이지 접속)
function checkImpersonateToken() {
  const urlParams = new URLSearchParams(window.location.search);
  const impersonateToken = urlParams.get('impersonate_token');

  if (impersonateToken) {
    // Set the token
    auth.setToken(impersonateToken);

    // Decode token to get user info (JWT payload is base64)
    try {
      const payload = JSON.parse(atob(impersonateToken.split('.')[1]));
      auth.setUser({
        id: payload.id,
        username: payload.username,
        grade: payload.grade
      });
    } catch (e) {
      console.error('Failed to decode impersonate token:', e);
    }

    // Remove token from URL (clean URL)
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    return true;
  }
  return false;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Check impersonate token first
  checkImpersonateToken();

  updateAuthUI();

  // Attach logout handlers
  document.querySelectorAll('.logout-link').forEach(el => {
    el.addEventListener('click', handleLogout);
  });
});

// Export
window.auth = auth;
window.updateAuthUI = updateAuthUI;
window.handleLogout = handleLogout;
