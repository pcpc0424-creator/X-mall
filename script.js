/* ===================================
   X-mall Premium Shopping Mall
   Interactive JavaScript
   =================================== */

document.addEventListener('DOMContentLoaded', function() {

    // ===================================
    // Loading Screen
    // ===================================
    const loadingScreen = document.querySelector('.loading-screen');

    window.addEventListener('load', function() {
        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
                document.body.style.overflow = 'auto';
                initScrollAnimations();
            }, 1500);
        } else {
            // 카테고리 페이지 등 로딩스크린 없는 페이지
            document.body.style.overflow = 'auto';
            initScrollAnimations();
        }
    });

    // ===================================
    // Custom Cursor
    // ===================================
    const cursorFollower = document.querySelector('.cursor-follower');
    const cursorDot = document.querySelector('.cursor-dot');
    let mouseX = 0, mouseY = 0;
    let followerX = 0, followerY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        if (cursorDot) {
            cursorDot.style.left = mouseX + 'px';
            cursorDot.style.top = mouseY + 'px';
        }
    });

    function animateCursor() {
        followerX += (mouseX - followerX) * 0.1;
        followerY += (mouseY - followerY) * 0.1;

        if (cursorFollower) {
            cursorFollower.style.left = followerX + 'px';
            cursorFollower.style.top = followerY + 'px';
        }

        requestAnimationFrame(animateCursor);
    }
    if (cursorFollower) {
        animateCursor();
    }

    // Cursor hover effects
    if (cursorFollower) {
        const hoverElements = document.querySelectorAll('a, button, .product-card, .category-card');
        hoverElements.forEach(el => {
            el.addEventListener('mouseenter', () => {
                cursorFollower.classList.add('hover');
            });
            el.addEventListener('mouseleave', () => {
                cursorFollower.classList.remove('hover');
            });
        });
    }

    // ===================================
    // Header Scroll Effect
    // ===================================
    const header = document.querySelector('.header');
    let lastScrollY = 0;

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;

        if (currentScrollY > 100) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        lastScrollY = currentScrollY;
    });

    // ===================================
    // Search Overlay
    // ===================================
    const searchBtn = document.querySelector('.search-btn');
    const searchOverlay = document.querySelector('.search-overlay');
    const searchClose = document.querySelector('.search-close');

    if (searchBtn && searchOverlay) {
        searchBtn.addEventListener('click', () => {
            searchOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            setTimeout(() => {
                const input = searchOverlay.querySelector('input');
                if (input) input.focus();
            }, 300);
        });
    }

    if (searchClose && searchOverlay) {
        searchClose.addEventListener('click', () => {
            searchOverlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    }

    if (searchOverlay) {
        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) {
                searchOverlay.classList.remove('active');
                document.body.style.overflow = 'auto';
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && searchOverlay.classList.contains('active')) {
                searchOverlay.classList.remove('active');
                document.body.style.overflow = 'auto';
            }
        });
    }

    // ===================================
    // Hero Slider
    // ===================================
    const heroSlides = document.querySelectorAll('.hero-slide');
    const progressFill = document.querySelector('.progress-fill');
    const currentSlideEl = document.querySelector('.slide-counter .current');
    const prevBtn = document.querySelector('.slide-prev');
    const nextBtn = document.querySelector('.slide-next');

    let currentSlide = 0;
    const totalSlides = heroSlides.length;
    let slideInterval;
    const slideDuration = 6000;

    function updateSlider() {
        if (heroSlides.length === 0) return;
        heroSlides.forEach((slide, index) => {
            slide.classList.remove('active');
            if (index === currentSlide) {
                slide.classList.add('active');
            }
        });

        if (progressFill) progressFill.style.width = ((currentSlide + 1) / totalSlides * 100) + '%';
        if (currentSlideEl) currentSlideEl.textContent = String(currentSlide + 1).padStart(2, '0');
    }

    function nextSlide() {
        if (totalSlides === 0) return;
        currentSlide = (currentSlide + 1) % totalSlides;
        updateSlider();
    }

    function prevSlide() {
        if (totalSlides === 0) return;
        currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
        updateSlider();
    }

    function startSlideshow() {
        if (totalSlides === 0) return;
        slideInterval = setInterval(nextSlide, slideDuration);
    }

    function resetSlideshow() {
        clearInterval(slideInterval);
        startSlideshow();
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            nextSlide();
            resetSlideshow();
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            prevSlide();
            resetSlideshow();
        });
    }

    startSlideshow();

    // ===================================
    // Product Tabs
    // ===================================
    const tabBtns = document.querySelectorAll('.tab-btn');
    const productCards = document.querySelectorAll('.products-track .product-card');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const category = btn.dataset.tab;

            productCards.forEach(card => {
                if (category === 'all' || card.dataset.category === category) {
                    card.style.display = 'flex';
                    card.style.flex = '0 0 300px';
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    }, 50);
                } else {
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(20px)';
                    setTimeout(() => {
                        card.style.display = 'none';
                        card.style.flex = '0 0 0';
                    }, 300);
                }
            });
        });
    });

    // ===================================
    // Products Slider
    // ===================================
    const productsTrack = document.querySelector('.products-track');
    const sliderPrev = document.querySelector('.slider-prev');
    const sliderNext = document.querySelector('.slider-next');
    let scrollPosition = 0;
    const scrollAmount = 330;

    if (sliderNext && productsTrack) {
        sliderNext.addEventListener('click', () => {
            scrollPosition += scrollAmount;
            productsTrack.scrollTo({
                left: scrollPosition,
                behavior: 'smooth'
            });
        });
    }

    if (sliderPrev && productsTrack) {
        sliderPrev.addEventListener('click', () => {
            scrollPosition -= scrollAmount;
            if (scrollPosition < 0) scrollPosition = 0;
            productsTrack.scrollTo({
                left: scrollPosition,
                behavior: 'smooth'
            });
        });
    }

    // ===================================
    // Wishlist Toggle
    // ===================================
    const wishlistBtns = document.querySelectorAll('.product-wishlist');

    wishlistBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            btn.classList.toggle('active');

            const icon = btn.querySelector('i');
            if (btn.classList.contains('active')) {
                icon.classList.remove('far');
                icon.classList.add('fas');
            } else {
                icon.classList.remove('fas');
                icon.classList.add('far');
            }
        });
    });

    // ===================================
    // Countdown Timer
    // ===================================
    const daysEl = document.querySelector('[data-days]');
    const hoursEl = document.querySelector('[data-hours]');
    const minutesEl = document.querySelector('[data-minutes]');
    const secondsEl = document.querySelector('[data-seconds]');

    if (daysEl && hoursEl && minutesEl && secondsEl) {
        // Set end date (3 days from now)
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 3);
        endDate.setHours(endDate.getHours() + 12);
        endDate.setMinutes(endDate.getMinutes() + 45);

        function updateTimer() {
            const now = new Date();
            const diff = endDate - now;

            if (diff <= 0) {
                daysEl.textContent = '00';
                hoursEl.textContent = '00';
                minutesEl.textContent = '00';
                secondsEl.textContent = '00';
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            daysEl.textContent = String(days).padStart(2, '0');
            hoursEl.textContent = String(hours).padStart(2, '0');
            minutesEl.textContent = String(minutes).padStart(2, '0');
            secondsEl.textContent = String(seconds).padStart(2, '0');
        }

        updateTimer();
        setInterval(updateTimer, 1000);
    }

    // ===================================
    // Reviews Slider
    // ===================================
    const reviewsTrack = document.querySelector('.reviews-track');
    const reviewPrev = document.querySelector('.review-prev');
    const reviewNext = document.querySelector('.review-next');
    const reviewsDotsContainer = document.querySelector('.reviews-dots');
    const reviewCards = document.querySelectorAll('.review-card');

    if (reviewsTrack && reviewsDotsContainer && reviewCards.length > 0) {
        let reviewIndex = 0;
        const reviewsPerView = window.innerWidth > 992 ? 3 : window.innerWidth > 768 ? 2 : 1;
        const totalReviewPages = Math.ceil(reviewCards.length / reviewsPerView);

        // Create dots
        for (let i = 0; i < totalReviewPages; i++) {
            const dot = document.createElement('span');
            dot.classList.add('dot');
            if (i === 0) dot.classList.add('active');
            dot.addEventListener('click', () => {
                reviewIndex = i;
                updateReviewSlider();
            });
            reviewsDotsContainer.appendChild(dot);
        }

        const reviewDots = reviewsDotsContainer.querySelectorAll('.dot');

        function updateReviewSlider() {
            const cardWidth = reviewCards[0].offsetWidth + 30;
            const offset = reviewIndex * cardWidth * reviewsPerView;
            reviewsTrack.style.transform = `translateX(-${offset}px)`;

            reviewDots.forEach((dot, i) => {
                dot.classList.toggle('active', i === reviewIndex);
            });
        }

        if (reviewNext) {
            reviewNext.addEventListener('click', () => {
                reviewIndex = (reviewIndex + 1) % totalReviewPages;
                updateReviewSlider();
            });
        }

        if (reviewPrev) {
            reviewPrev.addEventListener('click', () => {
                reviewIndex = (reviewIndex - 1 + totalReviewPages) % totalReviewPages;
                updateReviewSlider();
            });
        }
    }

    // ===================================
    // Stats Counter Animation
    // ===================================
    const statNumbers = document.querySelectorAll('.stat-number');
    const statsSection = document.querySelector('.brand-stats');
    let statsAnimated = false;

    if (statsSection && statNumbers.length > 0) {
        function animateStats() {
            if (statsAnimated) return;

            const sectionTop = statsSection.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;

            if (sectionTop < windowHeight * 0.8) {
                statsAnimated = true;

                statNumbers.forEach(stat => {
                    const target = parseInt(stat.dataset.count);
                    const duration = 2000;
                    const step = target / (duration / 16);
                    let current = 0;

                    const counter = setInterval(() => {
                        current += step;
                        if (current >= target) {
                            current = target;
                            clearInterval(counter);
                        }
                        stat.textContent = Math.floor(current).toLocaleString();
                    }, 16);
                });
            }
        }

        window.addEventListener('scroll', animateStats);
    }

    // ===================================
    // Scroll Animations
    // ===================================
    function initScrollAnimations() {
        const animatedElements = document.querySelectorAll('.section-header, .category-card, .product-card, .new-product-featured, .new-product-list, .brand-story-content, .brand-story-visual, .review-card, .insta-item, .newsletter-content');

        animatedElements.forEach(el => {
            el.classList.add('fade-up');
        });

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        animatedElements.forEach(el => observer.observe(el));
    }

    // ===================================
    // Parallax Effect
    // ===================================
    const parallaxElements = document.querySelectorAll('[data-parallax]');

    window.addEventListener('scroll', () => {
        parallaxElements.forEach(el => {
            const scrolled = window.scrollY;
            const rect = el.parentElement.getBoundingClientRect();
            const speed = 0.3;

            if (rect.top < window.innerHeight && rect.bottom > 0) {
                const yPos = (rect.top - window.innerHeight) * speed;
                el.style.transform = `translateY(${yPos}px)`;
            }
        });
    });

    // ===================================
    // Tilt Effect for Cards
    // ===================================
    const tiltCards = document.querySelectorAll('[data-tilt]');

    tiltCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
        });
    });

    // ===================================
    // Scroll to Top
    // ===================================
    const scrollTopBtn = document.querySelector('.scroll-top');

    if (scrollTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 500) {
                scrollTopBtn.classList.add('visible');
            } else {
                scrollTopBtn.classList.remove('visible');
            }
        });

        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // ===================================
    // Quick Menu
    // ===================================
    const quickMenu = document.querySelector('.quick-menu');
    const quickMenuToggle = document.querySelector('.quick-menu-toggle');

    if (quickMenu && quickMenuToggle) {
        quickMenuToggle.addEventListener('click', () => {
            quickMenu.classList.toggle('active');
        });

        // Close quick menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!quickMenu.contains(e.target)) {
                quickMenu.classList.remove('active');
            }
        });
    }

    // ===================================
    // PC Hamburger Dropdown Toggle
    // ===================================
    const menuToggleWrap = document.querySelector('.menu-toggle-wrap');
    const hamburgerDropdown = document.querySelector('.hamburger-dropdown');
    const hamburgerSubmenus = document.querySelectorAll('.hamburger-dropdown > .has-submenu');

    // 햄버거 카테고리 메뉴 토글 (직접 자식 a 태그만)
    hamburgerSubmenus.forEach(item => {
        const link = item.querySelector(':scope > a');
        if (link) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // 다른 열린 서브메뉴 닫기
                hamburgerSubmenus.forEach(other => {
                    if (other !== item && other.classList.contains('open')) {
                        other.classList.remove('open');
                    }
                });

                // 현재 서브메뉴 토글
                item.classList.toggle('open');
            });
        }
    });

    // 서브메뉴 링크 클릭 시 페이지 이동
    const submenuLinks = document.querySelectorAll('.hamburger-submenu li a');
    submenuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.stopPropagation();
            const href = link.getAttribute('href');
            if (href && href !== '#') {
                window.location.href = href;
            }
        });
    });

    // 외부 클릭 시 드롭다운 닫기
    document.addEventListener('click', (e) => {
        if (menuToggleWrap && !menuToggleWrap.contains(e.target)) {
            hamburgerSubmenus.forEach(item => {
                item.classList.remove('open');
            });
        }
    });

    // ===================================
    // Mobile Menu Toggle
    // ===================================
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            // 모바일에서만 전체 메뉴 토글
            if (window.innerWidth <= 992) {
                menuToggle.classList.toggle('active');
                navMenu.classList.toggle('active');
                document.body.classList.toggle('menu-open');

                // 메뉴 닫을 때 모든 드롭다운도 닫기
                if (!navMenu.classList.contains('active')) {
                    const openDropdowns = navMenu.querySelectorAll('.has-dropdown.open');
                    openDropdowns.forEach(dropdown => {
                        dropdown.classList.remove('open');
                    });
                }
            }
        });
    }

    // ===================================
    // Mobile Dropdown Toggle
    // ===================================
    const dropdownItems = document.querySelectorAll('.nav-menu .has-dropdown');

    dropdownItems.forEach(item => {
        const link = item.querySelector('.nav-link');

        link.addEventListener('click', (e) => {
            // 모바일에서만 드롭다운 토글
            if (window.innerWidth <= 992) {
                e.preventDefault();

                // 다른 열린 드롭다운 닫기
                dropdownItems.forEach(other => {
                    if (other !== item && other.classList.contains('open')) {
                        other.classList.remove('open');
                    }
                });

                // 현재 드롭다운 토글
                item.classList.toggle('open');
            }
        });
    });

    // ===================================
    // Newsletter Form
    // ===================================
    const newsletterForm = document.querySelector('.newsletter-form');

    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = newsletterForm.querySelector('input[type="email"]').value;
            const checkbox = newsletterForm.querySelector('input[type="checkbox"]');

            if (!email) {
                alert('이메일 주소를 입력해주세요.');
                return;
            }

            if (!checkbox.checked) {
                alert('마케팅 정보 수신에 동의해주세요.');
                return;
            }

            // Simulate form submission
            alert('뉴스레터 구독이 완료되었습니다!');
            newsletterForm.reset();
        });
    }

    // ===================================
    // Add to Cart Animation
    // ===================================
    const addCartBtns = document.querySelectorAll('.btn-add-cart, .btn-add-cart-mini');

    addCartBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 대리점 회원 체크
            const token = localStorage.getItem('token');
            const userStr = localStorage.getItem('user');

            if (!token || !userStr) {
                alert('대리점 회원만 구매가 가능합니다.\n로그인 후 이용해주세요.');
                window.location.href = 'login.html';
                return;
            }

            const user = JSON.parse(userStr);
            if (user.grade !== 'dealer') {
                alert('대리점 회원만 장바구니 및 구매가 가능합니다.\n대리점 가입 문의: 1588-0000');
                return;
            }

            // 상품 정보 추출 (product-card에서)
            const card = btn.closest('.product-card');
            if (card && typeof cartApi !== 'undefined') {
                const nameEl = card.querySelector('.product-name a, .product-name');
                const name = nameEl ? nameEl.textContent.trim() : '상품';

                const linkEl = card.querySelector('.product-name a, .product-image a');
                const href = linkEl ? linkEl.getAttribute('href') : '';
                const productId = href ? href.replace('.html', '').replace(/\//g, '_') : 'product_' + Date.now();

                const priceEl = card.querySelector('.price-sale, .current-price');
                const price = priceEl ? parseInt(priceEl.textContent.replace(/[^\d]/g, '')) : 0;

                const originalPriceEl = card.querySelector('.price-original, .original-price');
                const originalPrice = originalPriceEl ? parseInt(originalPriceEl.textContent.replace(/[^\d]/g, '')) : price;

                const pvEl = card.querySelector('.price-pv, [class*="pv"]');
                const pv = pvEl ? parseInt(pvEl.textContent.replace(/[^\d]/g, '')) || 0 : 0;

                const imageEl = card.querySelector('.product-image img');
                const image = imageEl ? imageEl.src : '';

                const brandEl = card.querySelector('.product-brand');
                const brand = brandEl ? brandEl.textContent.trim() : '';

                cartApi.addItem({
                    id: productId,
                    name: name,
                    price: price,
                    originalPrice: originalPrice,
                    pv: pv,
                    image: image,
                    category: brand,
                    option: '기본',
                    quantity: 1
                });
            }

            // Button animation
            btn.classList.add('added');
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check-circle"></i><span>추가됨</span>';

            // Update cart count from cartApi if available
            if (typeof cartApi !== 'undefined') {
                cartApi.updateCartCount();
                const cartCountEl = document.querySelector('.cart-count');
                if (cartCountEl) {
                    cartCountEl.style.transform = 'scale(1.3)';
                    setTimeout(() => {
                        cartCountEl.style.transform = 'scale(1)';
                    }, 200);
                }
            }

            // Reset button
            setTimeout(() => {
                btn.classList.remove('added');
                if (btn.classList.contains('btn-add-cart-mini')) {
                    btn.innerHTML = '<i class="fas fa-plus"></i>';
                } else {
                    btn.innerHTML = '<i class="fas fa-shopping-bag"></i><span>장바구니</span>';
                }
            }, 2000);

            alert('장바구니에 추가되었습니다.');
        });
    });

    // ===================================
    // Buy Now Button (바로구매)
    // ===================================
    const buyNowBtns = document.querySelectorAll('.btn-buy-detail');

    buyNowBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 대리점 회원 체크
            const token = localStorage.getItem('token');
            const userStr = localStorage.getItem('user');

            if (!token || !userStr) {
                alert('대리점 회원만 구매가 가능합니다.\n로그인 후 이용해주세요.');
                window.location.href = 'login.html';
                return;
            }

            const user = JSON.parse(userStr);
            if (user.grade !== 'dealer') {
                alert('대리점 회원만 구매가 가능합니다.\n대리점 가입 문의: 1588-0000');
                return;
            }

            // 상품 정보 추출 및 장바구니 추가
            if (typeof cartApi !== 'undefined') {
                const nameEl = document.querySelector('.product-title-detail, .product-title, h1');
                const name = nameEl ? nameEl.textContent.trim() : '상품';

                const priceEl = document.querySelector('.price-sale-detail, .price-current, .current-price, .price-sale');
                const price = priceEl ? parseInt(priceEl.textContent.replace(/[^\d]/g, '')) : 0;

                const originalPriceEl = document.querySelector('.price-original-detail, .price-original, .original-price');
                const originalPrice = originalPriceEl ? parseInt(originalPriceEl.textContent.replace(/[^\d]/g, '')) : price;

                const pvEl = document.querySelector('.price-pv-detail, .product-pv, .price-pv, [class*="pv"]');
                const pv = pvEl ? parseInt(pvEl.textContent.replace(/[^\d]/g, '')) || 0 : 0;

                const imageEl = document.getElementById('mainImage') || document.querySelector('.product-image img, .main-image img, .product-gallery img');
                const image = imageEl ? imageEl.src : '';

                const qtyEl = document.getElementById('quantity') || document.querySelector('.qty-input');
                const quantity = qtyEl ? parseInt(qtyEl.value) || 1 : 1;

                const optionEl = document.querySelector('.option-btn.active, .option-select option:checked');
                const option = optionEl ? optionEl.textContent.trim() : '기본';

                const categoryEl = document.querySelector('.product-brand-detail, .product-brand, .product-category');
                const category = categoryEl ? categoryEl.textContent.trim() : '';

                const productId = window.location.pathname.replace(/\.html$/, '').replace(/\//g, '_') + '_' + option;

                cartApi.addItem({
                    id: productId,
                    name: name,
                    price: price,
                    originalPrice: originalPrice,
                    pv: pv,
                    image: image,
                    category: category,
                    option: option,
                    quantity: quantity
                });
            }

            // 장바구니 페이지로 이동
            window.location.href = 'cart.html';
        });
    });

    // ===================================
    // Smooth Scroll for Anchor Links
    // ===================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // ===================================
    // Image Lazy Loading
    // ===================================
    const lazyImages = document.querySelectorAll('img[data-src]');

    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.add('loaded');
                observer.unobserve(img);
            }
        });
    });

    lazyImages.forEach(img => imageObserver.observe(img));

    // ===================================
    // Magnetic Button Effect
    // ===================================
    const magneticBtns = document.querySelectorAll('.btn-primary, .slide-nav button');

    magneticBtns.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0, 0)';
        });
    });

    // ===================================
    // Preload Images
    // ===================================
    function preloadImages() {
        const imageUrls = [
            'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1920&q=80',
            'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=1920&q=80',
            'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1920&q=80'
        ];

        imageUrls.forEach(url => {
            const img = new Image();
            img.src = url;
        });
    }

    preloadImages();

    // ===================================
    // Keyboard Navigation
    // ===================================
    document.addEventListener('keydown', (e) => {
        // Hero slider navigation
        if (e.key === 'ArrowRight') {
            nextSlide();
            resetSlideshow();
        } else if (e.key === 'ArrowLeft') {
            prevSlide();
            resetSlideshow();
        }
    });

    // ===================================
    // Performance: Throttle scroll events
    // ===================================
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Apply throttling to scroll-heavy functions
    window.addEventListener('scroll', throttle(() => {
        // Any additional scroll-based animations can be added here
    }, 100));

    // ===================================
    // Initialize
    // ===================================
    console.log('X-mall Shopping Mall Initialized');

    // Hide cursor on mobile
    if ('ontouchstart' in window) {
        if (cursorFollower) cursorFollower.style.display = 'none';
        if (cursorDot) cursorDot.style.display = 'none';
    }

});

// ===================================
// GSAP-like Animation Helper (Vanilla JS)
// ===================================
class Animator {
    static fadeIn(element, duration = 500, delay = 0) {
        element.style.opacity = '0';
        element.style.transition = `opacity ${duration}ms ease ${delay}ms`;

        requestAnimationFrame(() => {
            element.style.opacity = '1';
        });
    }

    static slideUp(element, duration = 500, delay = 0) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = `opacity ${duration}ms ease ${delay}ms, transform ${duration}ms ease ${delay}ms`;

        requestAnimationFrame(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        });
    }

    static stagger(elements, animationType = 'slideUp', staggerDelay = 100) {
        elements.forEach((el, index) => {
            const delay = index * staggerDelay;
            this[animationType](el, 500, delay);
        });
    }
}

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Animator };
}

// ===================================
// 공통 장바구니 유틸리티
// ===================================
window.addToCartUtil = function() {
    // 대리점 회원 체크
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
        alert('대리점 회원만 구매가 가능합니다.\n로그인 후 이용해주세요.');
        window.location.href = 'login.html';
        return false;
    }

    const user = JSON.parse(userStr);
    if (user.grade !== 'dealer') {
        alert('대리점 회원만 장바구니 및 구매가 가능합니다.\n대리점 가입 문의: 1588-0000');
        return false;
    }

    // cartApi가 있으면 사용
    if (typeof cartApi !== 'undefined') {
        // 상품 정보 추출
        const nameEl = document.querySelector('.product-title-detail, .product-title, h1');
        const name = nameEl ? nameEl.textContent.trim() : '상품';

        const priceEl = document.querySelector('.price-sale-detail, .price-current, .current-price');
        const price = priceEl ? parseInt(priceEl.textContent.replace(/[^\d]/g, '')) : 0;

        const originalPriceEl = document.querySelector('.price-original-detail, .price-original, .original-price');
        const originalPrice = originalPriceEl ? parseInt(originalPriceEl.textContent.replace(/[^\d]/g, '')) : price;

        const pvEl = document.querySelector('.price-pv-detail, .product-pv, [class*="pv"]');
        const pv = pvEl ? parseInt(pvEl.textContent.replace(/[^\d]/g, '')) || 0 : 0;

        const imageEl = document.getElementById('mainImage') || document.querySelector('.product-image img, .main-image img');
        const image = imageEl ? imageEl.src : '';

        const qtyEl = document.getElementById('quantity') || document.querySelector('.qty-input');
        const quantity = qtyEl ? parseInt(qtyEl.value) || 1 : 1;

        const optionEl = document.querySelector('.option-btn.active, .option-select option:checked');
        const option = optionEl ? optionEl.textContent.trim() : '기본';

        const categoryEl = document.querySelector('.product-brand-detail, .product-category, .item-category');
        const category = categoryEl ? categoryEl.textContent.trim() : '';

        // 고유 ID 생성 (페이지 경로 + 옵션)
        const productId = window.location.pathname.replace(/\.html$/, '').replace(/\//g, '_') + '_' + option;

        cartApi.addItem({
            id: productId,
            name: name,
            price: price,
            originalPrice: originalPrice,
            pv: pv,
            image: image,
            category: category,
            option: option,
            quantity: quantity
        });
    }

    alert('장바구니에 추가되었습니다.');
    return true;
};

window.buyNowUtil = function() {
    if (window.addToCartUtil()) {
        window.location.href = 'cart.html';
    }
};
