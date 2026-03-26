from io import BytesIO

from flask import Blueprint, request, jsonify
from PIL import Image as PILImage
import torch

from model_utils import get_runtime


detection_bp = Blueprint("detection", __name__)
runtime = get_runtime()
DEVICE = runtime["device"]
MODEL = runtime["model"]
PREPROCESS = runtime["preprocess"]


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

        pil_image = PILImage.open(BytesIO(image_bytes)).convert("RGB")
        image_tensor = PREPROCESS(pil_image).unsqueeze(0).to(DEVICE)

        with torch.no_grad():
            logits = MODEL(image_tensor)
            fake_probability = torch.sigmoid(logits).item()

        fake_score = round(float(fake_probability) * 100, 2)
        real_score = round((1.0 - float(fake_probability)) * 100, 2)
        scores = {"Fake": fake_score, "Real": real_score}
        is_fake = fake_probability > 0.5
        confidence = fake_score if is_fake else real_score

        return jsonify(
            {
                "is_fake": is_fake,
                "confidence": confidence,
                "label": "FAKE" if is_fake else "REAL",
                "scores": scores,
                "source": "efficientnet_b0",
            }
        )
    except Exception as e:
        print(f"[ERROR] Detection failed: {e}")
        return jsonify({"error": str(e)}), 500
