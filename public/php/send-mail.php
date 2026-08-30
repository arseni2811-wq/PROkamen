<?php
header('Content-Type: text/plain; charset=utf-8');

// Защита от прямого доступа
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Method Not Allowed');
}

function consumeContactRateLimit($maxAttempts = 10, $windowSeconds = 900) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = sys_get_temp_dir() . '/prokamen_contact_' . hash('sha256', $ip) . '.json';
    $handle = @fopen($file, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) fclose($handle);
        return 0;
    }
    $raw = stream_get_contents($handle);
    $now = time();
    $bucket = $raw ? json_decode($raw, true) : null;
    if (!is_array($bucket) || ($bucket['reset_at'] ?? 0) <= $now) {
        $bucket = ['count' => 0, 'reset_at' => $now + $windowSeconds];
    }
    $bucket['count']++;
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($bucket));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    return $bucket['count'] > $maxAttempts ? max(1, $bucket['reset_at'] - $now) : 0;
}

$retryAfter = consumeContactRateLimit();
if ($retryAfter > 0) {
    header('Retry-After: ' . $retryAfter);
    http_response_code(429);
    exit('Too Many Requests');
}

// Функция для проверки доступности почтового сервера
function checkMailServer($host = 'localhost', $port = 25) {
    $connection = @fsockopen($host, $port, $errno, $errstr, 5);
    if (is_resource($connection)) {
        fclose($connection);
        return true;
    }
    error_log("Ошибка соединения с почтовым сервером: {$errstr} ({$errno})");
    return false;
}

// Настройка для работы через cPanel
ini_set('SMTP', 'localhost');
ini_set('smtp_port', '25');

// Проверяем доступность почтового сервера
if (!checkMailServer()) {
    error_log("Почтовый сервер недоступен");
}

// ==========================
// 1. Настройки
// ==========================
$to = getenv('PROKAMEN_RECIPIENT_EMAIL') ?: '';
if (!$to || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    error_log("Получатель формы не настроен");
    http_response_code(503);
    exit("Сервис отправки временно недоступен");
}
$subject = "=?UTF-8?B?".base64_encode("Новая заявка с сайта PRO Камень")."?="; // тема письма в UTF-8

// ==========================
// 2. Получаем и очищаем данные из формы
// ==========================

function sanitizeInput($data) {
    if (is_array($data)) {
        return array_map('sanitizeInput', $data);
    }
    $data = trim($data);
    $data = strip_tags($data);
    $data = htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
    return $data;
}

// Проверка на спам (простая защита)
function isSpam($message, $name) {
    $spamTriggers = ['viagra', 'casino', 'http://', 'https://', '[url=', '[link='];
    $message = strtolower($message);
    $name = strtolower($name);
    
    // Проверка на спам-триггеры
    foreach ($spamTriggers as $trigger) {
        if (strpos($message, $trigger) !== false || strpos($name, $trigger) !== false) {
            error_log("Обнаружен спам-триггер: " . $trigger);
            return true;
        }
    }
    
    // Проверка на слишком много ссылок
    if (substr_count($message, 'www.') > 2) {
        error_log("Слишком много ссылок в сообщении");
        return true;
    }
    
    return false;
}

// Очищаем входные данные
$name    = sanitizeInput($_POST["name"] ?? "");    // имя
$phone   = sanitizeInput($_POST["phone"] ?? "");   // телефон
$email   = sanitizeInput($_POST["email"] ?? "");   // e-mail (необязателен)
$message = sanitizeInput($_POST["message"] ?? ""); // текст сообщения

// Проверка на спам
if (isSpam($message, $name)) {
    http_response_code(403);
    echo "Сообщение отклонено системой защиты";
    exit;
}

// ==========================
// 3. Проверка обязательных полей и валидация
// ==========================

function validateInput($data) {
    $errors = array();
    
    // Проверка имени
    if (!$data['name'] || strlen($data['name']) < 2) {
        $errors[] = "Имя должно содержать не менее 2 символов";
    }
    
    // Проверка телефона
    if (!$data['phone'] || !preg_match('/^[+0-9()\s\-]{7,}$/', $data['phone'])) {
        $errors[] = "Введите корректный номер телефона";
    }
    
    // Проверка email если указан
    if ($data['email'] && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        $errors[] = "Неверный формат email";
    }
    
    // Проверка сообщения
    if (!$data['message'] || strlen($data['message']) < 10) {
        $errors[] = "Сообщение должно содержать не менее 10 символов";
    }
    
    return $errors;
}

// Проводим валидацию
$validationErrors = validateInput([
    'name' => $name,
    'phone' => $phone,
    'email' => $email,
    'message' => $message
]);

// Если есть ошибки, возвращаем их
if (!empty($validationErrors)) {
    http_response_code(400);
    echo implode("\n", $validationErrors);
    error_log("[" . date('Y-m-d H:i:s') . "] Ошибки валидации формы: " . implode(", ", $validationErrors));
    exit;
}

// ==========================
// 4. Формируем письмо
// ==========================

// Функция для форматирования текста письма
function formatEmailBody($data) {
    $date = date('d.m.Y H:i:s');
    $ip = $_SERVER['REMOTE_ADDR'];
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Неизвестно';
    
    $body = "=== Новая заявка с сайта ===\n\n";
    $body .= "Дата: {$date}\n";
    $body .= "IP: {$ip}\n";
    $body .= "Браузер: {$userAgent}\n\n";
    $body .= "--- Данные формы ---\n\n";
    $body .= "Имя: {$data['name']}\n";
    $body .= "Телефон: {$data['phone']}\n";
    
    if ($data['email']) {
        $body .= "E-mail: {$data['email']}\n";
    }
    
    $body .= "\nСообщение:\n{$data['message']}\n";
    $body .= "\n=== Конец заявки ===";
    
    return $body;
}

// Формируем тело письма
$body = formatEmailBody([
    'name' => $name,
    'phone' => $phone,
    'email' => $email,
    'message' => $message
]);

// Заголовки письма с учетом специфики cPanel
$domain = $_SERVER['SERVER_NAME'];
$from_email = "no-reply@" . $domain;

$headers = array(
    'MIME-Version' => '1.0',
    'Content-Type' => 'text/plain; charset=UTF-8',
    'From' => $from_email,
    'Return-Path' => $from_email,
    'X-Mailer' => 'PHP/' . phpversion(),
    'X-Priority' => '3'
);

// Добавляем Reply-To только если email валиден
if ($email && filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $headers['Reply-To'] = $email;
}

// Формируем строку заголовков для cPanel
$headerString = '';
foreach($headers as $name => $value) {
    $headerString .= "$name: $value\r\n";
}

// ==========================
// 5. Отправляем письмо
// ==========================
try {
    // Логируем попытку отправки
    error_log("[" . date('Y-m-d H:i:s') . "] Попытка отправки формы");
    
    // Проверяем настройки SMTP
    $smtp_host = ini_get('SMTP');
    $smtp_port = ini_get('smtp_port');
    error_log("SMTP настройки: host={$smtp_host}, port={$smtp_port}");
    
    // Дополнительная проверка данных
    if (strlen($message) > 1000) {
        throw new Exception("Сообщение слишком длинное");
    }
    
    if (mail($to, $subject, $body, $headerString)) {
        // Логируем успешную отправку
        error_log("[" . date('Y-m-d H:i:s') . "] Письмо успешно отправлено");
        http_response_code(200);
        echo "OK";
    } else {
        // Получаем последнюю ошибку PHP
        $error = error_get_last();
        throw new Exception("Ошибка отправки почты: " . ($error ? $error['message'] : 'Неизвестная ошибка'));
    }
} catch (Exception $e) {
    // Детальное логирование ошибки
    error_log("[" . date('Y-m-d H:i:s') . "] Ошибка отправки формы: " . $e->getMessage());
    
    http_response_code(500);
    echo "Ошибка отправки! Пожалуйста, попробуйте позже или свяжитесь с нами по телефону.";
}
