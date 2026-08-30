// Обработчик события отправки формы входа
document
  .getElementById("loginForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const login = document.getElementById("login").value.trim();
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("errorMessage");

    errorMessage.classList.add("hidden");
    errorMessage.textContent = "";

    try {
      const data = await api.login(login, password);

      // Токен для заголовка Authorization: Bearer <token> (использует apiFetch)
      if (data.token) localStorage.setItem("crm_token", data.token);

      // Сохраняем данные пользователя для отображения в интерфейсе
      // ВАЖНО: роль и права проверяются на сервере через JWT, а не из localStorage
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      window.location.href =
        Number(data.user?.role_id) === 3
          ? "production.html"
          : "dashboard.html";
    } catch (error) {
      errorMessage.textContent =
        error.message || "Ошибка соединения с сервером";
      errorMessage.classList.remove("hidden");
    }
  });
