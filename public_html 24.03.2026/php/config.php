<?php
// Настройки SMTP
define('SMTP_HOST', 'smtp.yandex.ru');
define('SMTP_PORT', 465);
define('SMTP_USER', 'prokamen22@yandex.by'); // Ваш email
define('SMTP_PASS', 'your_password_here'); // Пароль приложения
define('SMTP_SECURE', 'ssl');

// Email получателя заявок
define('RECIPIENT_EMAIL', 'prokamen22@yandex.by');

// Настройки для формы
define('MAX_MESSAGE_LENGTH', 1000);
define('MIN_MESSAGE_LENGTH', 10);
define('MIN_NAME_LENGTH', 2);

// Путь к файлу логов
define('LOG_FILE', __DIR__ . '/mail.log');

// Настройки безопасности
define('CSRF_TIMEOUT', 3600); // Время жизни CSRF токена (1 час)