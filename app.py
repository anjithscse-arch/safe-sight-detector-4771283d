from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image, UnidentifiedImageError
from pathlib import Path
import hashlib
import time
import sqlite3
import secrets
from datetime import datetime
import uuid
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
from detection import detection_bp

load_dotenv()

app = Flask(__name__)
limiter = Limiter(key_func=get_remote_address, app=app)
CORS(app, origins=["http://localhost:8080"])

app.register_blueprint(detection_bp)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

DB_PATH = Path("database.db")


def init_database():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS analysis_requests (
                request_id TEXT PRIMARY KEY,
                timestamp DATETIME,
                result TEXT,
                confidence FLOAT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                username TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()


def save_analysis_request(request_id: str, timestamp: str, result: str, confidence: float):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO analysis_requests (request_id, timestamp, result, confidence)
            VALUES (?, ?, ?, ?)
            """
            ,
            (request_id, timestamp, result, confidence),
        )
        conn.commit()


init_database()


def predict_image(image: Image.Image):
    image_bytes = image.tobytes()
    fake_probability = hashlib.sha256(image_bytes).digest()[0] / 255
    if fake_probability > 0.5:
        result = "Fake"
        confidence = round(fake_probability * 100, 2)
    else:
        result = "Real"
        confidence = round((1 - fake_probability) * 100, 2)
    print(f"[DEBUG] dummy fake_probability: {fake_probability:.4f}, result: {result}, confidence: {confidence}")
    return result, confidence


@app.route("/predict", methods=["POST", "OPTIONS"])
@limiter.limit("100 per minute", methods=["POST"])
def predict():
    inference_start = time.perf_counter()
    if request.method == "OPTIONS":
        return ("", 204)

    if "file" not in request.files:
        return jsonify({"error": "Invalid image file"}), 400

    file = request.files["file"]
    if not file or not file.filename:
        return jsonify({"error": "Invalid image file"}), 400

    filename_lower = file.filename.lower()
    if not any(filename_lower.endswith(ext) for ext in ALLOWED_EXTENSIONS):
        return jsonify({"error": "Invalid image file"}), 400

    if file.mimetype not in ALLOWED_MIME_TYPES:
        return jsonify({"error": "Invalid image file"}), 400

    try:
        file.stream.seek(0, 2)
        file_size = file.stream.tell()
        file.stream.seek(0)
        if file_size > MAX_FILE_SIZE_BYTES:
            return jsonify({"error": "File size exceeds 5MB limit"}), 400

        image = Image.open(file.stream).convert("RGB")
        result, confidence = predict_image(image)
        request_id = str(uuid.uuid4())
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        save_analysis_request(request_id, timestamp, result, confidence)
    except (UnidentifiedImageError, OSError) as e:
        print(f"[ERROR] {str(e)}")
        return jsonify({"error": "Invalid image file"}), 400
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return jsonify({"error": "Prediction failed"}), 500

    inference_ms = (time.perf_counter() - inference_start) * 1000
    print(f"[INFO] Inference request completed in {inference_ms:.2f} ms")
    return jsonify({
        "request_id": request_id,
        "result": result,
        "confidence": confidence
    })


@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    username = data.get("username", "").strip()

    if not email or not password or not username:
        return jsonify({"error": "All fields required"}), 400

    conn = sqlite3.connect(DB_PATH)
    try:
        salt = secrets.token_hex(16)
        hashed = hashlib.sha256((password + salt).encode()).hexdigest()
        conn.execute(
            "INSERT INTO users (email, username, password_hash, salt) VALUES (?, ?, ?, ?)",
            (email, username, hashed, salt)
        )
        conn.commit()
        return jsonify({"email": email, "username": username}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Email already registered"}), 409
    finally:
        conn.close()


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    conn = sqlite3.connect(DB_PATH)
    try:
        row = conn.execute(
            "SELECT username, password_hash, salt FROM users WHERE email = ?",
            (email,)
        ).fetchone()
        if not row:
            return jsonify({"error": "Invalid email or password"}), 401
        username, stored_hash, salt = row
        hashed = hashlib.sha256((password + salt).encode()).hexdigest()
        if hashed != stored_hash:
            return jsonify({"error": "Invalid email or password"}), 401
        return jsonify({"email": email, "username": username}), 200
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5000)
