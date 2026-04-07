# リール文字起こし (Instagram Reel Transcriber)

InstagramリールのURLを貼り付けるだけで、音声を日本語テキストに自動で文字起こしするWebアプリケーションです。Groq APIのWhisper large-v3モデルを使用して高速かつ高精度な文字起こしを実現します。

## デプロイ先

- フロントエンド (Vercel): [https://frontend-liard-six-13.vercel.app](https://frontend-liard-six-13.vercel.app)
- バックエンド (Render): [https://instagram-reel-transcriber-ezcp.onrender.com](https://instagram-reel-transcriber-ezcp.onrender.com)

## 主な機能

- InstagramリールのURLを入力するだけで文字起こし
- タイムスタンプ付きセグメント表示
- ワンクリックで結果をクリップボードにコピー
- パスワードによる簡易認証
- レスポンシブ対応のシンプルなUI

## 技術スタック

**バックエンド**
- Python 3.12 / FastAPI
- Groq API (Whisper large-v3)
- yt-dlp (音声ダウンロード)
- ffmpeg (音声変換)

**フロントエンド**
- HTML / CSS / Vanilla JavaScript

**デプロイ**
- Docker / Render

## セットアップ

### 必要なもの

- Python 3.12+
- ffmpeg
- Groq APIキー ([https://console.groq.com](https://console.groq.com) で取得)

### ローカル起動

```bash
# 依存関係のインストール
cd backend
pip install -r requirements.txt

# 環境変数の設定
export GROQ_API_KEY="your-groq-api-key"
export APP_PASSWORD="your-password"

# サーバー起動
uvicorn main:app --host 0.0.0.0 --port 8000
```

ブラウザで `http://localhost:8000` を開いてください。

### Dockerで起動

```bash
cd backend
docker build -t reel-transcriber .
docker run -p 10000:10000 \
  -e GROQ_API_KEY="your-groq-api-key" \
  -e APP_PASSWORD="your-password" \
  reel-transcriber
```

## 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `GROQ_API_KEY` | Groq APIキー（必須） | - |
| `APP_PASSWORD` | ログインパスワード | `changeme` |

## API エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/login` | パスワード認証してトークンを発行 |
| POST | `/verify` | トークンの有効性確認 |
| POST | `/transcribe` | InstagramリールURLから文字起こし実行 |
| GET | `/health` | ヘルスチェック |

## 使い方

1. アプリにアクセスしてパスワードでログイン
2. InstagramリールのURLを入力欄に貼り付け
3. 「文字起こし」ボタンをクリック
4. 結果が表示されたら必要に応じてコピー

## ライセンス

MIT
