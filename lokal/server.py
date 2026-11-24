from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
from threading import Timer
from email.parser import BytesParser
from email.policy import default
import json
import os
import re
import csv
import io
import subprocess
import sys
import webbrowser
from urllib.request import Request, urlopen

try:
    from openpyxl import Workbook, load_workbook
except ImportError:
    Workbook = load_workbook = None

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


def read_json(handler, limit=1024 * 1024):
    length = int(handler.headers.get("Content-Length", "0"))
    if length > limit:
        raise ValueError("Permintaan terlalu besar.")
    return json.loads(handler.rfile.read(length).decode("utf-8"))


def project_dir(project_id):
    if not re.fullmatch(r"[a-f0-9]{12}", project_id or ""):
        return None
    path = WORKSPACE / project_id
    return path if path.is_dir() and (path / "project.json").is_file() else None


def project_info(path):
    info = json.loads((path / "project.json").read_text(encoding="utf-8"))
    source = info.get("source", {"type": "excel", "file": "editor.xlsx"})
    return {
        "id": path.name,
        "name": info.get("name", path.name),
        "source": source,
        "updated": info.get("updated", ""),
        "path": str(path)
    }


def save_info(path, info):
    from datetime import datetime
    info["updated"] = datetime.now().astimezone().isoformat(timespec="seconds")
    (path / "project.json").write_text(
        json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def parse_csv_url(url):
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != "docs.google.com":
        raise ValueError("Gunakan URL CSV publik Google Sheets.")
    if "/spreadsheets/" not in parsed.path or ("/pub" not in parsed.path and "pub" not in parsed.query) or "output=csv" not in parsed.query:
        raise ValueError("URL harus berupa tautan Publish to web dengan format CSV.")
    return url


def read_sheet_csv(url):
    request = Request(parse_csv_url(url), headers={"User-Agent": "KontenBuilder/1.0"})
    with urlopen(request, timeout=20) as response:
        content = response.read(5_000_001)
    if len(content) > 5_000_000:
        raise ValueError("CSV terlalu besar (maksimal 5 MB).")
    rows = list(csv.reader(io.StringIO(content.decode("utf-8-sig"))))
    row_count = len(rows)
    column_count = max((len(row) for row in rows), default=0)
    if row_count > 5000 or column_count > 256:
        raise ValueError("Ukuran spreadsheet maksimal 5000 baris dan 256 kolom.")
    rows = [row + [""] * (column_count - len(row)) for row in rows]
    return rows, row_count, column_count


def read_excel(path):
    if load_workbook is None:
        raise RuntimeError("Modul openpyxl belum terpasang. Jalankan: pip install -r requirements.txt")
    workbook = load_workbook(path, read_only=True, data_only=False)
    sheet = workbook.active
    rows = []
    for row in sheet.iter_rows(values_only=True):
        rows.append(["" if value is None else str(value) for value in row])
    workbook.close()
    while rows and not any(cell.strip() for cell in rows[-1]):
        rows.pop()
    column_count = max((len(row) for row in rows), default=0)
    while column_count and all(not row[column_count - 1].strip() for row in rows):
        column_count -= 1
    rows = [row[:column_count] + [""] * max(0, column_count - len(row)) for row in rows]
    if len(rows) > 5000 or column_count > 256:
        raise ValueError("Ukuran spreadsheet maksimal 5000 baris dan 256 kolom.")
    return rows, len(rows), column_count


def render_project(path):
    info = json.loads((path / "project.json").read_text(encoding="utf-8"))
    source = info.get("source", {"type": "excel", "file": "editor.xlsx"})
    if source.get("type") == "gsheet":
        csv_url = source.get("csv_url", "")
        if not csv_url:
            raise ValueError("URL CSV publik belum diatur pada sumber Google Sheets.")
        rows, row_count, column_count = read_sheet_csv(csv_url)
    else:
        file_path = path / source.get("file", "editor.xlsx")
        if not file_path.is_file():
            raise ValueError("File editor Excel tidak ditemukan.")
        rows, row_count, column_count = read_excel(file_path)
    return {"ok": True, "rows": rows, "rowCount": row_count, "columnCount": column_count}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_file(self, path, download_name):
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        self.send_header("Content-Disposition", f'attachment; filename="{download_name}"')
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parts = [part for part in urlparse(self.path).path.strip("/").split("/") if part]
        if parts == ["api", "status"]:
            return json_response(self, {"ok": True, "app": "Konten Builder", "workspace": str(WORKSPACE), "python": True})
        if parts == ["api", "projects"]:
            projects = []
            for path in WORKSPACE.iterdir():
                if path.is_dir() and (path / "project.json").is_file():
                    try:
                        projects.append(project_info(path))
                    except (OSError, json.JSONDecodeError):
                        continue
            projects.sort(key=lambda item: item["name"].lower())
            return json_response(self, {"ok": True, "projects": projects})
        if len(parts) == 4 and parts[:2] == ["api", "projects"] and parts[3] == "editor-file":
            path = project_dir(parts[2])
            if not path:
                return json_response(self, {"error": "Proyek tidak ditemukan."}, 404)
            info = json.loads((path / "project.json").read_text(encoding="utf-8"))
            file_path = path / info.get("source", {}).get("file", "editor.xlsx")
            if not file_path.is_file():
                return json_response(self, {"error": "File editor tidak ditemukan."}, 404)
            return self.send_file(file_path, "editor.xlsx")
        if len(parts) == 3 and parts[:2] == ["api", "projects"]:
            path = project_dir(parts[2])
            if not path:
                return json_response(self, {"error": "Proyek tidak ditemukan."}, 404)
            try:
                return json_response(self, {"ok": True, "project": project_info(path)})
            except (OSError, json.JSONDecodeError) as exc:
                return json_response(self, {"error": str(exc)}, 500)
        return super().do_GET()

    def do_POST(self):
        parts = [part for part in urlparse(self.path).path.strip("/").split("/") if part]
        if parts == ["api", "projects"]:
            try:
                payload = read_json(self)
                name = str(payload.get("name", "")).strip()
            except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
                return json_response(self, {"error": str(exc) or "Data tidak valid."}, 400)
            if not name or len(name) > 80 or any(c in name for c in r'<>:"/\\|?*'):
                return json_response(self, {"error": "Nama proyek tidak valid."}, 400)
            if Workbook is None:
                return json_response(self, {"error": "Modul openpyxl belum terpasang. Jalankan: pip install -r requirements.txt"}, 500)
            from uuid import uuid4
            path = WORKSPACE / uuid4().hex[:12]
            try:
                path.mkdir()
                (path / "assets").mkdir()
                (path / "dist").mkdir()
                workbook = Workbook()
                workbook.active.title = "Konten"
                workbook.save(path / "editor.xlsx")
                workbook.close()
                info = {"name": name, "version": 1, "source": {"type": "excel", "file": "editor.xlsx"}}
                save_info(path, info)
                return json_response(self, {"ok": True, "project": project_info(path)}, 201)
            except OSError as exc:
                return json_response(self, {"error": f"Gagal membuat proyek: {exc}"}, 500)

        if len(parts) == 4 and parts[:2] == ["api", "projects"] and parts[3] == "render":
            path = project_dir(parts[2])
            if not path:
                return json_response(self, {"error": "Proyek tidak ditemukan."}, 404)
            try:
                return json_response(self, render_project(path))
            except Exception as exc:
                return json_response(self, {"error": str(exc)}, 422)

        if len(parts) == 4 and parts[:2] == ["api", "projects"] and parts[3] == "open-editor":
            path = project_dir(parts[2])
            if not path:
                return json_response(self, {"error": "Proyek tidak ditemukan."}, 404)
            info = json.loads((path / "project.json").read_text(encoding="utf-8"))
            source = info.get("source", {})
            if source.get("type") == "gsheet":
                return json_response(self, {"ok": True, "url": source.get("edit_url", "")})
            file_path = (path / source.get("file", "editor.xlsx")).resolve()
            try:
                if os.name == "nt":
                    os.startfile(str(file_path))
                elif sys.platform == "darwin":
                    subprocess.Popen(["open", str(file_path)])
                else:
                    subprocess.Popen(["xdg-open", str(file_path)])
                return json_response(self, {"ok": True, "message": "File editor dibuka dengan aplikasi spreadsheet."})
            except Exception as exc:
                return json_response(self, {"error": f"Gagal membuka Excel: {exc}"}, 500)

        if len(parts) == 4 and parts[:2] == ["api", "projects"] and parts[3] == "source":
            path = project_dir(parts[2])
            if not path:
                return json_response(self, {"error": "Proyek tidak ditemukan."}, 404)
            try:
                payload = read_json(self)
                source_type = str(payload.get("type", "gsheet")).strip()
                info = json.loads((path / "project.json").read_text(encoding="utf-8"))
                if source_type == "excel":
                    if not (path / "editor.xlsx").is_file():
                        raise ValueError("File editor.xlsx tidak ditemukan.")
                    info["source"] = {"type": "excel", "file": "editor.xlsx"}
                elif source_type == "gsheet":
                    edit_url = str(payload.get("edit_url", "")).strip()
                    csv_url = str(payload.get("csv_url", "")).strip()
                    if not edit_url.startswith("https://docs.google.com/spreadsheets/"):
                        raise ValueError("URL editor Google Sheets tidak valid.")
                    if csv_url:
                        parse_csv_url(csv_url)
                    info["source"] = {"type": "gsheet", "edit_url": edit_url, "csv_url": csv_url}
                else:
                    raise ValueError("Jenis sumber tidak dikenal.")
                save_info(path, info)
                return json_response(self, {"ok": True, "project": project_info(path)})
            except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
                return json_response(self, {"error": str(exc)}, 400)

        return json_response(self, {"error": "Endpoint tidak ditemukan."}, 404)

    def do_PUT(self):
        parts = [part for part in urlparse(self.path).path.strip("/").split("/") if part]
        if len(parts) == 4 and parts[:2] == ["api", "projects"] and parts[3] == "editor-file":
            path = project_dir(parts[2])
            if not path:
                return json_response(self, {"error": "Proyek tidak ditemukan."}, 404)
            length = int(self.headers.get("Content-Length", "0"))
            if not length or length > 20 * 1024 * 1024:
                return json_response(self, {"error": "Ukuran file harus 1 byte sampai 20 MB."}, 413)
            data = self.rfile.read(length)
            if not data.startswith(b"PK"):
                return json_response(self, {"error": "File bukan workbook Excel .xlsx yang valid."}, 400)
            info = json.loads((path / "project.json").read_text(encoding="utf-8"))
            info["source"] = {"type": "excel", "file": "editor.xlsx"}
            (path / "editor.xlsx").write_bytes(data)
            save_info(path, info)
            return json_response(self, {"ok": True, "project": project_info(path)})
        if len(parts) == 3 and parts[:2] == ["api", "projects"]:
            path = project_dir(parts[2])
            if not path:
                return json_response(self, {"error": "Proyek tidak ditemukan."}, 404)
            try:
                payload = read_json(self)
                name = str(payload.get("name", "")).strip()
                if not name or len(name) > 80 or any(c in name for c in r'<>:"/\\|?*'):
                    raise ValueError("Nama proyek tidak valid.")
                info = json.loads((path / "project.json").read_text(encoding="utf-8"))
                info["name"] = name
                save_info(path, info)
                return json_response(self, {"ok": True, "project": project_info(path)})
            except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
                return json_response(self, {"error": str(exc)}, 400)
        return json_response(self, {"error": "Endpoint tidak ditemukan."}, 404)

    def do_DELETE(self):
        parts = [part for part in urlparse(self.path).path.strip("/").split("/") if part]
        if len(parts) == 3 and parts[:2] == ["api", "projects"]:
            path = project_dir(parts[2])
            if not path:
                return json_response(self, {"error": "Proyek tidak ditemukan."}, 404)
            import shutil
            shutil.rmtree(path)
            return json_response(self, {"ok": True})
        return json_response(self, {"error": "Endpoint tidak ditemukan."}, 404)


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
