// =========================================================
// ЦЕНТРАЛИЗОВАННОЕ РЕАКТИВНОЕ ХРАНИЛИЩЕ (STORE)
// Sprint 3: Управление глобальными состояниями
// =========================================================

const Store = (function () {
  // Приватное состояние
  const _state = {
    currentUser: null,
    exchangeRate: 3.2,
    calculatorDraft: {},
    settings: {},
  };

  // Подписчики на изменения
  const _listeners = new Map();

  // Уникальный ID для подписчиков
  let listenerId = 0;

  // =========================================================
  // ГЕТТЕРЫ
  // =========================================================

  function getState() {
    return { ..._state };
  }

  function getUser() {
    return _state.currentUser;
  }

  function getExchangeRate() {
    return _state.exchangeRate;
  }

  function getCalculatorDraft(orderId) {
    return _state.calculatorDraft[orderId] || null;
  }

  function getSettings() {
    return { ..._state.settings };
  }

  // =========================================================
  // СЕТТЕРЫ С УВЕДОМЛЕНИЕМ ПОДПИСЧИКОВ
  // =========================================================

  function setUser(user) {
    _state.currentUser = user;
    _notify("currentUser", user);
  }

  function setExchangeRate(rate) {
    _state.exchangeRate = rate;
    _notify("exchangeRate", rate);
  }

  function setCalculatorDraft(orderId, data) {
    if (!_state.calculatorDraft[orderId]) {
      _state.calculatorDraft[orderId] = {};
    }
    Object.assign(_state.calculatorDraft[orderId], data);
    _notify("calculatorDraft", { orderId, data });
  }

  function clearCalculatorDraft(orderId) {
    if (_state.calculatorDraft[orderId]) {
      delete _state.calculatorDraft[orderId];
      _notify("calculatorDraft", { orderId, data: null });
    }
  }

  function setSettings(settings) {
    _state.settings = { ..._state.settings, ...settings };
    _notify("settings", _state.settings);
  }

  // =========================================================
  // ПОДПИСКИ
  // =========================================================

  function subscribe(key, callback) {
    const id = ++listenerId;

    if (!_listeners.has(key)) {
      _listeners.set(key, new Map());
    }

    _listeners.get(key).set(id, callback);

    // Возвращаем функцию отписки
    return function unsubscribe() {
      _listeners.get(key).delete(id);
    };
  }

  function _notify(key, value) {
    if (_listeners.has(key)) {
      _listeners.get(key).forEach((callback) => {
        try {
          callback(value);
        } catch (error) {
          console.error(`Ошибка в подписчике store.${key}:`, error);
        }
      });
    }
  }

  // =========================================================
  // ИНИЦИАЛИЗАЦИЯ ИЗ LOCALSTORAGE
  // =========================================================

  function initFromStorage() {
    try {
      // Загружаем пользователя
      const userStr = localStorage.getItem("currentUser");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user && typeof user === "object") {
          _state.currentUser = user;
        }
      }

      // Загружаем настройки
      const settingsStr = localStorage.getItem("crm_settings");
      if (settingsStr) {
        const settings = JSON.parse(settingsStr);
        _state.settings = settings;
        if (settings.exchangeRate) {
          _state.exchangeRate = settings.exchangeRate;
        }
      }

      // Загружаем черновики калькулятора
      const draftsStr = localStorage.getItem("crm_calc_draft");
      if (draftsStr) {
        const drafts = JSON.parse(draftsStr);
        _state.calculatorDraft = drafts;
      }
    } catch (error) {
      console.error("Ошибка инициализации store из localStorage:", error);
    }
  }

  // =========================================================
  // СИНХРОНИЗАЦИЯ С LOCALSTORAGE
  // =========================================================

  function syncUserToStorage() {
    if (_state.currentUser) {
      localStorage.setItem("currentUser", JSON.stringify(_state.currentUser));
    } else {
      localStorage.removeItem("currentUser");
    }
  }

  function syncSettingsToStorage() {
    localStorage.setItem("crm_settings", JSON.stringify(_state.settings));
  }

  function syncDraftToStorage(orderId, data) {
    try {
      const all = JSON.parse(localStorage.getItem("crm_calc_draft") || "{}");
      if (data) {
        all[orderId] = { data, savedAt: Date.now() };
      } else {
        delete all[orderId];
      }
      localStorage.setItem("crm_calc_draft", JSON.stringify(all));
    } catch (error) {
      console.warn("Не удалось синхронизировать черновик:", error);
    }
  }

  // =========================================================
  // ОЧИСТКА
  // =========================================================

  function clear() {
    _state.currentUser = null;
    _state.exchangeRate = 3.2;
    _state.calculatorDraft = {};
    _state.settings = {};

    localStorage.removeItem("currentUser");
    localStorage.removeItem("crm_settings");
    localStorage.removeItem("crm_calc_draft");
    localStorage.removeItem("crm_token");

    _notify("currentUser", null);
    _notify("exchangeRate", 3.2);
    _notify("calculatorDraft", {});
    _notify("settings", {});
  }

  // =========================================================
  // ПУБЛИЧНЫЙ API
  // =========================================================

  return {
    // Геттеры
    getState,
    getUser,
    getExchangeRate,
    getCalculatorDraft,
    getSettings,

    // Сеттеры
    setUser,
    setExchangeRate,
    setCalculatorDraft,
    clearCalculatorDraft,
    setSettings,

    // Подписки
    subscribe,

    // Синхронизация
    syncUserToStorage,
    syncSettingsToStorage,
    syncDraftToStorage,

    // Инициализация
    initFromStorage,

    // Очистка
    clear,
  };
})();

// Автоматическая инициализация при загрузке
if (typeof window !== "undefined") {
  Store.initFromStorage();
}

// Экспорт для модулей
if (typeof module !== "undefined" && module.exports) {
  module.exports = Store;
}
