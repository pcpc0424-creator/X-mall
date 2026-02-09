/**
 * X-mall API Client
 */
const API_BASE_URL = '/api';

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

  async login(username, password) {
    return api.post('/auth/login', { username, password });
  },
};

// User API
const userApi = {
  async getProfile() {
    return api.get('/users/profile');
  },

  async changePassword(currentPassword, newPassword) {
    return api.put('/users/password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },
};

// Points API (X포인트만 지원)
const pointsApi = {
  async getSummary() {
    return api.get('/points/summary');
  },

  async getHistory(page = 1, limit = 20) {
    return api.get(`/points/history?page=${page}&limit=${limit}&point_type=X`);
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

  async chargeByCard(data) {
    return api.post('/rpay/charge', data);
  },
};

// Withdrawal API (X포인트 출금)
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

  async getBestsellers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return api.get(`/products/bestsellers${query ? '?' + query : ''}`);
  },
};

// Cart API (localStorage 기반)
const cartApi = {
  CART_KEY: 'xmall_cart',

  // 장바구니 전체 조회
  getItems() {
    const cart = localStorage.getItem(this.CART_KEY);
    return cart ? JSON.parse(cart) : [];
  },

  // 장바구니 저장
  saveItems(items) {
    localStorage.setItem(this.CART_KEY, JSON.stringify(items));
    this.updateCartCount();
  },

  // 상품 추가
  addItem(product) {
    const items = this.getItems();
    const existingIndex = items.findIndex(item =>
      item.id === product.id && item.option === product.option
    );

    if (existingIndex > -1) {
      items[existingIndex].quantity += product.quantity || 1;
    } else {
      items.push({
        id: product.id,
        product_id: product.product_id || product.id, // 실제 상품 ID 저장
        name: product.name,
        price: product.price,
        dealerPrice: product.dealerPrice || product.price, // 대리점 가격 저장
        originalPrice: product.originalPrice || product.price,
        pv: product.pv || 0,
        image: product.image,
        category: product.category || '',
        option: product.option || '기본',
        quantity: product.quantity || 1
      });
    }

    this.saveItems(items);
    return items;
  },

  // 상품 삭제
  removeItem(productId, option = null) {
    let items = this.getItems();
    if (option) {
      items = items.filter(item => !(item.id === productId && item.option === option));
    } else {
      items = items.filter(item => item.id !== productId);
    }
    this.saveItems(items);
    return items;
  },

  // 수량 변경
  updateQuantity(productId, quantity, option = null) {
    const items = this.getItems();
    const item = items.find(item =>
      item.id === productId && (option === null || item.option === option)
    );
    if (item) {
      item.quantity = Math.max(1, Math.min(99, quantity));
      this.saveItems(items);
    }
    return items;
  },

  // 선택 상품 삭제
  removeSelected(productIds) {
    let items = this.getItems();
    items = items.filter(item => !productIds.includes(item.id));
    this.saveItems(items);
    return items;
  },

  // 장바구니 비우기
  clear() {
    localStorage.removeItem(this.CART_KEY);
    this.updateCartCount();
  },

  // 총 수량
  getTotalCount() {
    const items = this.getItems();
    return items.reduce((sum, item) => sum + item.quantity, 0);
  },

  // 헤더 장바구니 카운트 업데이트
  updateCartCount() {
    const count = this.getItems().length;
    const badges = document.querySelectorAll('.cart-count');
    badges.forEach(badge => {
      badge.textContent = count;
    });
  },

  // 총액 계산
  getTotal() {
    const items = this.getItems();
    let subtotal = 0;
    let totalPv = 0;

    items.forEach(item => {
      subtotal += item.price * item.quantity;
      totalPv += (item.pv || 0) * item.quantity;
    });

    return { subtotal, totalPv, itemCount: items.length };
  }
};

// 페이지 로드 시 장바구니 카운트 업데이트
document.addEventListener('DOMContentLoaded', () => {
  cartApi.updateCartCount();
});

// Export
window.api = api;
window.authApi = authApi;
window.userApi = userApi;
window.pointsApi = pointsApi;
window.rpayApi = rpayApi;
window.withdrawalApi = withdrawalApi;
window.ordersApi = ordersApi;
window.productsApi = productsApi;
window.cartApi = cartApi;
