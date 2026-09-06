#!/usr/bin/env bash

# ==============================================================================
# Recaller — Single-Command Launch Script for Linux
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
    echo "Установите python3 командой: sudo apt install python3 (Linux)"
    exit 1
fi

echo "🔍 Найдена версия: $($PYTHON_CMD --version)"

# Create virtual environment if missing
if [ ! -d ".venv" ]; then
    echo "📦 Создание изолированного виртуального окружения (.venv)..."
    $PYTHON_CMD -m venv .venv || {
        echo "⚠️ Не удалось создать venv напрямую. Пробуем продолжать с глобальным Python..."
    }
fi

# Activate virtualenv if present
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
fi

# Install dependencies if missing
if ! python -c "import fastapi, uvicorn" &>/dev/null; then
    echo "📥 Установка минимальных зависимостей (fastapi, uvicorn)..."
    pip install --upgrade pip --quiet 2>/dev/null || true
    pip install -r requirements.txt
fi

echo ""
echo "=================================================="
echo "🌐 Запуск сервера Recaller на порту 8000..."
echo "👉 Откройте в браузере: http://localhost:8000"
echo "=================================================="
echo ""

# Launch server
python server.py
