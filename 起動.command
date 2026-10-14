#!/bin/bash
# CYBER CORE - macOS 起動スクリプト（ダブルクリックで起動できます）
cd "$(dirname "$0")" || exit 1

PORT=3000
HOST=127.0.0.1

echo "=============================================="
echo "  CYBER CORE - GOTHIC CYBERPUNK 3D FPS"
echo "=============================================="

# --- Node.js / npm を探す（Homebrew・nvm・公式インストーラ対応）---
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo ""
  echo "Node.js が見つかりません。"
  echo "https://nodejs.org/ から LTS 版をインストールして、もう一度ダブルクリックしてください。"
  open "https://nodejs.org/" 2>/dev/null
  echo ""
  read -r -p "Enter キーで閉じます..." _
  exit 1
fi
echo "Node.js $(node -v) / npm $(npm -v)"

# --- 依存パッケージのインストール（初回、または package.json 更新時）---
if [ ! -d node_modules ] || [ package.json -nt node_modules/.package-lock.json ]; then
  echo ""
  echo "依存パッケージをインストールします（初回のみ・インターネット接続が必要です）..."
  if ! npm install; then
    echo ""
    echo "npm install に失敗しました。ネットワーク接続を確認してください。"
    read -r -p "Enter キーで閉じます..." _
    exit 1
  fi
fi

# --- 空いているポートを探す ---
while lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done
URL="http://$HOST:$PORT"

# --- サーバーが応答したらブラウザを開く（Chrome優先）---
(
  for _ in $(seq 1 120); do
    if curl -s -o /dev/null "$URL"; then
      if [ -d "/Applications/Google Chrome.app" ]; then
        open -a "Google Chrome" "$URL"
      else
        open "$URL"
      fi
      exit 0
    fi
    sleep 0.5
  done
) &

echo ""
echo "ゲームを起動します: $URL"
echo "終了するには、このウィンドウで Control + C を押してください。"
echo ""
npx vite --port "$PORT" --host "$HOST" --strictPort
