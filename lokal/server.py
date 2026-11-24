from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
from threading import Timer
import json
import os
import webbrowser

ROOT = Path(__file__).resolve().parent.parent
SETTINGS_FILE = ROOT / "lokal" / "settings.json"


def load_settings():
    try:
        return json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"server": {}, "workspace": ""}


SETTINGS = load_settings()
SERVER = SETTINGS.get("server", {})
HOST = SERVER.get("host", "127.0.0.1")
PORT = int(SERVER.get("port", 4000))

workspace_setting = SETTINGS.get("workspace", "").strip()
WORKSPACE = Path(workspace_setting).expanduser() if workspace_setting else Path.home() / "Proyek-KB"
WORKSPACE.mkdir(parents=True, exist_ok=True)


def json_response(handler, data, status=200):
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/api/status":
            return json_response(self, {
                "ok": True,
                "app": "Konten Builder",
                "workspace": str(WORKSPACE),
                "python": True
            })

        if path == "/api/projects":
            projects = [
                {"name": item.name, "path": str(item)}
                for item in sorted(WORKSPACE.iterdir(), key=lambda p: p.name.lower())
                if item.is_dir() and not item.name.startswith(".")
            ]
            return json_response(self, {"projects": projects})

        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/api/projects":
            return json_response(self, {"error": "Endpoint tidak ditemukan."}, 404)

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            name = str(payload.get("name", "")).strip()
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
            return json_response(self, {"error": "Data permintaan tidak valid."}, 400)

        if not name or name in {".", ".."} or any(c in name for c in r'<>:"/\\|?*'):
            return json_response(self, {"error": "Nama proyek tidak valid."}, 400)

        project = WORKSPACE / name
        if project.exists():
            return json_response(self, {"error": "Nama proyek sudah digunakan."}, 409)

        try:
            project.mkdir()
            (project / "assets").mkdir()
            (project / "dist").mkdir()
            (project / "project.json").write_text(
                json.dumps({"name": name, "version": 1}, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8"
            )
        except OSError as exc:
            return json_response(self, {"error": f"Gagal membuat proyek: {exc}"}, 500)

        return json_response(self, {"ok": True, "name": name, "path": str(project)}, 201)


if __name__ == "__main__":
    os.chdir(ROOT)
    address = f"http://127.0.0.1:{PORT}"
    print(f"Konten Builder berjalan di {address}")
    print(f"Workspace proyek: {WORKSPACE}")
    if SERVER.get("auto_open", True):
        Timer(1, lambda: webbrowser.open(address)).start()

    try:
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan.")
