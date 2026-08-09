// /crm/crm/js/database.js
// Этот файл теперь будет содержать функции для взаимодействия с API бэкенда.
// Старая логика с localStorage и initDatabase() больше не нужна.

/**
 * Базовая функция для отправки запросов к API.
 * @param {string} endpoint - Путь к API, например, '/api/orders'
 * @param {object} options - Настройки для fetch (method, headers, body)
 * @returns {Promise<any>}
 */
async function apiRequest(endpoint, options = {}) {
  // Здесь можно будет добавить логику для токенов авторизации
  const defaultHeaders = {
    "Content-Type": "application/json",
    // 'Authorization': `Bearer ${localStorage.getItem('authToken')}`
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(endpoint, config);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || `Ошибка сервера: ${response.status}`,
      );
    }
    // Для DELETE или других запросов, которые могут не возвращать тело
    if (response.status === 204) {
      return null;
    }
    return response.json();
  } catch (error) {
    console.error(`Ошибка API запроса к ${endpoint}:`, error);
    // Здесь можно показать уведомление пользователю
    alert(`Произошла ошибка: ${error.message}`);
    throw error;
  }
}

// Примеры экспортных функций, которые будут использоваться в других частях приложения

export const db = {
  getOrders: (params) =>
    apiRequest(`/api/orders?${new URLSearchParams(params)}`),
  getOrderById: (id) => apiRequest(`/api/orders/${id}`),
  updateOrder: (id, data) =>
    apiRequest(`/api/orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  createOrder: (data) =>
    apiRequest("/api/orders", { method: "POST", body: JSON.stringify(data) }),
  // ... и так далее для всех сущностей (clients, catalog, etc.)
};
