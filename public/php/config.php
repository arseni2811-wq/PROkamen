<?php
// Настройки SMTP
define('SMTP_HOST', getenv('PROKAMEN_SMTP_HOST') ?: 'localhost');
define('SMTP_PORT', (int) (getenv('PROKAMEN_SMTP_PORT') ?: 25));
define('SMTP_USER', getenv('PROKAMEN_SMTP_USER') ?: '');
define('SMTP_PASS', getenv('PROKAMEN_SMTP_PASSWORD') ?: '');
define('SMTP_SECURE', getenv('PROKAMEN_SMTP_SECURE') ?: '');

// Email получателя заявок
define('RECIPIENT_EMAIL', getenv('PROKAMEN_RECIPIENT_EMAIL') ?: '');

// Настройки для формы
define('MAX_MESSAGE_LENGTH', 1000);
define('MIN_MESSAGE_LENGTH', 10);
define('MIN_NAME_LENGTH', 2);

// Путь к файлу логов
define('LOG_FILE', __DIR__ . '/mail.log');

// Настройки безопасности
define('CSRF_TIMEOUT', 3600); // Время жизни CSRF токена (1 час)
