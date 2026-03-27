from io import BytesIO

from flask import Blueprint, request, jsonify
from PIL import Image as PILImage
import hashlib

detection_bp = Blueprint("detection", __name__)


def _dummy_detect(image_bytes: bytes):
    digest = hashlib.sha256(image_bytes).digest()
    fake_probability = digest[0] / 255
    fake_score = round(float(fake_probability) * 100, 2)
    real_score = round((1.0 - float(fake_probability)) * 100, 2)
    is_fake = fake_probability > 0.5
    confidence = fake_score if is_fake else real_score
    return {
        "is_fake": is_fake,
        "confidence": confidence,
        "label": "FAKE" if is_fake else "REAL",
        "scores": {"Fake": fake_score, "Real": real_score},
        "source": "dummy_prediction",
    }


@detection_bp.route("/api/detect", methods=["POST"])
def detect_deepfake():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
            return jsonify({"error": "Unsupported file type"}), 400

        image_bytes = file.read()
        if len(image_bytes) > 5 * 1024 * 1024:
            return jsonify({"error": "File too large. Max 5MB"}), 400

        PILImage.open(BytesIO(image_bytes)).convert("RGB")

        return jsonify(_dummy_detect(image_bytes))
    except Exception as e:
        print(f"[ERROR] Detection failed: {e}")
        return jsonify({"error": str(e)}), 500
