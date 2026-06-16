# ニュートラル・ノート（スマホアプリ版 / PWA）

助言をしない記録帳。書いた文章を「事実 / 解釈 / べき」に映す“鏡”と、不安度の水位グラフ。
**完全オフライン・APIキー不要・データは端末内（localStorage）にだけ保存**。

## ファイル構成
- `index.html` … アプリ本体（1ファイル完結・バニラJS）
- `manifest.webmanifest` … PWA設定（ホーム画面アプリ化）
- `sw.js` … Service Worker（オフライン動作）
- `icon-192.png` / `icon-512.png` / `icon-maskable-512.png` … アイコン

## 元ファイルからの変更点
- `window.storage`（Claudeアーティファクト専用）→ **localStorage** に変更
- AnthropicのAI鏡 → **ローカルの簡易仕分け**（事実/解釈/べき）に置換（キー不要・オフライン可）
- **音声入力＝スマホ標準のキーボード音声入力（🎤マイクキー）を利用**（確実・オフライン可・API不要）
  - ※ アプリ内の独自🎤ボタン（Web Speech API）はAndroidで不安定なため廃止
- PWA化（マニフェスト＋Service Worker＋アイコン）

## アプリを更新したとき（重要）
コードを直して `git push` したら、**`sw.js` の `CACHE` の版番号を上げる**こと（例 `nn-v2` → `nn-v3`）。
これを忘れると、スマホ側が古い画面をキャッシュし続けて更新が反映されません。
（HTML本体はネット優先で取得する設定なので、通常は開き直せば最新になります。）

---

## Androidスマホにインストールする（おすすめ：GitHub Pages）

PWAの「ホーム画面に追加」とオフライン動作・音声入力には **HTTPS** が必須です。
無料でHTTPS配信できる GitHub Pages が一番ラクで、PCを起動しておく必要もありません。

### 手順
1. GitHubで空のリポジトリを作る（例：`neutralnote`、Publicでよい）。
2. PCでこのフォルダを上げる（PowerShellでこのフォルダにて）：
   ```powershell
   cd C:\Users\frogb\cloude-app\neutralnote
   git init
   git add index.html manifest.webmanifest sw.js icon-*.png
   git commit -m "neutralnote PWA"
   git branch -M main
   git remote add origin https://github.com/<あなたのID>/neutralnote.git
   git push -u origin main
   ```
3. GitHubのリポジトリ → **Settings → Pages** → Branch を `main` / フォルダ `/ (root)` にして Save。
4. 1〜2分で `https://<あなたのID>.github.io/neutralnote/` が公開される。
5. **スマホのChrome**でそのURLを開く → 右上「︙」メニュー → **「アプリをインストール」**（または「ホーム画面に追加」）。
6. ホーム画面のアイコンから起動。以後はオフラインでも動作。

> 🎤マイクは初回に許可を求められます。許可すると日本語の音声入力が使えます。

---

## PCですぐ試す（ローカル確認用）
```powershell
cd C:\Users\frogb\cloude-app\neutralnote
python -m http.server 8765
```
ブラウザで `http://localhost:8765` を開く（localhostはHTTPS扱いなので音声入力もSWも動く）。

## 同じWiFiのスマホから一時的に試す（簡易・非推奨）
PCで上のサーバーを起動し、スマホで `http://<PCのIPアドレス>:8765` を開く。
※ LANの **http はHTTPSでないため、音声入力とオフライン化（インストール）は使えません**。
　あくまで表示確認用。常用するなら上のGitHub Pagesを使ってください。

## 注意
- データは開いた端末のブラウザ内（localStorage）にのみ保存され、サーバーには一切送られません。
- 別の端末・別ブラウザとは同期しません（各端末ローカル）。
- iPhoneのSafariは音声認識に制約があるため、その場合はキーボードのマイクで入力してください。
