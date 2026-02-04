/**
 * X-mall Admin Dashboard JavaScript
 */

const API_BASE = '/X-mall/api';

// 간단한 인메모리 캐시
const apiCache = {
    data: new Map(),
    ttl: 30000, // 30초 기본 TTL

    set(key, value, ttl = this.ttl) {
        this.data.set(key, {
            value,
            expiry: Date.now() + ttl
        });
    },

    get(key) {
        const item = this.data.get(key);
        if (!item) return null;
        if (Date.now() > item.expiry) {
            this.data.delete(key);
            return null;
        }
        return item.value;
    },

    clear() {
        this.data.clear();
    }
};

// 디바운스 유틸리티
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// API Helper
const api = {
    getToken() {
        const session = JSON.parse(localStorage.getItem('xmallAdminSession') || '{}');
        return session.token;
    },

    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    logout();
                    return;
                }
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    // 캐싱된 GET 요청 (자주 변경되지 않는 데이터용)
    async getCached(endpoint, ttl = 30000) {
        const cached = apiCache.get(endpoint);
        if (cached) return cached;

        const data = await this.request(endpoint, { method: 'GET' });
        apiCache.set(endpoint, data, ttl);
        return data;
    },

    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    // Skip auth check on login page
    if (window.location.pathname.includes('login.html')) {
        return;
    }

    if (!checkAuth()) {
        return;
    }

    initSidebar();
    initModals();
    initLogout();
    displayUserInfo();
});

/**
 * Authentication Check
 */
function checkAuth() {
    const session = localStorage.getItem('xmallAdminSession');
    if (!session) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

/**
 * Get Current Session
 */
function getSession() {
    const session = localStorage.getItem('xmallAdminSession');
    return session ? JSON.parse(session) : null;
}

/**
 * Display User Info
 */
function displayUserInfo() {
    const session = getSession();
    if (session && session.admin) {
        const userNameEl = document.getElementById('adminUserName');
        if (userNameEl) {
            userNameEl.textContent = session.admin.name || 'Admin';
        }
        const avatarEl = document.querySelector('.sidebar-user-avatar');
        if (avatarEl && session.admin.name) {
            avatarEl.textContent = session.admin.name.charAt(0).toUpperCase();
        }
    }
}

/**
 * Initialize Logout
 */
function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
}

/**
 * Logout Function
 */
function logout() {
    localStorage.removeItem('xmallAdminSession');
    window.location.href = 'login.html';
}

/**
 * Sidebar Toggle for Mobile
 */
function initSidebar() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });

        document.addEventListener('click', function(e) {
            if (window.innerWidth <= 992) {
                if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                    sidebar.classList.remove('active');
                }
            }
        });
    }
}

/**
 * Modal Functions
 */
function initModals() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                modal.classList.remove('active');
            });
        }
    });
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Toast Notification
 */
function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.admin-toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `admin-toast ${type}`;
    toast.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${type === 'success'
                ? '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/>'
                : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
            }
        </svg>
        <span>${message}</span>
    `;

    if (!document.querySelector('#toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .admin-toast {
                position: fixed;
                bottom: 2rem;
                right: 2rem;
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 1rem 1.5rem;
                background: #1a1f2e;
                color: #fff;
                border-radius: 8px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                z-index: 10000;
                animation: toastIn 0.3s ease;
            }
            .admin-toast.success svg { stroke: #4caf50; }
            .admin-toast.error svg { stroke: #f44336; }
            @keyframes toastIn {
                from { transform: translateY(100px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Format Currency
 */
function formatCurrency(amount) {
    const num = Number(amount);
    return new Intl.NumberFormat('ko-KR').format(isNaN(num) ? 0 : num) + '원';
}

/**
 * Format Date
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * Format DateTime
 */
function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Grade Badge
 */
function gradeBadge(grade) {
    const text = grade === 'dealer' ? '대리점' : '소비자';
    return `<span class="status-badge ${grade}">${text}</span>`;
}

/**
 * Order Status Badge
 */
function orderStatusBadge(status) {
    const statusMap = {
        'pending': { class: 'pending', text: '대기중' },
        'paid': { class: 'processing', text: '결제완료' },
        'confirmed': { class: 'processing', text: '확인됨' },
        'processing': { class: 'processing', text: '처리중' },
        'shipped': { class: 'shipped', text: '배송중' },
        'delivered': { class: 'delivered', text: '배송완료' },
        'cancelled': { class: 'cancelled', text: '취소됨' },
        'refunded': { class: 'cancelled', text: '환불됨' }
    };
    const info = statusMap[status] || { class: '', text: status };
    return `<span class="status-badge ${info.class}">${info.text}</span>`;
}

/**
 * Withdrawal Status Badge
 */
function withdrawalStatusBadge(status) {
    const statusMap = {
        'pending': { class: 'pending', text: '대기중' },
        'approved': { class: 'approved', text: '승인됨' },
        'rejected': { class: 'rejected', text: '거절됨' },
        'completed': { class: 'completed', text: '완료' }
    };
    const info = statusMap[status] || { class: '', text: status };
    return `<span class="status-badge ${info.class}">${info.text}</span>`;
}

/**
 * Confirm Delete
 */
function confirmDelete(itemName) {
    return confirm(`"${itemName}"을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`);
}

/**
 * Loading State
 */
function setLoading(element, loading) {
    if (loading) {
        element.disabled = true;
        element.dataset.originalText = element.innerHTML;
        element.innerHTML = '<span class="spinner"></span> 처리중...';
    } else {
        element.disabled = false;
        element.innerHTML = element.dataset.originalText || element.innerHTML;
    }
}

// Add spinner style
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
    .spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255,255,255,0.3);
        border-radius: 50%;
        border-top-color: #fff;
        animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(spinnerStyle);

/**
 * File Upload API Helper
 */
async function uploadFile(endpoint, file, fieldName = 'file') {
    const token = api.getToken();
    const formData = new FormData();
    formData.append(fieldName, file);

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return;
            }
            throw new Error(data.error || 'Upload failed');
        }

        return data;
    } catch (error) {
        console.error('Upload Error:', error);
        throw error;
    }
}

/**
 * Download Members Excel Template
 */
function downloadMembersTemplate() {
    // Create workbook with SheetJS (loaded via CDN in HTML)
    if (typeof XLSX === 'undefined') {
        showToast('엑셀 라이브러리를 로드하는 중입니다. 잠시 후 다시 시도해주세요.', 'error');
        return;
    }

    const data = [
        { username: 'user1234', password: 'password123', name: '홍길동', phone: '010-1234-5678', grade: 'consumer', referrer_username: 'dealer001' }
    ];

    const ws = XLSX.utils.json_to_sheet(data, {
        header: ['username', 'password', 'name', 'phone', 'grade', 'referrer_username']
    });

    // Set column widths
    ws['!cols'] = [
        { wch: 15 }, // username
        { wch: 15 }, // password
        { wch: 12 }, // name
        { wch: 15 }, // phone
        { wch: 10 }, // grade
        { wch: 18 }  // referrer_username
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '회원목록');

    XLSX.writeFile(wb, 'members_template.xlsx');
    showToast('양식이 다운로드되었습니다.', 'success');
}

/**
 * Download Points Excel Template (X포인트 전용)
 */
function downloadPointsTemplate() {
    if (typeof XLSX === 'undefined') {
        showToast('엑셀 라이브러리를 로드하는 중입니다. 잠시 후 다시 시도해주세요.', 'error');
        return;
    }

    const data = [
        { username: 'user1234', point_type: 'X', amount: 10000, reason: '이벤트 지급' }
    ];

    const ws = XLSX.utils.json_to_sheet(data, {
        header: ['username', 'point_type', 'amount', 'reason']
    });

    // Set column widths
    ws['!cols'] = [
        { wch: 20 }, // username
        { wch: 12 }, // point_type
        { wch: 12 }, // amount
        { wch: 25 }  // reason
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'X포인트지급');

    XLSX.writeFile(wb, 'xpoints_template.xlsx');
    showToast('양식이 다운로드되었습니다.', 'success');
}

/**
 * Download Products Excel Template
 */
function downloadProductsTemplate() {
    if (typeof XLSX === 'undefined') {
        showToast('엑셀 라이브러리를 로드하는 중입니다. 잠시 후 다시 시도해주세요.', 'error');
        return;
    }

    const data = [
        {
            name: '테스트 상품',
            price_krw: 50000,
            price_dealer_krw: 40000,
            pv_value: 100,
            stock_quantity: 100,
            category: '건강식품',
            description: '상품 설명입니다',
            product_type: 'single'
        }
    ];

    const ws = XLSX.utils.json_to_sheet(data, {
        header: ['name', 'price_krw', 'price_dealer_krw', 'pv_value', 'stock_quantity', 'category', 'description', 'product_type']
    });

    // Set column widths
    ws['!cols'] = [
        { wch: 25 }, // name
        { wch: 12 }, // price_krw
        { wch: 15 }, // price_dealer_krw
        { wch: 10 }, // pv_value
        { wch: 12 }, // stock_quantity
        { wch: 15 }, // category
        { wch: 30 }, // description
        { wch: 12 }  // product_type
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '상품목록');

    XLSX.writeFile(wb, 'products_template.xlsx');
    showToast('양식이 다운로드되었습니다.', 'success');
}

/**
 * Load Dealers for Referrer Selection (캐싱 적용)
 */
async function loadDealers(forceReload = false) {
    try {
        if (forceReload) {
            apiCache.data.delete('/admin/dealers');
        }
        const result = await api.getCached('/admin/dealers', 60000); // 1분 캐시
        return result.data?.dealers || [];
    } catch (error) {
        console.error('Failed to load dealers:', error);
        return [];
    }
}

/**
 * Populate Dealers Datalist
 */
async function populateDealersDatalist(datalistId) {
    const datalist = document.getElementById(datalistId);
    if (!datalist) return;

    const dealers = await loadDealers();
    datalist.innerHTML = dealers.map(d =>
        `<option value="${d.username}">${d.name} (${d.username})</option>`
    ).join('');
}

console.log('X-mall Admin Dashboard initialized');
