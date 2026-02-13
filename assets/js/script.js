/**
 * PPS Article System - Enhanced Script
 * Pajajaran Physical Society
 *
 * Improvements:
 * - Better error handling
 * - Loading states
 * - Local storage caching
 * - Debounced search
 * - Smooth animations
 * - Accessibility improvements
 * - Performance optimizations
 * + Micro interactions: Ripple + Press animation (cards/chips/buttons/links)
 */

// ==========================================
// CONFIGURATION
// ==========================================

const CONFIG = {
  dataPath: 'data/articles.txt',
  cacheKey: 'pps_articles_cache',
  cacheDuration: 5 * 60 * 1000, // 5 minutes
  searchDebounce: 300, // ms
  wordsPerMinute: 200,
  animationDuration: 300,
  topics: ['all', 'Konten', 'Berita', 'Edukasi']
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Debounce function to limit execution rate
 */
function debounce(func, wait) {
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

/**
 * Escape HTML to prevent XSS
 */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/**
 * Sanitize HTML content (basic sanitization)
 */
function sanitizeHTML(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Remove script tags
  const scripts = temp.querySelectorAll('script');
  scripts.forEach(script => script.remove());

  // Remove event handlers
  const allElements = temp.querySelectorAll('*');
  allElements.forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return temp.innerHTML;
}

/**
 * Get URL parameter value
 */
function getURLParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

/**
 * Format date to Indonesian format
 */
function formatDate(isoDate) {
  try {
    const date = new Date(isoDate + 'T00:00:00');
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Date formatting error:', error);
    return isoDate;
  }
}

/**
 * Calculate reading time in minutes
 */
function calculateReadingTime(html) {
  const text = (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = text ? text.split(' ').length : 0;
  return Math.max(1, Math.ceil(words / CONFIG.wordsPerMinute));
}

/**
 * Show loading indicator
 */
function showLoading(element) {
  element.innerHTML = `
    <div class="card col-12" style="padding: 40px; text-align: center;">
      <div class="loading" style="margin: 0 auto 16px;"></div>
      <p class="card-excerpt">Memuat artikel...</p>
    </div>
  `;
}

/**
 * Show error message
 */
function showError(element, message) {
  element.innerHTML = `
    <div class="card col-12" style="padding: 24px; background: #fee; outline-color: #fcc;">
      <div class="card-title" style="color: #c33;">⚠️ Error</div>
      <p class="card-excerpt" style="color: #a22;">${escapeHTML(message)}</p>
      <button onclick="location.reload()" class="chip" style="margin-top: 12px;">
        Muat Ulang
      </button>
    </div>
  `;
}

/**
 * Show empty state
 */
function showEmptyState(element, message = 'Tidak ada artikel ditemukan') {
  element.innerHTML = `
    <div class="card col-12" style="padding: 40px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
      <div class="card-title">${escapeHTML(message)}</div>
      <p class="card-excerpt">Coba ganti filter atau kata kunci pencarian.</p>
    </div>
  `;
}

// ==========================================
// MICRO INTERACTIONS (RIPPLE + PRESS)
// ==========================================

const PREFERS_REDUCED_MOTION =
  window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

const MICRO_NAV_DELAY = 170; // ms supaya animasi terlihat sebelum pindah halaman

function pressAnim(el) {
  if (PREFERS_REDUCED_MOTION || !el || typeof el.animate !== 'function') return;

  el.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(0.985)' },
      { transform: 'scale(1)' }
    ],
    { duration: 160, easing: 'ease-out' }
  );
}

function rippleAnim(target, ev) {
  if (PREFERS_REDUCED_MOTION || !target) return;

  const rect = target.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);

  const clientX =
    ev && typeof ev.clientX === 'number' ? ev.clientX : rect.left + rect.width / 2;
  const clientY =
    ev && typeof ev.clientY === 'number' ? ev.clientY : rect.top + rect.height / 2;

  const x = clientX - rect.left - size / 2;
  const y = clientY - rect.top - size / 2;

  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;

  const cs = getComputedStyle(target);
  if (cs.position === 'static') target.style.position = 'relative';
  if (cs.overflow === 'visible') target.style.overflow = 'hidden';

  target.appendChild(ripple);
  setTimeout(() => ripple.remove(), 650);
}

/**
 * Event delegation -> otomatis berlaku untuk konten yang dirender ulang (cards)
 */
function initMicroInteractions() {
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t) return;

    // Element yang diberi animasi
    const el = t.closest('.card, .chip, .page-btn, .panel a, .search-icon');
    if (!el) return;

    rippleAnim(el, e);
    pressAnim(el);

    // Delay navigasi hanya untuk CARD (biar ripple terlihat)
    if (el.classList.contains('card') && el.tagName === 'A') {
      // jangan ganggu middle-click / ctrl-cmd click / open new tab
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const href = el.getAttribute('href');
      const targetAttr = (el.getAttribute('target') || '').toLowerCase();
      const openNew = targetAttr === '_blank';

      if (!href || href === '#' || openNew) return;

      e.preventDefault();
      setTimeout(() => {
        window.location.href = href;
      }, MICRO_NAV_DELAY);
    }
  });

  // Keyboard support (Enter/Space) untuk tombol
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const active = document.activeElement;
    if (!active) return;

    const el = active.closest?.('.chip, .page-btn');
    if (!el) return;

    rippleAnim(el, null);
    pressAnim(el);
  });
}

// ==========================================
// DATA MANAGEMENT
// ==========================================

/**
 * Load articles from file or cache
 */
async function loadArticles() {
  try {
    // Check cache first
    const cached = getCachedData();
    if (cached) {
      console.log('Using cached data');
      return cached;
    }

    // Fetch from file
    console.log('Fetching fresh data...');
    const response = await fetch(CONFIG.dataPath, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Validate data
    if (!Array.isArray(data)) {
      throw new Error('Data format invalid: expected array');
    }

    // Cache the data
    setCachedData(data);

    return data;
  } catch (error) {
    console.error('Error loading articles:', error);
    throw new Error(`Gagal memuat data: ${error.message}`);
  }
}

/**
 * Get cached data if valid
 */
function getCachedData() {
  try {
    const cached = localStorage.getItem(CONFIG.cacheKey);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid
    if (now - timestamp < CONFIG.cacheDuration) {
      return data;
    }

    // Clear expired cache
    localStorage.removeItem(CONFIG.cacheKey);
    return null;
  } catch (error) {
    console.error('Cache retrieval error:', error);
    return null;
  }
}

/**
 * Set cached data
 */
function setCachedData(data) {
  try {
    const cacheObject = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(CONFIG.cacheKey, JSON.stringify(cacheObject));
  } catch (error) {
    console.error('Cache storage error:', error);
  }
}

/**
 * Clear cache
 */
function clearCache() {
  try {
    localStorage.removeItem(CONFIG.cacheKey);
    console.log('Cache cleared');
  } catch (error) {
    console.error('Cache clear error:', error);
  }
}

// ==========================================
// HTML GENERATION
// ==========================================

/**
 * Generate card HTML for article list
 */
function generateCardHTML(article) {
  const coverHTML = article.cover
    ? `<img src="${escapeHTML(article.cover)}" alt="${escapeHTML(article.title)}" loading="lazy" />`
    : '';

  return `
    <a class="card col-4"
       href="article-detail.html?id=${encodeURIComponent(article.id)}"
       data-topic="${escapeHTML(article.topic)}"
       data-title="${escapeHTML(article.title)}"
       aria-label="Baca artikel ${escapeHTML(article.title)}">
      <div class="card-media">${coverHTML}</div>
      <div class="card-body">
        <div class="card-topic">
          <span class="dot" aria-hidden="true"></span>
          ${escapeHTML(article.topic)}
        </div>
        <h3 class="card-title">${escapeHTML(article.title)}</h3>
        <p class="card-excerpt">${escapeHTML(article.excerpt || '')}</p>
        <div class="card-meta">
          <span>📅 ${escapeHTML(formatDate(article.date))}</span>
          <span aria-hidden="true">•</span>
          <span>✏️ ${escapeHTML(article.author || 'Anonim')}</span>
        </div>
      </div>
    </a>
  `;
}

/**
 * Generate detail page HTML
 */
function generateDetailHTML(article) {
  const coverHTML = article.cover ? `
    <div class="article-cover">
      <img src="${escapeHTML(article.cover)}" alt="Cover ${escapeHTML(article.title)}" />
    </div>
  ` : '';

  const readingTime = calculateReadingTime(article.content || '');
  const sanitizedContent = sanitizeHTML(article.content || '<p>Konten tidak tersedia.</p>');

  return `
    <section class="hero" role="banner" aria-label="Header artikel">
      <div class="hero-inner">
        <div class="hero-kicker">
          ARTIKEL • <span style="opacity:.9">TOPIK: ${escapeHTML(article.topic)}</span>
        </div>
        <h1 class="hero-title">${escapeHTML(article.title)}</h1>
        <p class="hero-sub">${escapeHTML(article.excerpt || '')}</p>
      </div>
    </section>

    <div class="article-shell">
      <article class="article" role="main">
        ${coverHTML}

        <header class="article-head">
          <div class="meta-bar">
            <span class="badge">
              <span class="dot" aria-hidden="true"></span>
              ${escapeHTML(article.topic)}
            </span>
            <span>📅 ${escapeHTML(formatDate(article.date))}</span>
            <span>✏️ ${escapeHTML(article.author || 'Anonim')}</span>
            <span>⏱️ ${readingTime} menit baca</span>
          </div>

          <h1 class="article-title">${escapeHTML(article.title)}</h1>
        </header>

        <section class="article-content">
          ${sanitizedContent}
        </section>
      </article>

      <aside class="aside" role="complementary" aria-label="Informasi tambahan">
        <div class="panel">
          <h4>Info Artikel</h4>
          <div style="padding: 4px 10px;">
            <div style="margin-bottom: 8px;">
              <strong>Topik:</strong> ${escapeHTML(article.topic)}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>Tanggal:</strong> ${escapeHTML(formatDate(article.date))}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>Penulis:</strong> ${escapeHTML(article.author || 'Anonim')}
            </div>
            <div>
              <strong>Waktu Baca:</strong> ${readingTime} menit
            </div>
          </div>
        </div>

        <div class="panel">
          <h4>Navigasi</h4>
          <a href="article-list.html">← Kembali ke daftar</a>
          <a href="#" onclick="window.print(); return false;">🖨️ Cetak artikel</a>
          <a href="#"
             onclick="navigator.share?.({title: '${escapeHTML(article.title)}', url: window.location.href}); return false;">
             📤 Bagikan
          </a>
        </div>
      </aside>
    </div>
  `;
}

// ==========================================
// ARTICLE LIST PAGE
// ==========================================

/**
 * Initialize article list page
 */
async function initArticleList() {
  const cardsContainer = document.getElementById('cards');
  if (!cardsContainer) return;

  const searchInput = document.getElementById('q');
  const searchButton = document.getElementById('btnSearch');
  const topicChips = document.querySelectorAll('.chip[data-topic]');

  let articles = [];
  let activeTopicFilter = 'all';
  let searchQuery = '';

  // Show loading state
  showLoading(cardsContainer);

  try {
    // Load articles
    articles = await loadArticles();

    // Apply filters and render
    const applyFilters = () => {
      const query = (searchQuery || '').toLowerCase().trim();

      const filtered = articles.filter(article => {
        const matchesTopic =
          activeTopicFilter === 'all' || article.topic === activeTopicFilter;

        const matchesSearch =
          !query ||
          (article.title || '').toLowerCase().includes(query) ||
          (article.excerpt || '').toLowerCase().includes(query);

        return matchesTopic && matchesSearch;
      });

      if (filtered.length === 0) {
        showEmptyState(cardsContainer);
      } else {
        cardsContainer.innerHTML = filtered.map(generateCardHTML).join('');

        // Optional: fade-in animation (butuh keyframes fadeInUp di CSS)
        requestAnimationFrame(() => {
          const cards = cardsContainer.querySelectorAll('.card');
          cards.forEach((card, index) => {
            card.style.animation = `fadeInUp 0.5s ease ${index * 0.05}s both`;
          });
        });
      }

      cardsContainer.setAttribute('aria-live', 'polite');
      cardsContainer.setAttribute('aria-label', `${filtered.length} artikel ditemukan`);
    };

    // Topic filter event listeners
    topicChips.forEach(chip => {
      chip.addEventListener('click', () => {
        topicChips.forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        activeTopicFilter = chip.dataset.topic;
        applyFilters();
      });
    });

    // Search with debounce
    const debouncedSearch = debounce(() => {
      searchQuery = searchInput?.value || '';
      applyFilters();
    }, CONFIG.searchDebounce);

    searchInput?.addEventListener('input', debouncedSearch);
    searchButton?.addEventListener('click', () => {
      searchQuery = searchInput?.value || '';
      applyFilters();
    });
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        searchQuery = searchInput?.value || '';
        applyFilters();
      }
    });

    // Initial render
    applyFilters();

  } catch (error) {
    showError(cardsContainer, error.message);
  }
}

// ==========================================
// ARTICLE DETAIL PAGE
// ==========================================

/**
 * Initialize article detail page
 */
async function initArticleDetail() {
  const mountElement = document.getElementById('detailMount');
  if (!mountElement) return;

  showLoading(mountElement);

  try {
    const articleId = getURLParam('id');
    const articles = await loadArticles();

    let article = articles.find(a => a.id === articleId);

    if (!article && articles.length > 0) {
      article = articles[0];
      console.warn(`Article with ID "${articleId}" not found, using first article`);
    }

    if (!article) {
      throw new Error('Tidak ada artikel tersedia. Periksa file data/articles.txt');
    }

    document.title = `${article.title} - Pajajaran Physical Society`;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.content = article.excerpt || article.title;

    mountElement.innerHTML = generateDetailHTML(article);

    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (error) {
    showError(mountElement, error.message);
  }
}

// ==========================================
// INITIALIZATION
// ==========================================

/**
 * Initialize the app based on current page
 */
function init() {
  if (window.location.search.includes('clearcache')) {
    clearCache();
    window.location.href = window.location.pathname;
  }

  if (document.getElementById('cards')) {
    initArticleList().catch(error => {
      console.error('List initialization error:', error);
    });
  }

  if (document.getElementById('detailMount')) {
    initArticleDetail().catch(error => {
      console.error('Detail initialization error:', error);
    });
  }

  // ✅ micro interactions aktif untuk seluruh UI (cards/chips/panel links/search icon)
  initMicroInteractions();

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  console.log('PPS Article System initialized');
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging (development only)
if (typeof window !== 'undefined') {
  window.PPS = {
    loadArticles,
    clearCache,
    CONFIG
  };
}
