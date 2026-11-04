# フォルダの中身をそのままFTP配置する

1. FTPでjgtest.xsrv.jp/public_html/ai-fist/を開く。なければai-fistを作成する。既存ファイルがある場合は先にバックアップする。
2. 手元のjusetsu-aifast01の「中身」のうち、_アップロード不要フォルダ以外をアップロードする。jusetsu-aifast01フォルダ自体を入れない。.git・.gitignoreも不要。
3. 隠しファイル.htaccessとserver/.htaccessも必ず転送する。public_html直下の既存.htaccessは上書きしない。
4. Cloudflare Turnstileの許可ホストへjgtest.xsrv.jpを追加する。https://や/ai-fist/は入れない。本番のai-fast.jpは残す。
5. https://jgtest.xsrv.jp/ai-fist/を開き、表示・認証・実メール受信を確認する。

配置後はpublic_html/ai-fist/index.html、public_html/ai-fist/server/contact-config.phpなどになります。URLにpublic_htmlは入りません。

入力済み設定はserver/contact-config.phpに同梱済み、enabled=trueです。別フォルダへの設定アップロードやZIP生成は不要です。今後の変更もこのファイルを編集して転送します。以前の/tmp内のconfig.phpは使用しません。

設定はGit管理から除外し、.htaccessとPHPガードでWeb直接アクセスを拒否します。ブラウザでserver/contact-config.phpを開いたとき403または404となることを確認してください。秘密情報入りのためフォルダ全体を他者へ共有しないでください。

送信回数制限などの管理データはPHPがpublic_htmlの外のaifast-privateに自動作成します。手動配置不要です。作成権限がない場合は503となるためサーバー権限を確認します。

PHP 8.2以上のサポート対象バージョンとPDO SQLite・mbstring・cURL・OpenSSLが必要です。WAF有効状態で送信を確認してください。

本番・テストで同じファイルを使用します（index,follow）。テスト環境はアップロード前にエックスサーバー側でフォルダ全体へBasic認証を設定してください。GA4/GTMはテストホストでは動きません。本番は本番ドメインのpublic_html直下へ同じファイルを配置でき、切り替え作業は不要です。サブフォルダ内のrobots.txtはホスト全体を制御しません。

FTP配置・実SMTP認証・実メール受信は未確認です。
