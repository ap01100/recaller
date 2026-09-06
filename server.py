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
from urllib.parse import parse_qs, urlparse

# Force UTF-8 encoding for stdout/stderr (resolves Windows cp1251 charmap emoji print issues)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

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

# Check for FastAPI / Uvicorn availability
HAS_FASTAPI = False
try:
    from fastapi import FastAPI, HTTPException, Body
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse, JSONResponse
    import uvicorn
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False


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
    if os.environ.get("NO_BROWSER"):
        return
    try:
        webbrowser.open("http://localhost:8000")
    except Exception:
        pass


# ==============================================================================
# OPTION A: FASTAPI IMPLEMENTATION (Used if FastAPI & Uvicorn are installed)
# ==============================================================================

if HAS_FASTAPI:
    app = FastAPI(title="Recaller API", version="1.0.0")

    @app.get("/api/tests")
    def get_tests():
        tests = []
        for filepath in TESTS_DIR.glob("*.json"):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    tests.append(json.load(f))
            except Exception as e:
                print(f"⚠️ Ошибка чтения файла тестов {filepath}: {e}")
        tests.sort(key=lambda x: str(x.get("title", "")).lower())
        return tests

    @app.post("/api/tests")
    def save_test(test_data: dict = Body(...)):
        test_id = test_data.get("id")
        if not test_id or not str(test_id).strip():
            title = test_data.get("title", "test")
            test_id = re.sub(r'[^a-z0-9а-яё]', '-', title.lower()).strip('-')[:32] or f"test-{int(time.time())}"
            test_data["id"] = test_id

        filepath = TESTS_DIR / f"{test_id}.json"
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(test_data, f, ensure_ascii=False, indent=2)

        return test_data

    @app.get("/api/tests/{test_id}")
    def get_test(test_id: str):
        filepath = TESTS_DIR / f"{test_id}.json"
        if not filepath.exists():
            for f in TESTS_DIR.glob("*.json"):
                if f.stem == test_id:
                    filepath = f
                    break
        if filepath.exists():
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Ошибка чтения теста: {e}")
        raise HTTPException(status_code=404, detail="Тест не найден")

    @app.get("/api/tests/{test_id}/export")
    def export_test(test_id: str):
        filepath = TESTS_DIR / f"{test_id}.json"
        if not filepath.exists():
            for f in TESTS_DIR.glob("*.json"):
                if f.stem == test_id:
                    filepath = f
                    break
        if filepath.exists():
            return FileResponse(
                filepath,
                media_type="application/json",
                filename=f"{test_id}.json"
            )
        raise HTTPException(status_code=404, detail="Тест не найден")

    @app.delete("/api/tests/{test_id}")
    def delete_test(test_id: str):
        filepath = TESTS_DIR / f"{test_id}.json"
        if filepath.exists():
            filepath.unlink()
            return {"status": "ok", "deleted": test_id}
        for f in TESTS_DIR.glob("*.json"):
            if f.stem == test_id:
                f.unlink()
                return {"status": "ok", "deleted": test_id}
        raise HTTPException(status_code=404, detail="Тест не найден")

    @app.get("/api/history")
    def get_history():
        if not HISTORY_FILE.exists():
            return []
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Ошибка чтения истории {HISTORY_FILE}: {e}")
            return []

    @app.post("/api/history")
    def record_attempt(attempt: dict = Body(...)):
        history = []
        if HISTORY_FILE.exists():
            try:
                with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                    history = json.load(f)
            except Exception:
                history = []
        history.insert(0, attempt)
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
        return attempt

    @app.delete("/api/history")
    def clear_history():
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump([], f, ensure_ascii=False, indent=2)
        return {"status": "ok"}

    @app.get("/")
    def read_root():
        index_path = STATIC_DIR / "index.html"
        if not index_path.exists():
            index_path = BASE_DIR / "index.html"
        return FileResponse(index_path)

    if STATIC_DIR.exists():
        app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

    def run_server():
        threading.Thread(target=open_browser_async, daemon=True).start()
        uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)

# ==============================================================================
# OPTION B: ZERO-DEPENDENCY STDLIB HTTP.SERVER (Fallback for Termux / offline)
# ==============================================================================

else:
    from http.server import HTTPServer, BaseHTTPRequestHandler

    class FallbackHTTPRequestHandler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            # Clean single line log format
            print(f"INFO: {self.address_string()} - \"{self.requestline}\" {args[0]}")

        def send_json(self, data, status=200):
            body = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            parsed = urlparse(self.path)
            path = parsed.path

            if path == '/api/tests':
                tests = []
                for filepath in TESTS_DIR.glob("*.json"):
                    try:
                        with open(filepath, "r", encoding="utf-8") as f:
                            tests.append(json.load(f))
                    except Exception:
                        pass
                tests.sort(key=lambda x: str(x.get("title", "")).lower())
                return self.send_json(tests)

            elif path.startswith('/api/tests/'):
                subpath = path[len('/api/tests/'):].strip('/')
                is_export = subpath.endswith('/export')
                test_id = subpath[:-len('/export')].strip('/') if is_export else subpath

                filepath = TESTS_DIR / f"{test_id}.json"
                if not filepath.exists():
                    for f in TESTS_DIR.glob("*.json"):
                        if f.stem == test_id:
                            filepath = f
                            break

                if filepath.exists():
                    try:
                        with open(filepath, "rb") as f:
                            body = f.read()
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json; charset=utf-8')
                        self.send_header('Content-Length', str(len(body)))
                        self.send_header('Access-Control-Allow-Origin', '*')
                        if is_export:
                            self.send_header('Content-Disposition', f'attachment; filename="{test_id}.json"')
                        self.end_headers()
                        self.wfile.write(body)
                        return
                    except Exception as e:
                        return self.send_json({'error': str(e)}, 500)
                return self.send_json({'detail': 'Тест не найден'}, 404)

            elif path == '/api/history':
                if not HISTORY_FILE.exists():
                    return self.send_json([])
                try:
                    with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                        return self.send_json(json.load(f))
                except Exception:
                    return self.send_json([])

            # Static files routing
            file_rel = 'index.html' if path == '/' else path.lstrip('/')
            file_path = STATIC_DIR / file_rel

            if not file_path.exists() and path == '/':
                file_path = BASE_DIR / 'index.html'

            if file_path.exists() and file_path.is_file():
                content_type = 'text/html; charset=utf-8'
                if file_path.suffix == '.css':
                    content_type = 'text/css; charset=utf-8'
                elif file_path.suffix == '.js':
                    content_type = 'application/javascript; charset=utf-8'
                elif file_path.suffix == '.json':
                    content_type = 'application/json; charset=utf-8'
                elif file_path.suffix == '.svg':
                    content_type = 'image/svg+xml'

                try:
                    with open(file_path, 'rb') as f:
                        body = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', content_type)
                    self.send_header('Content-Length', str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                    return
                except Exception as e:
                    return self.send_json({'error': str(e)}, 500)

            return self.send_json({'detail': 'Not found'}, 404)

        def do_POST(self):
            parsed = urlparse(self.path)
            path = parsed.path
            length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(length)
            
            try:
                payload = json.loads(body_bytes.decode('utf-8')) if body_bytes else {}
            except Exception:
                return self.send_json({'error': 'Invalid JSON'}, 400)

            if path == '/api/tests':
                test_id = payload.get("id")
                if not test_id or not str(test_id).strip():
                    title = payload.get("title", "test")
                    test_id = re.sub(r'[^a-z0-9а-яё]', '-', title.lower()).strip('-')[:32] or f"test-{int(time.time())}"
                    payload["id"] = test_id

                filepath = TESTS_DIR / f"{test_id}.json"
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(payload, f, ensure_ascii=False, indent=2)
                return self.send_json(payload)

            elif path == '/api/history':
                history = []
                if HISTORY_FILE.exists():
                    try:
                        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                            history = json.load(f)
                    except Exception:
                        history = []
                history.insert(0, payload)
                with open(HISTORY_FILE, "w", encoding="utf-8") as f:
                    json.dump(history, f, ensure_ascii=False, indent=2)
                return self.send_json(payload)

            return self.send_json({'detail': 'Not found'}, 404)

        def do_DELETE(self):
            parsed = urlparse(self.path)
            path = parsed.path

            if path.startswith('/api/tests/'):
                test_id = path.replace('/api/tests/', '').strip()
                filepath = TESTS_DIR / f"{test_id}.json"
                if filepath.exists():
                    filepath.unlink()
                    return self.send_json({"status": "ok", "deleted": test_id})
                for f in TESTS_DIR.glob("*.json"):
                    if f.stem == test_id:
                        f.unlink()
                        return self.send_json({"status": "ok", "deleted": test_id})
                return self.send_json({'detail': 'Not found'}, 404)

            elif path == '/api/history':
                with open(HISTORY_FILE, "w", encoding="utf-8") as f:
                    json.dump([], f, ensure_ascii=False, indent=2)
                return self.send_json({"status": "ok"})

            return self.send_json({'detail': 'Not found'}, 404)

    def run_server():
        print("⚡ FastAPI не обнаружен. Запуск автономного веб-сервера Python (0 зависимостей)...")
        threading.Thread(target=open_browser_async, daemon=True).start()
        httpd = HTTPServer(('0.0.0.0', 8000), FallbackHTTPRequestHandler)
        httpd.serve_forever()

if __name__ == "__main__":
    run_server()
