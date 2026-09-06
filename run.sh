#!/usr/bin/env bash

# ==============================================================================
# Recaller — Single-Command Launch Script for Linux / Termux (Android)
# ==============================================================================

set -e

# Force UTF-8 encoding in terminal
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

# Move to app directory
CDPATH= cd -- "$(dirname -- "$0")"

echo "=================================================="
echo " 🚀 Recaller — Самопроверка знаний"
echo "=================================================="
echo ""

# Find available python interpreter
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
else
    echo "❌ Ошибка: Python 3 не найден в вашей системе."
    echo "Установите python3 командой: sudo apt install python3 (Linux) или pkg install python (Termux)"
    exit 1
fi

echo "🔍 Найдена версия: $($PYTHON_CMD --version)"

# Create virtual environment if missing
if [ ! -d ".venv" ]; then
    echo "📦 Создание изолированного виртуального окружения (.venv)..."
    $PYTHON_CMD -m venv .venv || {
        echo "⚠️ Не удалось создать venv напрямую. Пробуем продолжать с системным Python..."
    }
fi

# Activate virtualenv if present
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
fi

# Install dependencies if missing
if ! python -c "import fastapi, uvicorn" &>/dev/null; then
    echo "📥 Попытка установки зависимостей (fastapi, uvicorn)..."
    pip install --upgrade pip --quiet 2>/dev/null || true
    pip install -r requirements.txt 2>/dev/null || {
        echo "⚡ Зависимости pip не удалось скомпилировать. Сервер автоматически запустится на встроенном Python!"
    }
fi

echo ""
echo "=================================================="
echo "🌐 Запуск сервера Recaller на порту 8000..."
echo "👉 Откройте в браузере: http://localhost:8000"
echo "=================================================="
echo ""

# Launch server
python server.py
