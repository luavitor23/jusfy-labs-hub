from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from datetime import datetime
import base64
import binascii
import json
import os
import re
import unicodedata
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

from template_catalog import TemplateCatalogError, load_template_catalog


ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
LOGO_DIR = ROOT / "banco-logos"
LOGO_CATALOG = LOGO_DIR / "catalog.json"
OFFER_DIR = ROOT / "banco-ofertas"
OFFER_CATALOG = OFFER_DIR / "catalog.json"
COPY_CACHE = ROOT / "dados" / "copies-notion.json"
NOTION_DATA_SOURCE = "a75a5d46-6453-4dc9-a12a-30c91266901a"


def read_json(path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def notion_property(properties, name):
    prop = properties.get(name) or {}
    kind = prop.get("type")
    if kind in {"title", "rich_text"}:
        return "".join(item.get("plain_text", "") for item in prop.get(kind, []))
    if kind == "select":
        return (prop.get("select") or {}).get("name", "")
    if kind == "multi_select":
        return [item.get("name", "") for item in prop.get("multi_select", [])]
    return ""


def fetch_notion_copies():
    token = os.environ.get("NOTION_TOKEN", "").strip()
    if not token:
        return None
    items = []
    cursor = None
    while True:
        request_body = {"page_size": 100}
        if cursor:
            request_body["start_cursor"] = cursor
        request = urllib.request.Request(
            f"https://api.notion.com/v1/data_sources/{NOTION_DATA_SOURCE}/query",
            data=json.dumps(request_body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Notion-Version": "2025-09-03",
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
        for page in payload.get("results", []):
            properties = page.get("properties") or {}
            items.append({
                "id": page.get("id", ""),
                "url": page.get("url", ""),
                "variation": notion_property(properties, "Variação"),
                "headline": notion_property(properties, "Headline"),
                "support": notion_property(properties, "Texto de apoio"),
                "cta": notion_property(properties, "CTA regional"),
                "status": notion_property(properties, "Status"),
                "scope": notion_property(properties, "Escopo"),
                "region": notion_property(properties, "Região"),
                "angle": notion_property(properties, "Ângulo"),
                "formats": notion_property(properties, "Formatos"),
            })
        if not payload.get("has_more"):
            break
        cursor = payload.get("next_cursor")
    return {"source": "Notion", "sourceId": NOTION_DATA_SOURCE, "syncedAt": datetime.now().astimezone().isoformat(), "live": True, "items": items}


class StudioHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".ttf": "font/ttf",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".svg": "image/svg+xml",
    }

    def guess_type(self, path):
        content_type = super().guess_type(path)
        if content_type in {"text/html", "text/css", "text/javascript", "application/javascript"}:
            return f"{content_type}; charset=utf-8"
        return content_type

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format, *args):
        return

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def list_masters(self):
        masters_dir = ROOT / "mestres-aprovados"
        items = []
        if masters_dir.is_dir():
            for folder in sorted(masters_dir.iterdir()):
                if not folder.is_dir():
                    continue
                try:
                    layout = json.loads((folder / "layout.json").read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    continue
                if not isinstance(layout, dict):
                    continue
                relative = folder.relative_to(ROOT).as_posix()
                items.append({
                    "folder": relative,
                    "name": layout.get("name") or folder.name,
                    "format": layout.get("format") or "",
                    "savedAt": layout.get("savedAt") or "",
                    "previewUrl": f"{relative}/preview.png" if (folder / "preview.png").is_file() else "",
                    "layout": layout,
                })
        items.sort(key=lambda item: (item["savedAt"], item["folder"]), reverse=True)
        return {"items": items[:30]}

    def do_GET(self):
        if self.path == "/api/templates":
            try:
                self.send_json(200, load_template_catalog(ROOT))
            except TemplateCatalogError as error:
                self.send_json(500, {"error": str(error)})
            return
        if self.path == "/api/masters":
            self.send_json(200, self.list_masters())
            return
        if self.path == "/api/logos":
            payload = read_json(LOGO_CATALOG, {"items": []})
            for item in payload.get("items") or []:
                logo_id = str(item.get("id") or "")
                item["sourceKind"] = "legacy"
                if logo_id and re.fullmatch(r"[a-z0-9_-]+", logo_id):
                    for extension in ("svg", "png"):
                        if (LOGO_DIR / f"{logo_id}.{extension}").is_file():
                            item["source"] = f"/banco-logos/{logo_id}.{extension}"
                            item.pop("crop", None)
                            item["sourceKind"] = "file-svg"
                            break
            self.send_json(200, payload)
            return
        if self.path == "/api/ofertas":
            payload = read_json(OFFER_CATALOG, {"items": []})
            for item in payload.get("items") or []:
                offer_id = str(item.get("id") or "")
                source = str(item.get("source") or "")
                candidates = [source] if source else []
                if offer_id and re.fullmatch(r"[a-z0-9_-]+", offer_id):
                    candidates += [f"{offer_id}.png", f"{offer_id}.svg"]
                for candidate in candidates:
                    if candidate and (OFFER_DIR / candidate).is_file():
                        item["source"] = f"/banco-ofertas/{candidate}"
                        break
            self.send_json(200, payload)
            return
        if self.path == "/api/copies":
            self.send_json(200, read_json(COPY_CACHE, {"source": "Notion", "items": []}))
            return
        super().do_GET()

    def read_body(self, limit):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > limit:
            raise ValueError("O arquivo enviado excede o limite permitido.")
        return self.rfile.read(length)

    def save_master(self):
        payload = json.loads(self.read_body(30_000_000).decode("utf-8"))
        name = str(payload.get("name") or "mestre")[:80]
        normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
        safe_name = re.sub(r"[^a-zA-Z0-9_-]+", "-", normalized).strip("-").lower() or "mestre"
        safe_format = re.sub(r"[^a-zA-Z0-9_-]+", "-", str(payload.get("format") or "formato")).strip("-").lower()
        svg = str(payload.get("svg") or "")
        if not svg.lstrip().startswith("<svg"):
            raise ValueError("O SVG gerado é inválido.")
        preview = str(payload.get("previewPng") or "")
        prefix = "data:image/png;base64,"
        if not preview.startswith(prefix):
            raise ValueError("A prévia PNG gerada é inválida.")
        preview_bytes = base64.b64decode(preview[len(prefix):], validate=True)

        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        master_dir = ROOT / "mestres-aprovados" / f"{timestamp}-{safe_name}-{safe_format}"
        master_dir.mkdir(parents=True, exist_ok=False)
        (master_dir / "master.svg").write_text(svg, encoding="utf-8")
        (master_dir / "preview.png").write_bytes(preview_bytes)
        metadata = {key: value for key, value in payload.items() if key not in {"svg", "previewPng"}}
        metadata["savedAt"] = datetime.now().astimezone().isoformat()
        (master_dir / "layout.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        return {"ok": True, "folder": master_dir.relative_to(ROOT).as_posix()}

    def import_logo_sheet(self):
        svg_bytes = self.read_body(3_000_000)
        if b"<svg" not in svg_bytes[:1000]:
            raise ValueError("O banco de logos precisa ser um SVG válido.")
        root = ET.fromstring(svg_bytes)
        LOGO_DIR.mkdir(parents=True, exist_ok=True)
        (LOGO_DIR / "LOGOS.svg").write_bytes(svg_bytes)
        extracted = 0
        for node in root.iter():
            if not node.tag.endswith("image"):
                continue
            href = node.attrib.get("{http://www.w3.org/1999/xlink}href") or node.attrib.get("href") or ""
            if not href.startswith("data:image/") or "," not in href:
                continue
            header, encoded = href.split(",", 1)
            extension = "png" if "png" in header else "jpg"
            (LOGO_DIR / f"embedded-{extracted}.{extension}").write_bytes(base64.b64decode(encoded))
            extracted += 1
        return {"ok": True, "file": "banco-logos/LOGOS.svg", "embedded": extracted}

    def import_copy_cache(self):
        payload = json.loads(self.read_body(2_000_000).decode("utf-8"))
        items = payload.get("items") or []
        if not isinstance(items, list):
            raise ValueError("O catálogo de copies é inválido.")
        payload["source"] = "Notion"
        payload["sourceId"] = NOTION_DATA_SOURCE
        payload["syncedAt"] = payload.get("syncedAt") or datetime.now().astimezone().isoformat()
        payload["live"] = bool(payload.get("live", False))
        COPY_CACHE.parent.mkdir(parents=True, exist_ok=True)
        COPY_CACHE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return {"ok": True, "count": len(items), "syncedAt": payload["syncedAt"]}

    def sync_copies(self):
        try:
            live_payload = fetch_notion_copies()
            if live_payload is not None:
                COPY_CACHE.parent.mkdir(parents=True, exist_ok=True)
                COPY_CACHE.write_text(json.dumps(live_payload, ensure_ascii=False, indent=2), encoding="utf-8")
                return live_payload
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            pass
        cached = read_json(COPY_CACHE, {"source": "Notion", "items": []})
        cached["live"] = False
        cached["message"] = "Catálogo local carregado. A sincronização ao vivo requer a integração segura do Notion."
        return cached

    def do_POST(self):
        try:
            if self.path == "/api/masters":
                self.send_json(201, self.save_master())
            elif self.path == "/api/logos/import":
                self.send_json(201, self.import_logo_sheet())
            elif self.path == "/api/copies/import":
                self.send_json(201, self.import_copy_cache())
            elif self.path == "/api/copies/sync":
                self.send_json(200, self.sync_copies())
            elif self.path == "/api/debug-shot":
                payload = json.loads(self.read_body(30_000_000).decode("utf-8"))
                name = re.sub(r"[^a-zA-Z0-9_.-]+", "-", str(payload.get("name") or "shot"))[:80]
                data = str(payload.get("dataUrl") or "")
                prefix = "data:image/png;base64,"
                if not data.startswith(prefix):
                    raise ValueError("dataUrl inválido")
                out_dir = ROOT / "tmp" / "review"
                out_dir.mkdir(parents=True, exist_ok=True)
                out_path = out_dir / f"{name}.png"
                out_path.write_bytes(base64.b64decode(data[len(prefix):], validate=True))
                self.send_json(200, {"ok": True, "path": str(out_path)})
            else:
                self.send_json(404, {"error": "Rota não encontrada."})
        except (ValueError, json.JSONDecodeError, binascii.Error) as error:
            self.send_json(400, {"error": str(error)})
        except ET.ParseError:
            self.send_json(400, {"error": "O SVG enviado é inválido."})
        except Exception:
            self.send_json(500, {"error": "Não foi possível concluir a operação local."})


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8765), StudioHandler)
    server.serve_forever()
