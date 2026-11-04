<?php
// Copy to server/contact-config.php together with server/.htaccess.
if (!defined('AIFAST_CONTACT')) { http_response_code(404); exit; }
// Never commit the filled-in file. Permissions: directory 700, file 600.
return [
    'enabled' => false, // Set true only after all values below are configured.
    'origins' => ['ai-fast.jp' => 'https://ai-fast.jp', 'jgtest.xsrv.jp' => 'https://jgtest.xsrv.jp'],
    'to' => 'info@ai-fast.jp',
    'from' => 'info@ai-fast.jp',
    'secret' => '', // php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'
    'turnstile_site_key' => '0x4AAAAAAFzDHtP2H4_6Y4QX', // Public site key for a Managed widget, allowed hostname: ai-fast.jp.
    'turnstile_secret_key' => '', // Secret key; official dummy test keys are rejected.
    'smtp' => [
        'host' => 'sv16592.xserver.jp', // Actual server name from Xserver, e.g. sv12345.xserver.jp.
        'port' => 465,
        'encryption' => 'smtps', // 'smtps'/465 or 'starttls'/587 only.
        'username' => 'info@ai-fast.jp',
        'password' => '', // Enter only in the private server-side configuration file.
    ],
];
