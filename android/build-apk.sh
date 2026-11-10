#!/usr/bin/env bash
set -e
echo "=========================================="
echo "   EngVocab APK Builder (Linux / WSL)     "
echo "=========================================="

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

if ! command -v java >/dev/null 2>&1; then
    echo "[LỖI] Chưa cài Java! Hãy cài OpenJDK 17 (vd: sudo apt install openjdk-17-jdk)"
    exit 1
fi

echo "Đang đồng bộ assets web..."
mkdir -p app/src/main/assets
cp -r ../index.html ../detail.html ../style.css ../fonts.css ../manifest.json ../sw.js ../js ../img ../fonts app/src/main/assets/

echo "Đang build APK..."
gradle assembleDebug

echo "=========================================="
echo "   BUILD THÀNH CÔNG!                      "
echo "   File APK tại: app/build/outputs/apk/debug/app-debug.apk"
echo "=========================================="
