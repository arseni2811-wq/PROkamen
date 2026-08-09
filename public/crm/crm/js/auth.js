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

      // Сохраняем данные пользователя для отображения в интерфейсе
      // ВАЖНО: роль и права проверяются на сервере через JWT, а не из localStorage
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      window.location.href = "dashboard.html";
    } catch (error) {
      errorMessage.textContent =
        error.message || "Ошибка соединения с сервером";
      errorMessage.classList.remove("hidden");
    }
  });
