/**
 * X-mall API Client
 */
const API_BASE_URL = '/X-mall/api';

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  getToken() {
    return localStorage.getItem('token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '요청 처리 중 오류가 발생했습니다.');
      }

      return data;
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('서버에 연결할 수 없습니다.');
      }
      throw error;
    }
  }

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

// Create singleton instance
const api = new ApiClient();

// Auth API
const authApi = {
  async signup(data) {
    return api.post('/auth/signup', data);
  },

  async login(email, password) {
    return api.post('/auth/login', { email, password });
  },
};

// User API
const userApi = {
  async getProfile() {
    return api.get('/users/profile');
  },
};

// Points API
const pointsApi = {
  async getSummary() {
    return api.get('/points/summary');
  },

  async getHistory(pointType, page = 1, limit = 20) {
    let endpoint = `/points/history?page=${page}&limit=${limit}`;
    if (pointType) endpoint += `&point_type=${pointType}`;
    return api.get(endpoint);
  },

  async transfer(toUserEmail, pointType, amount) {
    return api.post('/points/transfer', {
      to_user_email: toUserEmail,
      point_type: pointType,
      amount: parseFloat(amount),
    });
  },
};

// R-pay API
const rpayApi = {
  async getBalance() {
    return api.get('/rpay/balance');
  },

  async getHistory(page = 1, limit = 20) {
    return api.get(`/rpay/history?page=${page}&limit=${limit}`);
  },
};

// Withdrawal API
const withdrawalApi = {
  async create(data) {
    return api.post('/withdrawals', data);
  },

  async getHistory(page = 1, limit = 20) {
    return api.get(`/withdrawals?page=${page}&limit=${limit}`);
  },
};

// Orders API
const ordersApi = {
  async create(orderData) {
    return api.post('/orders', orderData);
  },

  async getList(page = 1, limit = 20, status = null) {
    let endpoint = `/orders?page=${page}&limit=${limit}`;
    if (status) endpoint += `&status=${status}`;
    return api.get(endpoint);
  },

  async getById(orderId) {
    return api.get(`/orders/${orderId}`);
  },
};

// Products API
const productsApi = {
  async getList(params = {}) {
    const query = new URLSearchParams(params).toString();
    return api.get(`/products${query ? '?' + query : ''}`);
  },

  async getById(productId) {
    return api.get(`/products/${productId}`);
  },

  async getDealerList(params = {}) {
    const query = new URLSearchParams(params).toString();
    return api.get(`/products/dealer/list${query ? '?' + query : ''}`);
  },
};

// Export
window.api = api;
window.authApi = authApi;
window.userApi = userApi;
window.pointsApi = pointsApi;
window.rpayApi = rpayApi;
window.withdrawalApi = withdrawalApi;
window.ordersApi = ordersApi;
window.productsApi = productsApi;
