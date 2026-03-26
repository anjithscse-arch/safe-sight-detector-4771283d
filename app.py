from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image, UnidentifiedImageError
from pathlib import Path
import time
import torch
import sqlite3
from datetime import datetime
import uuid
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
from detection import detection_bp
from model_utils import get_runtime

load_dotenv()

app = Flask(__name__)
limiter = Limiter(key_func=get_remote_address, app=app)
CORS(app, origins=["http://localhost:8080"])

app.register_blueprint(detection_bp)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

# Load model and transforms one time at startup.
DB_PATH = Path("database.db")
runtime = get_runtime()
DEVICE = runtime["device"]
MODEL_PATH = runtime["model_path"]
print(f"[INFO] Using device: {DEVICE}")
MODEL = runtime["model"]
PREPROCESS = runtime["preprocess"]
total = runtime["total_params"]
model_load_ms = runtime["load_ms"]
print(f"[INFO] Model parameters: {total:,}")
print(f"[INFO] Model loaded from {MODEL_PATH} in {model_load_ms:.2f} ms")

# Keep inference deterministic.
torch.manual_seed(42)
if torch.cuda.is_available():
    torch.cuda.manual_seed_all(42)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
torch.use_deterministic_algorithms(True, warn_only=True)


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
    image_tensor = PREPROCESS(image).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        logits = MODEL(image_tensor)
        fake_probability = torch.sigmoid(logits).item()
    if fake_probability > 0.5:
        result = "Fake"
        confidence = round(fake_probability * 100, 2)
    else:
        result = "Real"
        confidence = round((1 - fake_probability) * 100, 2)
    print(f"[DEBUG] fake_probability: {fake_probability:.4f}")
    print(f"[DEBUG] raw fake_probability: {fake_probability:.4f}, result: {result}, confidence: {confidence}")
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


if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5000)
