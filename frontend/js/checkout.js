/**
 * X-mall Checkout Module
 */
class Checkout {
  constructor() {
    this.cartKey = 'cart';
    this.init();
  }

  init() {
    // Initialize event listeners if on checkout page
    if (document.getElementById('checkout-form')) {
      this.loadCheckoutPage();
    }
  }

  getCart() {
    const cartStr = localStorage.getItem(this.cartKey);
    return cartStr ? JSON.parse(cartStr) : [];
  }

  clearCart() {
    localStorage.removeItem(this.cartKey);
  }

  async loadBalances() {
    try {
      const response = await pointsApi.getSummary();
      if (response.success) {
        return response.data;
      }
    } catch (error) {
      console.error('Failed to load balances:', error);
    }
    return { X: 0, rpay: 0 };
  }

  async loadCheckoutPage() {
    // Check if user is logged in and is a dealer
    if (!auth.requireDealer()) return;

    const cart = this.getCart();
    if (cart.length === 0) {
      alert('장바구니가 비어있습니다.');
      window.location.href = '/cart.html';
      return;
    }

    // Load balances
    const balances = await this.loadBalances();
    this.updateBalanceDisplay(balances);

    // Calculate totals
    this.calculateTotals();

    // Set up payment input handlers
    this.setupPaymentHandlers(balances);

    // Set up form submit
    document.getElementById('checkout-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitOrder();
    });
  }

  updateBalanceDisplay(balances) {
    const elements = {
      'available-rpay': balances.rpay || 0,
      'available-xpoint': balances.X || 0,
    };

    for (const [id, value] of Object.entries(elements)) {
      const el = document.getElementById(id);
      if (el) el.textContent = value.toLocaleString() + '원';
    }
  }

  calculateTotals() {
    const cart = this.getCart();
    let totalKrw = 0;
    let totalPv = 0;

    cart.forEach(item => {
      totalKrw += item.dealerPrice * item.quantity;
      totalPv += item.pv * item.quantity;
    });

    document.getElementById('total-amount').textContent = totalKrw.toLocaleString() + '원';
    document.getElementById('total-pv').textContent = totalPv.toFixed(1) + ' PV';

    this.totalKrw = totalKrw;
    this.totalPv = totalPv;
  }

  setupPaymentHandlers(balances) {
    const paymentInputs = ['payment-rpay', 'payment-xpoint'];
    const maxBalances = {
      'payment-rpay': balances.rpay || 0,
      'payment-xpoint': balances.X || 0,
    };

    paymentInputs.forEach(inputId => {
      const input = document.getElementById(inputId);
      if (input) {
        input.max = maxBalances[inputId];
        input.addEventListener('input', () => this.updateRemainingAmount());
      }
    });

    this.maxBalances = maxBalances;
    this.updateRemainingAmount();
  }

  updateRemainingAmount() {
    const rpay = parseInt(document.getElementById('payment-rpay')?.value || 0);
    const xpoint = parseInt(document.getElementById('payment-xpoint')?.value || 0);

    const pointsTotal = rpay + xpoint;
    const remaining = this.totalKrw - pointsTotal;

    document.getElementById('remaining-amount').textContent = Math.max(0, remaining).toLocaleString() + '원';

    // Update card/bank payment needed
    const cardBankNeeded = Math.max(0, remaining);
    document.getElementById('card-bank-needed').textContent = cardBankNeeded.toLocaleString() + '원';
  }

  async submitOrder() {
    const cart = this.getCart();

    // Collect shipping info
    const shipping = {
      name: document.getElementById('shipping-name').value,
      phone: document.getElementById('shipping-phone').value,
      address: document.getElementById('shipping-address').value,
    };

    if (!shipping.name || !shipping.phone || !shipping.address) {
      alert('배송 정보를 모두 입력해주세요.');
      return;
    }

    // Collect payment info
    const rpay = parseInt(document.getElementById('payment-rpay')?.value || 0);
    const xpoint = parseInt(document.getElementById('payment-xpoint')?.value || 0);
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value;

    const pointsTotal = rpay + xpoint;
    const cardBankAmount = this.totalKrw - pointsTotal;

    if (cardBankAmount > 0 && !paymentMethod) {
      alert('결제 방법을 선택해주세요.');
      return;
    }

    const payment = {
      rpay: rpay || undefined,
      xpoint: xpoint || undefined,
    };

    if (cardBankAmount > 0) {
      if (paymentMethod === 'card') {
        payment.card = cardBankAmount;
      } else {
        payment.bank = cardBankAmount;
      }
    }

    const items = cart.map(item => ({
      product_id: item.id,
      quantity: item.quantity,
    }));

    try {
      const response = await ordersApi.create({ items, payment, shipping });

      if (response.success) {
        alert(`주문이 완료되었습니다.\n주문번호: ${response.data.order_number}`);
        this.clearCart();
        window.location.href = '/my-account/orders.html';
      }
    } catch (error) {
      alert(error.message || '주문 처리 중 오류가 발생했습니다.');
    }
  }
}

// Initialize
const checkout = new Checkout();
window.checkout = checkout;
