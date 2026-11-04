<?php
declare(strict_types=1);
if (!defined('AIFAST_CONTACT')) { http_response_code(404); exit; }

// 管理者通知の件名・本文。
function aifast_admin_message(array $fields, string $kind, string $request, int $now): array {
    $body = "重説AIファストのWebフォームから\nお問い合わせがありました。\n\n";
    $body .= "────────────────────\n■ お問い合わせ内容\n────────────────────\n\nお問い合わせ種別\n$kind\n\n";
    foreach (['company'=>'会社名','family'=>'姓','given'=>'名','email'=>'メールアドレス','tel'=>'電話番号','form'=>'お使いの書式','type'=>'主な物件種別','dept'=>'部署名','role'=>'役職','note'=>'相談事項'] as $name=>$label) {
        $value = $fields[$name] === '' ? '（未入力）' : $fields[$name];
        $body .= "$label\n$value\n\n";
    }
    $body .= "────────────────────\n■ 受付情報\n────────────────────\n\nプライバシーポリシーへの同意\nあり\n\n受付日時\n" . gmdate('Y-m-d H:i:s', $now + 9 * 3600) . " JST\n";
    return ['subject'=>'【重説AIファスト】' . $kind, 'body'=>$body];
}

// ユーザー向け自動返信。検証済みの入力内容をプレーンテキストで確認できます。
function aifast_receipt_message(string $kind, array $fields): array {
    $details = "";
    foreach (['company'=>'会社名','family'=>'姓','given'=>'名','email'=>'メールアドレス','tel'=>'電話番号','form'=>'お使いの書式','type'=>'主な物件種別','dept'=>'部署名','role'=>'役職','note'=>'相談事項'] as $name=>$label) {
        $value = $fields[$name] === '' ? '（未入力）' : $fields[$name];
        $details .= "$label\n$value\n\n";
    }
    $body = <<<TEXT
重説AIファストへお問い合わせいただき、
ありがとうございます。

以下の内容で受け付けました。
担当者より改めてご連絡いたします。

────────────────────
■ 受付内容
────────────────────

お問い合わせ種別
$kind

$details

────────────────────
■ お問い合わせ先
────────────────────

重説AIファスト
販売代理店：株式会社スカイネット

メール：info@ai-fast.jp
電話：0120-138-870

────────────────────
このメールは自動送信しています。
お心当たりがない場合は、
破棄していただいて構いません。
TEXT;
    return [
        'subject'=>'【重説AIファスト】お問い合わせを受け付けました',
        'body'=>$body . "\n",
    ];
}
