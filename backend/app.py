from flask import Flask, jsonify, request, send_from_directory
from pathlib import Path
from werkzeug.utils import secure_filename
from flask_cors import CORS
import os
import json
import json
from pathlib import Path
from flask import Flask, jsonify

app = Flask(__name__)
ROOT = Path(__file__).resolve().parent
PRODUCTS_PATH = ROOT / "products.json"

@app.get("/api/products")
def api_products():
    if not PRODUCTS_PATH.exists():
        return jsonify([]), 200
    return jsonify(json.loads(PRODUCTS_PATH.read_text(encoding="utf-8"))), 200

print("APP STARTING...")

app = Flask(__name__)
CORS(app)  # щоб сайт на 5500 міг звертатись до API на 5000

ROOT = Path(__file__).resolve().parent.parent
SITE_DIR = ROOT / "site"
SITE_IMG_DIR = ROOT / "assets" / "img"

DATA_FILE = Path(__file__).resolve().parent / "products.json"

SITE_IMG_DIR.mkdir(parents=True, exist_ok=True)
DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

# -------------------------
# helpers for products.json
# -------------------------
def load_products():
    if not DATA_FILE.exists():
        return []
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_products(items):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

# -------------------------
# API: products
# -------------------------
@app.get("/api/products")
def api_products_list():
    return jsonify(load_products()), 200

@app.post("/api/products")
def api_products_upsert():
    item = request.get_json(silent=True) or {}
    if not item.get("id") or not item.get("name") or not item.get("price"):
        return jsonify({"error": "id, name, price are required"}), 400

    items = load_products()
    idx = next((i for i, p in enumerate(items) if p.get("id") == item["id"]), None)
    if idx is None:
        items.append(item)
    else:
        items[idx] = item

    save_products(items)
    return jsonify({"ok": True, "id": item["id"]}), 200

@app.delete("/api/products/<pid>")
def api_products_delete(pid):
    items = load_products()
    before = len(items)
    items = [p for p in items if p.get("id") != pid]
    save_products(items)
    return jsonify({"ok": len(items) != before}), 200

# -------------------------
# API: upload image
# -------------------------
@app.post("/api/upload")
def api_upload():
    """
    multipart/form-data:
      file: image
    returns: { "path": "/assets/img/filename.jpg" }
    """
    if "file" not in request.files:
        return jsonify({"error": "file is required"}), 400

    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "empty filename"}), 400

    filename = secure_filename(f.filename)
    name, ext = os.path.splitext(filename)
    ext = ext.lower()

    if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        return jsonify({"error": "unsupported file type"}), 400

    final = f"{name}_{os.urandom(3).hex()}{ext}"
    out_path = SITE_IMG_DIR / final
    f.save(out_path)

    return jsonify({"path": f"/assets/img/{final}"}), 200

# -------------------------
# serve images for production / checks
# (optional, but useful)
# -------------------------
@app.get("/assets/img/<path:filename>")
def serve_img(filename):
    return send_from_directory(SITE_IMG_DIR, filename)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
