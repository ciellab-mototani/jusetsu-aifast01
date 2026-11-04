<?php
declare(strict_types=1);
require_once __DIR__ . '/phpmailer/Exception.php';
require_once __DIR__ . '/phpmailer/SMTP.php';
require_once __DIR__ . '/phpmailer/PHPMailer.php';

/** No bypass/test-mode setting is accepted in production configuration. */
function aifast_validate_services(array $config): void {
    foreach (['turnstile_site_key', 'turnstile_secret_key'] as $key) {
        $value = $config[$key] ?? '';
        if (!is_string($value) || !preg_match('/\A[0-9A-Za-z_-]{20,200}\z/', $value) || preg_match('/\A[123]x0{10}/', $value)) {
            throw new RuntimeException('Turnstile keys must be configured; test keys forbidden');
        }
    }
    $smtp = $config['smtp'] ?? [];
    if (!is_array($smtp) || !preg_match('/\A[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\z/i', $smtp['host'] ?? '') || !str_contains($smtp['host'], '.')) throw new RuntimeException('SMTP host required');
    if (!in_array([$smtp['encryption'] ?? '', $smtp['port'] ?? 0], [['smtps',465], ['starttls',587]], true)) throw new RuntimeException('Encrypted SMTP required');
    foreach (['username','password'] as $key) if (!isset($smtp[$key]) || !is_string($smtp[$key]) || $smtp[$key] === '' || preg_match('/[\r\n\x00]/', $smtp[$key])) throw new RuntimeException('SMTP credentials required');
}

function aifast_siteverify_request(string $secret, string $token): ?array {
    $ch = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query(['secret'=>$secret, 'response'=>$token]),
        CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_FOLLOWLOCATION => false, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ]);
    $raw = curl_exec($ch); $status = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    if (!is_string($raw) || $status !== 200 || strlen($raw) > 16384) return null;
    $result = json_decode($raw, true);
    return is_array($result) ? $result : null;
}

function aifast_verify_turnstile(string $secret, string $token, string $hostname): string {
    $result = aifast_siteverify_request($secret, $token);
    if ($result === null) return 'unavailable';
    if (($result['success'] ?? false) !== true || ($result['hostname'] ?? '') !== $hostname || ($result['action'] ?? '') !== 'contact') return 'rejected';
    $timestamp = isset($result['challenge_ts']) && is_string($result['challenge_ts']) ? strtotime($result['challenge_ts']) : false;
    if ($timestamp === false || time() - $timestamp > 300 || $timestamp - time() > 60) return 'rejected';
    return 'verified';
}

class AifastSMTP extends \PHPMailer\PHPMailer\SMTP {
    public bool $dataAttempted = false;
    public bool $dataAccepted = false;
    public bool $dataRejected = false;
    public function data($msg_data) {
        $this->dataAttempted = true;
        $accepted = parent::data($msg_data);
        $this->dataAccepted = $accepted;
        $code = (int)($this->getError()['smtp_code'] ?? 0);
        $this->dataRejected = !$accepted && $code >= 400 && $code < 600;
        return $accepted;
    }
}

function aifast_make_mailer(array $config, string $replyTo, string $subject, string $body, string $request): \PHPMailer\PHPMailer\PHPMailer {
    $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
    $mail->isSMTP(); $mail->SMTPAuth = true; $mail->SMTPDebug = 0;
    $mail->Host = $config['smtp']['host']; $mail->Port = $config['smtp']['port'];
    $mail->SMTPSecure = $config['smtp']['encryption'] === 'smtps' ? 'ssl' : 'tls';
    $mail->Username = $config['smtp']['username']; $mail->Password = $config['smtp']['password'];
    $mail->Timeout = 10;
    $mail->SMTPOptions = ['ssl'=>['verify_peer'=>true,'verify_peer_name'=>true,'allow_self_signed'=>false]];
    $mail->CharSet = 'UTF-8'; $mail->Encoding = 'base64'; $mail->isHTML(false);
    $mail->setFrom($config['from'], '重説AIファスト'); $mail->addAddress($config['to']); $mail->addReplyTo($replyTo);
    $mail->Subject = $subject; $mail->Body = $body;
    $mail->MessageID = '<' . $request . '@' . parse_url($config['origin'], PHP_URL_HOST) . '>';
    return $mail;
}

/** Ambiguous SMTP disconnects keep their reservation to avoid duplicate deliveries. */
function aifast_send_smtp(array $config, string $replyTo, string $subject, string $body, string $request): string {
    $smtp = new AifastSMTP(); $smtp->Timelimit = 20; $smtp->Timeout = 10;
    try {
        $mail = aifast_make_mailer($config, $replyTo, $subject, $body, $request);
        $mail->setSMTPInstance($smtp);
        if ($mail->send()) return 'sent';
    } catch (Throwable $e) { /* Do not log credentials, addresses, message body or SMTP responses. */ }
    if ($smtp->dataAccepted) return 'sent';
    return !$smtp->dataAttempted || $smtp->dataRejected ? 'failed' : 'uncertain';
}
