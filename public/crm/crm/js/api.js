// =========================================================
// ЕДИНЫЙ API-КЛИЕНТ ДЛЯ CRM "PRO Камень"
// =========================================================
// Централизует все HTTP-запросы к бэкенду:
// - единый базовый URL (динамический, без хардкода localhost)
// - автоматическая отправка credentials (cookies)
// - перехват 401 → редирект на login
// - обработка ошибок сети
// =========================================================

// Динамический базовый URL: использует текущий hostname браузера, но порт 3000
// Это решает проблему CORS при открытии на 127.0.0.1 vs localhost
const API_BASE_URL =
  window.location.protocol + "//" + window.location.hostname + ":3000";

/**
 * Единая функция для всех API-запросов.
 * @param {string} endpoint - путь вида "/api/orders" (без базового URL)
 * @param {object} options - настройки fetch (method, body, headers и т.д.)
 * @returns {Promise<any>} - распарсенный JSON-ответ
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  // JWT из localStorage для заголовка Authorization: Bearer <token>
  // (страховка на случай, когда httpOnly cookie не отправляется браузером
  // из-за sameSite/cross-origin → иначе запрос падает с 401).
  const token = localStorage.getItem("crm_token");

  const config = {
    credentials: "include", // обязательно для httpOnly cookie с JWT
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  };

  // Если передаётся FormData — удаляем Content-Type, пусть браузер сам
  if (options.body instanceof FormData) {
    const headers = { ...(options.headers || {}) };
    delete headers["Content-Type"];
    config.headers = headers;
  }

  try {
    const response = await fetch(url, config);

    // 401 — токен протух или отсутствует → редирект на логин
    if (response.status === 401) {
      // КРИТИЧЕСКОЕ ЛОГИРОВАНИЕ для отладки auth loop
      console.error(
        "!!! КРИТИЧЕСКАЯ ОШИБКА 401 !!! Запрос, убивший сессию:",
        url,
        config,
      );
      console.error("Стек вызова:", new Error().stack);
      alert("Ошибка 401 на запросе: " + url + ". Посмотрите консоль!");

      // Очищаем localStorage от данных пользователя
      localStorage.removeItem("currentUser");
      // Если мы не на странице логина — редиректим
      if (!window.location.pathname.includes("login.html")) {
        window.location.href = "login.html";
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Не авторизован");
    }

    // 403 — нет прав → НЕ редиректим, остаёмся на странице
    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          "Доступ запрещен. У вас нет прав для выполнения этого действия.",
      );
    }

    // 204 No Content — успех без тела
    if (response.status === 204) {
      return null;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Ошибка сервера: ${response.status}`);
    }

    return data;
  } catch (error) {
    // Если это уже наша ошибка с сообщением — пробрасываем
    if (error.message && !error.message.includes("Failed to fetch")) {
      throw error;
    }
    // Ошибка сети / CORS / сервер недоступен
    console.error(`🌐 Сетевая ошибка при запросе ${endpoint}:`, error);
    throw new Error("Сервер недоступен. Проверьте подключение к бэкенду.");
  }
}

// =========================================================
// УДОБНЫЕ ОБЁРТКИ ДЛЯ ЧАСТО ИСПОЛЬЗУЕМЫХ ЗАПРОСОВ
// =========================================================

const api = {
  // --- АВТОРИЗАЦИЯ ---
  login: (login, password) =>
    apiFetch("/api/login", {
      method: "POST",
      body: JSON.stringify({ login, password }),
    }),

  logout: () => apiFetch("/api/logout", { method: "POST" }),

  // --- НАСТРОЙКИ ---
  updateSettings: (settings) =>
    apiFetch("/api/exchange-rate", {
      method: "PUT",
      body: JSON.stringify({ exchange_rate: settings.exchangeRate }),
    }),

  // --- ЗАКАЗЫ ---
  getOrders: () => apiFetch("/api/orders"),

  getOrder: (id) => apiFetch(`/api/orders/${id}`),

  createOrder: (data) =>
    apiFetch("/api/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateOrder: (id, data) =>
    apiFetch(`/api/orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  updateOrderStatus: (id, status_id) =>
    apiFetch(`/api/orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status_id }),
    }),

  // --- ФАЙЛЫ ---
  uploadFiles: (orderId, files, fileType) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    fd.append("file_type", fileType);
    return apiFetch(`/api/orders/${orderId}/upload`, {
      method: "POST",
      body: fd,
    });
  },

  getAttachments: (orderId) => apiFetch(`/api/orders/${orderId}/attachments`),

  downloadPdf: async (orderId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/orders/${orderId}/pdf`,
        {
          credentials: "include",
        },
      );

      if (response.status === 401) {
        localStorage.removeItem("currentUser");
        if (!window.location.pathname.includes("login.html")) {
          window.location.href = "login.html";
        }
        throw new Error("Сессия истекла. Войдите снова.");
      }

      if (response.status === 403) {
        throw new Error("Доступ запрещен. Нет прав на скачивание.");
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Ошибка генерации PDF");
      }
      return response.blob();
    } catch (error) {
      if (error.message && !error.message.includes("Failed to fetch")) {
        throw error;
      }
      console.error(`🌐 Ошибка скачивания PDF для заказа ${orderId}:`, error);
      throw new Error(
        "Не удалось скачать PDF. Проверьте подключение к серверу.",
      );
    }
  },

  // --- КЛИЕНТЫ ---
  getClients: () => apiFetch("/api/clients"),

  // --- МАТЕРИАЛЫ ---
  getMaterials: () => apiFetch("/api/materials"),

  createMaterial: (data) =>
    apiFetch("/api/materials", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateMaterial: (id, data) =>
    apiFetch(`/api/materials/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteMaterial: (id) =>
    apiFetch(`/api/materials/${id}`, { method: "DELETE" }),

  // --- УСЛУГИ (ПРАЙС) ---
  getServices: () => apiFetch("/api/services"),

  updateServices: (services) =>
    apiFetch("/api/services", {
      method: "PUT",
      body: JSON.stringify(services),
    }),
};

// =========================================================
// ХРАНИЛИЩЕ ЧЕРНОВИКОВ (DRAFT) ДЛЯ КАЛЬКУЛЯТОРА
// =========================================================

const draftStorage = {
  _key: "crm_calc_draft",

  save(orderId, data) {
    try {
      const all = JSON.parse(localStorage.getItem(this._key) || "{}");
      all[orderId] = { data, savedAt: Date.now() };
      localStorage.setItem(this._key, JSON.stringify(all));
    } catch (e) {
      console.warn("Не удалось сохранить черновик:", e);
    }
  },

  load(orderId) {
    try {
      const all = JSON.parse(localStorage.getItem(this._key) || "{}");
      const draft = all[orderId];
      if (!draft) return null;
      // Черновики старше 24 часов считаем устаревшими
      if (Date.now() - draft.savedAt > 86400000) {
        this.remove(orderId);
        return null;
      }
      return draft.data;
    } catch (e) {
      return null;
    }
  },

  remove(orderId) {
    try {
      const all = JSON.parse(localStorage.getItem(this._key) || "{}");
      delete all[orderId];
      localStorage.setItem(this._key, JSON.stringify(all));
    } catch (e) {
      // игнорируем
    }
  },

  clear() {
    localStorage.removeItem(this._key);
  },
};
