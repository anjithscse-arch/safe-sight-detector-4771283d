from flask import Flask, request, jsonify
from PIL import Image, UnidentifiedImageError
from pathlib import Path
import torch
import timm
import torch.nn as nn
from torchvision import transforms
import sqlite3
from datetime import datetime
import uuid
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

app = Flask(__name__)
limiter = Limiter(key_func=get_remote_address, app=app)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

# Load model and transforms one time at startup.
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_PATH = Path("models/best_model.pth")
CLASS_NAMES = ("Real", "Fake")
DB_PATH = Path("database.db")


class DeepfakeEfficientNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.backbone = timm.create_model("efficientnet_b0", pretrained=False, num_classes=0)
        self.classifier = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(1280, 512),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(512, 1),
        )

    def forward(self, x):
        features = self.backbone(x)
        return self.classifier(features)


MODEL = DeepfakeEfficientNet()

if not MODEL_PATH.exists():
    raise FileNotFoundError(f"Model file not found at: {MODEL_PATH}")

checkpoint = torch.load(MODEL_PATH, map_location=DEVICE)
if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
    checkpoint = checkpoint["model_state_dict"]
if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
    checkpoint = checkpoint["state_dict"]
if isinstance(checkpoint, dict):
    checkpoint = {k.replace("module.", ""): v for k, v in checkpoint.items()}

MODEL.load_state_dict(checkpoint, strict=True)

MODEL = MODEL.to(DEVICE)
MODEL.eval()
PREPROCESS = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
])

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

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


def predict_image(image: Image.Image):
    image_tensor = PREPROCESS(image).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        logits = MODEL(image_tensor)
        if logits.shape[1] == 1:
            fake_probability = torch.sigmoid(logits)
            probabilities = torch.cat((1.0 - fake_probability, fake_probability), dim=1)
        else:
            probabilities = torch.nn.functional.softmax(logits, dim=1)

    predicted_class = int(torch.argmax(probabilities, dim=1).item())
    confidence = float(probabilities[0, predicted_class].item()) * 100.0
    result = CLASS_NAMES[predicted_class]

    return result, float(round(confidence, 2))


@app.route("/predict", methods=["POST", "OPTIONS"])
@limiter.limit("10 per minute", methods=["POST"])
def predict():
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
    except (UnidentifiedImageError, OSError):
        return jsonify({"error": "Invalid image file"}), 400
    except Exception:
        return jsonify({"error": "Prediction failed"}), 500

    return jsonify({
        "request_id": request_id,
        "result": result,
        "confidence": confidence
    })


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
