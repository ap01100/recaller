import os
import sys
import json
import glob
import re
import socket
import threading
import time
import webbrowser
from pathlib import Path
from typing import List, Dict, Any, Optional

# Force UTF-8 encoding for stdout/stderr (resolves Windows cp1251 charmap emoji print issues)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from fastapi import FastAPI, HTTPException, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import uvicorn

# Setup base paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
TESTS_DIR = DATA_DIR / "tests"
HISTORY_DIR = DATA_DIR / "history"
STATIC_DIR = BASE_DIR / "static"
HISTORY_FILE = HISTORY_DIR / "history.json"

# Ensure data directories exist
TESTS_DIR.mkdir(parents=True, exist_ok=True)
HISTORY_DIR.mkdir(parents=True, exist_ok=True)
STATIC_DIR.mkdir(parents=True, exist_ok=True)

# Default Demo Tests for auto-seeding if data/tests is empty
DEFAULT_DEMO_TESTS = [
    {
        "id": "linux-networking",
        "title": "Основы Linux & Сети",
        "tags": ["linux", "networking", "devops"],
        "default_timer_minutes": 5,
        "questions": [
            {
                "id": 1,
                "type": "choice",
                "text": "Какой сигнал посылает команда `kill -9 <PID>` процессу?",
                "options": ["SIGTERM", "SIGKILL", "SIGINT", "SIGHUP"],
                "correct": [1],
                "explanation": "Сигнал 9 — это `SIGKILL`. Он обрабатывается ядром напрямую и не может быть перехвачен или проигнорирован процессом."
            },
            {
                "id": 2,
                "type": "input",
                "text": "Назовите команду Linux для просмотра сокетов и открытых портов (современная замена `netstat`).",
                "correct": ["ss", "netstat"],
                "explanation": "Утилита `ss` (Socket Statistics) выводит подробную информацию о сетевых сокетах и работает значительно быстрее устаревшей `netstat`."
            },
            {
                "id": 3,
                "type": "choice",
                "text": "Какие из перечисленных портов по умолчанию зарезервированы для защищенных сетевых протоколов?",
                "options": ["443 (HTTPS)", "80 (HTTP)", "22 (SSH)", "21 (FTP)"],
                "correct": [0, 2],
                "explanation": "Порт `443` используется для HTTPS (TLS), порт `22` — для безопасного SSH-доступа."
            },
            {
                "id": 4,
                "type": "input",
                "text": "Какой конфигурационный файл в Linux хранит статические сопоставления IP-адресов доменным именам?",
                "correct": ["/etc/hosts", "etc/hosts", "hosts"],
                "explanation": "Файл `/etc/hosts` используется операционной системой для локального разрешения имен."
            },
            {
                "id": 5,
                "type": "choice",
                "text": "С помощью какой команды можно посмотреть доступное свободное дисковое пространство в понятном человеку формате?",
                "options": ["df -h", "du -sh", "free -m", "lsblk -f"],
                "correct": [0],
                "explanation": "Команда `df -h` (Disk Free, Human-readable) показывает информацию о доступном и занятом месте на смонтированных ФС."
            }
        ]
    },
    {
        "id": "web-http-frontend",
        "title": "Веб-технологии и протокол HTTP",
        "tags": ["web", "http", "api", "protocols"],
        "default_timer_minutes": 5,
        "questions": [
            {
                "id": 1,
                "type": "choice",
                "text": "Какой код состояния HTTP сообщает клиенту о постоянном перенаправлении ресурса (Redirect)?",
                "options": ["200 OK", "301 Moved Permanently", "403 Forbidden", "502 Bad Gateway"],
                "correct": [1],
                "explanation": "Код `301 Moved Permanently` сообщает клиентам и поисковым роботам, что ресурс окончательно перенесен на новый URL."
            },
            {
                "id": 2,
                "type": "input",
                "text": "Какой HTTP-метод предназначен для частичного изменения ресурса по соглашению REST?",
                "correct": ["PATCH", "patch"],
                "explanation": "Метод `PATCH` используется для внесения частичных изменений в ресурс."
            },
            {
                "id": 3,
                "type": "choice",
                "text": "Какие из перечисленных заголовков HTTP участвуют в механизме безопасности CORS?",
                "options": ["Access-Control-Allow-Origin", "X-Content-Type-Options", "Access-Control-Allow-Methods", "Content-Security-Policy"],
                "correct": [0, 2],
                "explanation": "Заголовки семейства `Access-Control-Allow-*` используются сервером при кросс-доменных запросах."
            },
            {
                "id": 4,
                "type": "input",
                "text": "Какое значение свойства `display` в CSS используется для одномерного гибкого выравнивания элементов по главной оси?",
                "correct": ["flex", "inline-flex"],
                "explanation": "`display: flex` (Flexbox) предназначен для распределения элементов вдоль главной оси."
            }
        ]
    }
]

def seed_demo_tests_if_empty():
    existing_jsons = list(TESTS_DIR.glob("*.json"))
    if not existing_jsons:
        print("🌱 Инициализация демо-тестов в data/tests/...")
        for test in DEFAULT_DEMO_TESTS:
            filepath = TESTS_DIR / f"{test['id']}.json"
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(test, f, ensure_ascii=False, indent=2)

seed_demo_tests_if_empty()

# FastAPI Application
app = FastAPI(title="Recaller API", version="1.0.0")

# ==============================================================================
# REST API ENDPOINTS
# ==============================================================================

@app.get("/api/tests")
def get_tests():
    """Retrieve list of all saved tests from data/tests/*.json"""
    tests = []
    for filepath in TESTS_DIR.glob("*.json"):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                tests.append(data)
        except Exception as e:
            print(f"⚠️ Ошибка чтения файла тестов {filepath}: {e}")
    
    # Sort alphabetically by title
    tests.sort(key=lambda x: str(x.get("title", "")).lower())
    return tests

@app.post("/api/tests")
def save_test(test_data: Dict[str, Any] = Body(...)):
    """Save or update a test in data/tests/{id}.json"""
    test_id = test_data.get("id")
    if not test_id or not str(test_id).strip():
        title = test_data.get("title", "test")
        test_id = re.sub(r'[^a-z0-9а-яё]', '-', title.lower()).strip('-')[:32] or f"test-{int(time.time())}"
        test_data["id"] = test_id

    filename = f"{test_id}.json"
    filepath = TESTS_DIR / filename
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(test_data, f, ensure_ascii=False, indent=2)

    return test_data

@app.delete("/api/tests/{test_id}")
def delete_test(test_id: str):
    """Delete a test file by ID from data/tests/"""
    filepath = TESTS_DIR / f"{test_id}.json"
    if filepath.exists():
        filepath.unlink()
        return {"status": "ok", "deleted": test_id}
    
    # Fallback search for stem matching
    for f in TESTS_DIR.glob("*.json"):
        if f.stem == test_id:
            f.unlink()
            return {"status": "ok", "deleted": test_id}

    raise HTTPException(status_code=404, detail="Тест не найден")

@app.get("/api/history")
def get_history():
    """Retrieve history of attempts from data/history/history.json"""
    if not HISTORY_FILE.exists():
        return []
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️ Ошибка чтения истории {HISTORY_FILE}: {e}")
        return []

@app.post("/api/history")
def record_attempt(attempt: Dict[str, Any] = Body(...)):
    """Record a completed test attempt into data/history/history.json"""
    history = []
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                history = json.load(f)
        except Exception:
            history = []
    
    # Insert new attempt at top
    history.insert(0, attempt)
    
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

    return attempt

@app.delete("/api/history")
def clear_history():
    """Clear all attempt history in data/history/history.json"""
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump([], f, ensure_ascii=False, indent=2)
    return {"status": "ok"}

# ==============================================================================
# FRONTEND STATIC FILES & SPA ROUTING
# ==============================================================================

@app.get("/")
def read_root():
    """Serve single page application main index.html"""
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        index_path = BASE_DIR / "index.html"
    return FileResponse(index_path)

# Mount static assets (style.css, app.js, images, etc.)
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

# ==============================================================================
# HELPER FOR AUTO-OPENING BROWSER & SERVER LAUNCH
# ==============================================================================

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def open_browser_async():
    time.sleep(1.2)
    local_ip = get_local_ip()
    print("\n" + "═"*58)
    print(" 🚀 Recaller — Запущен и готов к работе!")
    print(f" 📍 Локальный адрес:   http://localhost:8000")
    print(f" 📱 Сетевой адрес (Linux/Wi-Fi): http://{local_ip}:8000")
    print(" 💾 Данные сохраняются в data/tests/ и data/history/")
    print("═"*58 + "\n")
    try:
        webbrowser.open("http://localhost:8000")
    except Exception:
        pass

if __name__ == "__main__":
    threading.Thread(target=open_browser_async, daemon=True).start()
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
