<?php
/**
 * Admin Panel Handler
 * Обработчик всех операций админ-панели: аутентификация, CRUD материалов и работ
 */

// ========== БЕЗОПАСНОСТЬ И ЛОГИРОВАНИЕ ==========
session_start();
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', 0);

// Логирование ошибок
error_log('Admin action - ' . $_SERVER['REQUEST_METHOD']);

// ========== КОНФИГУРАЦИЯ ==========
$ADMIN_PASSWORD = 'admin123'; // TODO: Измени пароль!
$DATA_DIR = __DIR__ . '/../assets/data/';
$IMAGES_DIR = __DIR__ . '/../assets/images/';
$CATALOG_DIR = $IMAGES_DIR . 'catalog/';
$WORKS_DIR = $IMAGES_DIR . 'works/';
$LOG_FILE = __DIR__ . '/admin.log';

$CATALOG_FILE = $DATA_DIR . 'catalog.json';
$WORKS_FILE = $DATA_DIR . 'works.json';

$MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
$ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
$ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

// Подавление warning при создании файлов
@mkdir($DATA_DIR, 0755, true);
@mkdir($CATALOG_DIR, 0755, true);
@mkdir($WORKS_DIR, 0755, true);

// ========== УТИЛИТЫ ==========
function isAuthenticated() {
    return isset($_SESSION['admin_authenticated']) && $_SESSION['admin_authenticated'] === true;
}

function generateFileName($file) {
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $name = pathinfo($file['name'], PATHINFO_FILENAME);
    $name = transliterate($name);
    // Убираем спецсимволы
    $name = preg_replace('/[^a-z0-9_-]/i', '', $name);
    $unique = bin2hex(random_bytes(4));
    return strtolower($name . '_' . $unique . '.' . $ext);
}

function transliterate($str) {
    $map = [
        'а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'g', 'д' => 'd',
        'е' => 'e', 'ё' => 'yo', 'ж' => 'zh', 'з' => 'z', 'и' => 'i',
        'й' => 'y', 'к' => 'k', 'л' => 'l', 'м' => 'm', 'н' => 'n',
        'о' => 'o', 'п' => 'p', 'р' => 'r', 'с' => 's', 'т' => 't',
        'у' => 'u', 'ф' => 'f', 'х' => 'h', 'ц' => 'ts', 'ч' => 'ch',
        'ш' => 'sh', 'щ' => 'sch', 'ъ' => '', 'ы' => 'y', 'ь' => '',
        'э' => 'e', 'ю' => 'yu', 'я' => 'ya'
    ];
    return strtolower(strtr($str, array_flip($map)));
}

function isValidImageFile($file) {
    global $ALLOWED_TYPES, $ALLOWED_EXTENSIONS;
    
    // Проверяем MIME тип
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    
    if (!in_array($mimeType, $ALLOWED_TYPES)) {
        return false;
    }
    
    // Проверяем расширение
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    return in_array($ext, $ALLOWED_EXTENSIONS);
}

function uploadFile($file, $targetDir) {
    global $MAX_FILE_SIZE;
    
    // Проверка размера
    if ($file['size'] > $MAX_FILE_SIZE) {
        return ['success' => false, 'error' => 'Файл слишком большой (макс. 10MB)'];
    }
    
    // Валидация типа
    if (!isValidImageFile($file)) {
        return ['success' => false, 'error' => 'Недопустимый формат файла'];
    }
    
    // Генерируем имя файла
    $filename = generateFileName($file);
    $targetPath = $targetDir . $filename;
    
    // Загружаем файл
    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        return ['success' => false, 'error' => 'Ошибка загрузки файла'];
    }
    
    @chmod($targetPath, 0644);
    
    // Вычисляем путь для хранения в JSON (относительно public_html)
    $relativePath = '/' . trim(str_replace(__DIR__ . '/../', '', $targetPath), '/');
    
    return ['success' => true, 'filename' => $filename, 'path' => $relativePath];
}

function readJSON($file) {
    if (!file_exists($file)) {
        return [];
    }
    $content = @file_get_contents($file);
    return $content ? json_decode($content, true) : [];
}

function writeJSON($file, $data) {
    $json = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    return @file_put_contents($file, $json);
}

function generateID($type) {
    $date = date('dmy');
    $count = 1;
    
    if ($type === 'catalog') {
        $items = readJSON($GLOBALS['CATALOG_FILE']);
        $prefixed = array_filter($items, fn($i) => strpos($i['id'], 'cat-' . $date) === 0);
        $count = count($prefixed) + 1;
        return 'cat-' . $date . '-' . str_pad($count, 3, '0', STR_PAD_LEFT);
    } else {
        $items = readJSON($GLOBALS['WORKS_FILE']);
        $prefixed = array_filter($items, fn($i) => strpos($i['id'], 'w-' . $date) === 0);
        $count = count($prefixed) + 1;
        return 'w-' . $date . '-' . str_pad($count, 3, '0', STR_PAD_LEFT);
    }
}

function log_action($action, $data) {
    global $LOG_FILE;
    
    $timestamp = date('Y-m-d H:i:s');
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $log_entry = "$timestamp | IP: $ip | Action: $action | Data: " . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n";
    
    @file_put_contents($LOG_FILE, $log_entry, FILE_APPEND);
}

function sanitize($input) {
    return htmlspecialchars(strip_tags($input), ENT_QUOTES, 'UTF-8');
}

// Полифилл для PHP < 8.0
if (!function_exists('array_find')) {
    function array_find(array $array, callable $callback) {
        foreach ($array as $value) {
            if ($callback($value)) {
                return $value;
            }
        }
        return null;
    }
}

// ========== ОБРАБОТКА ЗАПРОСОВ ==========
$request = json_decode(file_get_contents('php://input'), true) ?? [];
$action = sanitize($request['action'] ?? $_POST['action'] ?? '');

// Проверка метода
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die(json_encode(['success' => false, 'error' => 'Method not allowed']));
}

// ========== ДЕЙСТВИЯ ==========

// 1. ВХОД
if ($action === 'login') {
    $password = $request['password'] ?? '';
    
    if ($password === $ADMIN_PASSWORD) {
        $_SESSION['admin_authenticated'] = true;
        log_action('LOGIN', ['status' => 'success']);
        echo json_encode(['success' => true, 'token' => session_id()]);
    } else {
        log_action('LOGIN', ['status' => 'failed']);
        echo json_encode(['success' => false, 'error' => 'Invalid password']);
    }
    exit;
}

// Все остальные действия требуют аутентификации
if (!isAuthenticated()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// 2. ДОБАВИТЬ МАТЕРИАЛ
if ($action === 'add_catalog') {
    $title = sanitize($_POST['title'] ?? '');
    $material = sanitize($_POST['material'] ?? '');
    $type = sanitize($_POST['type'] ?? '');
    $fabricator = sanitize($_POST['fabricator'] ?? '');
    $size = sanitize($_POST['size'] ?? '');
    
    if (!$title || !$material || !$type) {
        echo json_encode(['success' => false, 'error' => 'Missing required fields']);
        exit;
    }
    
    if (empty($_FILES['image'])) {
        echo json_encode(['success' => false, 'error' => 'No image uploaded']);
        exit;
    }
    
    $upload = uploadFile($_FILES['image'], $CATALOG_DIR);
    if (!$upload['success']) {
        echo json_encode($upload);
        exit;
    }
    
    // Генерируем ID и добавляем в каталог
    $id = generateID('catalog');
    $items = readJSON($CATALOG_FILE);
    
    $newItem = [
        'id' => $id,
        'title' => $title,
        'material' => $material,
        'type' => $type,
        'fabricator' => $fabricator,
        'size' => $size,
        'image' => $upload['path'],
        'created_at' => date('Y-m-d H:i:s')
    ];
    
    $items[] = $newItem;
    writeJSON($CATALOG_FILE, $items);
    
    log_action('ADD_CATALOG', ['id' => $id, 'title' => $title]);
    echo json_encode(['success' => true, 'id' => $id, 'message' => 'Материал добавлен']);
    exit;
}

// 3. УДАЛИТЬ МАТЕРИАЛ
if ($action === 'delete_catalog') {
    $id = sanitize($request['id'] ?? '');
    
    if (!$id) {
        echo json_encode(['success' => false, 'error' => 'No ID provided']);
        exit;
    }
    
    $items = readJSON($CATALOG_FILE);
    $item = array_find($items, fn($i) => $i['id'] === $id);
    
    if (!$item) {
        echo json_encode(['success' => false, 'error' => 'Item not found']);
        exit;
    }
    
    // Удаляем изображение
    if (!empty($item['image'])) {
        $imagePath = __DIR__ . '/../' . ltrim($item['image'], '/');
        @unlink($imagePath);
    }
    
    // Удаляем из JSON
    $items = array_filter($items, fn($i) => $i['id'] !== $id);
    writeJSON($CATALOG_FILE, array_values($items));
    
    log_action('DELETE_CATALOG', ['id' => $id]);
    echo json_encode(['success' => true, 'message' => 'Материал удален']);
    exit;
}

// 4. ДОБАВИТЬ РАБОТУ
if ($action === 'add_work') {
    $title = sanitize($_POST['title'] ?? '');
    $material = sanitize($_POST['material'] ?? '');
    $description = sanitize($_POST['description'] ?? '');
    $location = sanitize($_POST['location'] ?? '');
    
    if (!$title || !$material) {
        echo json_encode(['success' => false, 'error' => 'Missing required fields']);
        exit;
    }
    
    if (empty($_FILES['images']['name'][0])) {
        echo json_encode(['success' => false, 'error' => 'No images uploaded']);
        exit;
    }
    
    // Генерируем ID и создаем папку
    $id = generateID('work');
    $workDir = $WORKS_DIR . $id . '/';
    @mkdir($workDir, 0755, true);
    
    // Загружаем изображения
    $images = [];
    $fileCount = count($_FILES['images']['name']);
    
    for ($i = 0; $i < $fileCount; $i++) {
        $file = [
            'name' => $_FILES['images']['name'][$i],
            'tmp_name' => $_FILES['images']['tmp_name'][$i],
            'size' => $_FILES['images']['size'][$i],
            'error' => $_FILES['images']['error'][$i]
        ];
        
        if ($file['error'] !== UPLOAD_ERR_OK) {
            continue;
        }
        
        $upload = uploadFile($file, $workDir);
        if ($upload['success']) {
            $images[] = $upload['path'];
        }
    }
    
    if (empty($images)) {
        @rmdir($workDir);
        echo json_encode(['success' => false, 'error' => 'Failed to upload images']);
        exit;
    }
    
    // Добавляем в JSON
    $items = readJSON($WORKS_FILE);
    $newItem = [
        'id' => $id,
        'title' => $title,
        'material' => $material,
        'description' => $description,
        'location' => $location,
        'images' => $images,
        'image' => $images[0],
        'created_at' => date('Y-m-d H:i:s')
    ];
    
    $items[] = $newItem;
    writeJSON($WORKS_FILE, $items);
    
    log_action('ADD_WORK', ['id' => $id, 'title' => $title, 'images' => count($images)]);
    echo json_encode(['success' => true, 'id' => $id, 'message' => 'Проект добавлен']);
    exit;
}

// 5. УДАЛИТЬ РАБОТУ
if ($action === 'delete_work') {
    $id = sanitize($request['id'] ?? '');
    
    if (!$id) {
        echo json_encode(['success' => false, 'error' => 'No ID provided']);
        exit;
    }
    
    $items = readJSON($WORKS_FILE);
    $item = array_find($items, fn($i) => $i['id'] === $id);
    
    if (!$item) {
        echo json_encode(['success' => false, 'error' => 'Item not found']);
        exit;
    }
    
    // Удаляем папку с изображениями
    $workDir = $WORKS_DIR . $id . '/';
    if (is_dir($workDir)) {
        $files = array_diff(scandir($workDir), ['.', '..']);
        foreach ($files as $file) {
            @unlink($workDir . $file);
        }
        @rmdir($workDir);
    }
    
    // Удаляем из JSON
    $items = array_filter($items, fn($i) => $i['id'] !== $id);
    writeJSON($WORKS_FILE, array_values($items));
    
    log_action('DELETE_WORK', ['id' => $id]);
    echo json_encode(['success' => true, 'message' => 'Проект удален']);
    exit;
}

// Неизвестное действие
http_response_code(400);
echo json_encode(['success' => false, 'error' => 'Unknown action']);
?>
