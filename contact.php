<?php
declare(strict_types=1);
// PHP 8.2+ / PDO SQLite / cURL / OpenSSL / mbstring. Rate-limit data stays outside public_html.
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');

function respond(int $status, string $message, array $extra = []): never {
    http_response_code($status);
    echo json_encode(['ok' => $status === 200, 'message' => $message] + $extra, JSON_UNESCAPED_UNICODE);
    exit;
}
function invalid(): never { respond(422, '入力内容を確認してください。必須項目・文字数・メールアドレスをご確認ください。'); }

try {
    // Always outside the host's public root, including installations in /ai-fist/.
    $documentRoot = isset($_SERVER['DOCUMENT_ROOT']) ? realpath($_SERVER['DOCUMENT_ROOT']) : false;
    if (!$documentRoot || (__DIR__ !== $documentRoot && !str_starts_with(__DIR__, $documentRoot . '/'))) {
        throw new RuntimeException('Invalid document root');
    }
    // Runtime data is created automatically outside public_html; no manual upload needed.
    $private = dirname($documentRoot) . '/aifast-private';
    $configPath = __DIR__ . '/server/contact-config.php';
    if (!is_file($configPath)) respond(503, '現在フォームをご利用いただけません。0120-138-870までお電話ください。');
    define('AIFAST_CONTACT', true);
    $config = require $configPath;
    if (!is_array($config) || ($config['enabled'] ?? false) !== true) respond(503, '現在フォームをご利用いただけません。0120-138-870までお電話ください。');
    require_once __DIR__ . '/server/contact-services.php';
    aifast_validate_services($config);
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (isset($config['origins']) && !isset($config['origins'][$host])) respond(403, '送信元を確認できませんでした。正規サイトから再度お試しください。');
    $origin = $config['origins'][$host] ?? $config['origin'] ?? '';
    $config['origin'] = $origin;
    $parts = parse_url($origin);
    if (!$parts || !isset($parts['host'], $parts['scheme']) || (isset($parts['path']) || isset($parts['query']) || isset($parts['fragment']) || isset($parts['user']))) throw new RuntimeException('Invalid origin config');
    $authority = $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '');
    if (($_SERVER['HTTP_HOST'] ?? '') !== $authority) respond(403, '送信元を確認できませんでした。正規サイトから再度お試しください。');
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if (!in_array($method, ['GET', 'POST'], true)) { header('Allow: GET, POST'); respond(405, 'この操作はご利用いただけません。'); }
    // Custom header + strict Origin + session token; no CORS permission is emitted.
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'aifast-contact') respond(403, 'ページを再読み込みしてお試しください。');
    if (isset($_SERVER['HTTP_SEC_FETCH_SITE']) && $_SERVER['HTTP_SEC_FETCH_SITE'] !== 'same-origin') respond(403, '送信元を確認できませんでした。');
    if ($method === 'POST' && ($_SERVER['HTTP_ORIGIN'] ?? '') !== $origin) respond(403, '送信元を確認できませんでした。');
    if (isset($_SERVER['HTTP_ORIGIN']) && $_SERVER['HTTP_ORIGIN'] !== $origin) respond(403, '送信元を確認できませんでした。');
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 24000) respond(413, '入力内容が長すぎます。');
    if ($method === 'POST' && strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') respond(415, 'ページを再読み込みしてお試しください。');

    // One private SQLite database; fixed number of rate buckets per IP and time window.
    umask(0077);
    if (!is_dir($private) && !mkdir($private, 0700, true) && !is_dir($private)) throw new RuntimeException('Cannot create private runtime directory');
    $db = new PDO('sqlite:' . $private . '/contact.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $db->exec('PRAGMA busy_timeout=5000');
    $db->exec('CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)');
    $db->exec('CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL)');
    $now = time();
    $db->prepare('DELETE FROM limits WHERE expires < ?')->execute([$now]);
    $db->prepare('DELETE FROM requests WHERE created < ?')->execute([$now - 86400]);
    $secret = $config['secret'] ?? '';
    if (!is_string($secret) || strlen($secret) < 64) throw new RuntimeException('Secret must be configured');
    $ip = hash_hmac('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown', $secret);
    $consume = static function (string $key, int $maximum, int $seconds) use ($db, $now): void {
        $key .= ':' . intdiv($now, $seconds);
        $db->beginTransaction();
        try {
            // Compatible with SQLite versions before 3.24; keep both operations atomic.
            $db->prepare('INSERT OR IGNORE INTO limits(key,count,expires) VALUES (?,0,?)')->execute([$key, $now + $seconds]);
            $db->prepare('UPDATE limits SET count=count+1 WHERE key=?')->execute([$key]);
            $stmt = $db->prepare('SELECT count FROM limits WHERE key=?'); $stmt->execute([$key]);
            $count = (int)$stmt->fetchColumn();
            $db->commit();
        } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
        if ($count > $maximum) { header('Retry-After: ' . $seconds); respond(429, '送信回数が多いため、しばらく時間をおいてからお試しください。'); }
    };
    $consume('access:' . $ip, 120, 900);
    session_name('aifast_contact');
    session_start(['use_strict_mode' => 1, 'use_only_cookies' => 1, 'cookie_httponly' => 1, 'cookie_secure' => $parts['scheme'] === 'https', 'cookie_samesite' => 'Strict', 'cookie_path' => '/']);
    if ($method === 'GET') {
        if (!isset($_SESSION['csrf'], $_SESSION['issued']) || $now - $_SESSION['issued'] > 3600) {
            $_SESSION['csrf'] = bin2hex(random_bytes(32)); $_SESSION['issued'] = $now;
        }
        respond(200, '', ['token' => $_SESSION['csrf'], 'siteKey' => $config['turnstile_site_key']]);
    }
    $raw = file_get_contents('php://input', false, null, 0, 24001);
    if ($raw === false || strlen($raw) > 24000) respond(413, '入力内容が長すぎます。');
    try { $data = json_decode($raw, true, 32, JSON_THROW_ON_ERROR); } catch (JsonException $e) { invalid(); }
    if (!is_array($data) || array_is_list($data)) invalid();
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!isset($_SESSION['csrf'], $_SESSION['issued']) || !hash_equals($_SESSION['csrf'], $token) || $now - $_SESSION['issued'] > 3600) respond(403, '有効期限が切れました。もう一度送信ボタンを押してください。');
    session_write_close();
    $consume('attempt:' . $ip, 10, 900);
    $allowed = ['kind','company','family','given','email','tel','form','type','dept','role','note','agree','website','request_id','turnstile_token'];
    if (array_diff(array_keys($data), $allowed)) invalid();
    $text = static function(string $name, int $max, bool $required = false, bool $multiline = false) use ($data): string {
        $s = $data[$name] ?? '';
        if (!is_string($s) || !preg_match('//u', $s)) invalid();
        if (preg_match($multiline ? '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/' : '/[\x00-\x1F\x7F]/', $s)) invalid();
        $s = trim($s);
        if (($required && $s === '') || preg_match_all('/./us', $s) > $max) invalid();
        return $s;
    };
    $kind = $text('kind', 8, true);
    $kinds = ['demo' => '無料トライアルの予約', 'doc' => '資料請求（料金表つき）', 'ask' => 'お問い合わせ'];
    if (!isset($kinds[$kind]) || ($data['agree'] ?? false) !== true || $text('website', 200) !== '') invalid();
    $fields = [];
    foreach (['company'=>200,'family'=>80,'given'=>80,'email'=>254,'tel'=>40,'dept'=>120,'role'=>120,'note'=>4000] as $name=>$max) {
        $fields[$name] = $text($name, $max, in_array($name, ['company','family','given','email','tel'], true), $name === 'note');
    }
    if (!filter_var($fields['email'], FILTER_VALIDATE_EMAIL) || !preg_match('/\A[0-9+() .\-]{6,40}\z/', $fields['tel'])) invalid();
    foreach (['form'=>['全宅連（ハトサポ）','全日（ラビーネット）','FRK','自社の独自書式','わからない'], 'type'=>['区分所有マンション','土地・戸建','一棟物','その他']] as $name=>$options) {
        $values = $data[$name] ?? [];
        if (!is_array($values) || !array_is_list($values) || count($values) > count($options)) invalid();
        foreach ($values as $value) if (!is_string($value) || !in_array($value, $options, true)) invalid();
        $fields[$name] = implode('、', array_unique($values));
    }
    $request = $text('request_id', 64, true);
    if (!preg_match('/\A[a-f0-9]{32}\z/', $request)) invalid();
    $requestKey = hash_hmac('sha256', $request, $secret);
    $payloadHash = hash_hmac('sha256', json_encode([$kind, $fields]), $secret);
    $stmt = $db->prepare('SELECT payload,status FROM requests WHERE id=?'); $stmt->execute([$requestKey]);
    if ($existing = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!hash_equals($existing['payload'], $payloadHash)) respond(409, '前回と内容が異なります。フォームを閉じて開き直してください。');
        if ($existing['status'] === 'sent') respond(200, 'お問い合わせを受け付けました。担当者からご連絡いたします。');
        respond(409, '送信処理を確認中です。時間をおいて同じ内容で再度お試しください。解決しない場合は0120-138-870までお電話ください。');
    }
    $turnstileToken = $text('turnstile_token', 2048, true);
    $verification = aifast_verify_turnstile($config['turnstile_secret_key'], $turnstileToken, $parts['host']);
    if ($verification === 'unavailable') respond(503, '認証サービスに接続できません。時間をおいて再度お試しください。');
    if ($verification !== 'verified') respond(422, '認証を確認できませんでした。もう一度認証して送信してください。');
    $consume('send:' . $ip, 5, 900);
    $consume('email:' . hash_hmac('sha256', strtolower($fields['email']), $secret), 5, 3600);
    $consume('global', 100, 3600);
    $to = $config['to'] ?? ''; $from = $config['from'] ?? '';
    foreach ([$to, $from] as $address) if (!is_string($address) || preg_match('/[\r\n]/', $address) || !filter_var($address, FILTER_VALIDATE_EMAIL)) throw new RuntimeException('Invalid mail config');
    $stmt = $db->prepare("INSERT OR IGNORE INTO requests(id,payload,status,created) VALUES (?,?,'pending',?)");
    $stmt->execute([$requestKey, $payloadHash, $now]);
    if ($stmt->rowCount() !== 1) respond(409, '送信処理中です。時間をおいて再度お試しください。');
    require_once __DIR__ . '/server/mail-templates.php';
    $adminMessage = aifast_admin_message($fields, $kinds[$kind], $request, $now);
    $subject = $adminMessage['subject']; $body = $adminMessage['body'];
    $delivery = aifast_send_smtp($config, $fields['email'], $subject, $body, $request);
    if ($delivery === 'failed') {
        $db->prepare('DELETE FROM requests WHERE id=?')->execute([$requestKey]);
        error_log('aifast contact: SMTP delivery failed');
        respond(503, '送信できませんでした。時間をおいて再度お試しいただくか、0120-138-870までお電話ください。');
    }
    if ($delivery !== 'sent') {
        error_log('aifast contact: SMTP delivery uncertain');
        respond(503, '送信結果を確認中です。重複送信を防ぐため、そのまま時間をおいて再度お試しください。解決しない場合は0120-138-870までお電話ください。');
    }
    $db->prepare("UPDATE requests SET status='sent' WHERE id=?")->execute([$requestKey]);
    // Commit acceptance before attempting the receipt. Retries never resend either mail.
    // Receipt failure must not turn an already delivered admin notification into a failed inquiry.
    $receipt = aifast_receipt_message($kinds[$kind], $fields);
    $receiptConfig = $config;
    $receiptConfig['to'] = $fields['email'];
    $receiptDelivery = aifast_send_smtp($receiptConfig, $config['to'], $receipt['subject'], $receipt['body'], $request . '-receipt');
    if ($receiptDelivery !== 'sent') error_log('aifast contact: receipt delivery ' . $receiptDelivery);

    respond(200, 'お問い合わせを受け付けました。担当者からご連絡いたします。');
} catch (Throwable $e) {
    // Do not log form fields, addresses, tokens, request bodies or exception messages.
    $diagnostic = get_class($e);
    if ($e instanceof PDOException) {
        // Numeric driver codes identify storage failures without logging SQL, paths or inputs.
        $driverCode = $e->errorInfo[1] ?? null;
        $diagnostic .= '; sqlite_driver=' . (in_array('sqlite', PDO::getAvailableDrivers(), true) ? 'yes' : 'no');
        $diagnostic .= '; sqlite_code=' . (is_numeric($driverCode) ? (int)$driverCode : 'unknown');
    }
    error_log('aifast contact: internal failure (' . $diagnostic . ')');
    respond(503, '現在送信できません。時間をおいて再度お試しいただくか、0120-138-870までお電話ください。');
}
