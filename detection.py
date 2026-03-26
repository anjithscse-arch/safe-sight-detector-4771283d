from flask import Blueprint, request, jsonify
import httpx
import os
import sys
from io import BytesIO
from dotenv import load_dotenv
from PIL import Image
import torch

load_dotenv()

HF_API_KEY = os.getenv("HF_API_KEY")
HF_API_URL = "https://api-inference.huggingface.co/models/prithivMLmods/deepfake-detector-model-v1"

detection_bp = Blueprint("detection", __name__)


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

        # Try local model first (already loaded in app.py)
        try:
            app_module = sys.modules.get("app") or sys.modules.get("__main__")
            if app_module is None:
                raise RuntimeError("app module is not available")

            model = getattr(app_module, "MODEL")
            preprocess = getattr(app_module, "PREPROCESS")
            device = getattr(app_module, "DEVICE")

            image = Image.open(BytesIO(image_bytes)).convert("RGB")
            image_tensor = preprocess(image).unsqueeze(0).to(device)

            with torch.no_grad():
                logits = model(image_tensor)
                fake_probability = torch.sigmoid(logits).item()

            fake_score = round(float(fake_probability) * 100, 2)
            real_score = round((1.0 - float(fake_probability)) * 100, 2)
            scores = {"Real": real_score, "Fake": fake_score}
            is_fake = fake_score > real_score

            return jsonify(
                {
                    "is_fake": is_fake,
                    "confidence": fake_score if is_fake else real_score,
                    "label": "FAKE" if is_fake else "REAL",
                    "scores": scores,
                    "source": "local_model",
                }
            )
        except Exception as e:
            print(f"Local model failed: {e}, falling back to HuggingFace")

        # HuggingFace fallback
        response = httpx.post(
            HF_API_URL,
            headers={"Authorization": f"Bearer {HF_API_KEY}"},
            content=image_bytes,
            timeout=30.0,
        )

        if response.status_code == 503:
            return jsonify({"error": "Model is loading, retry in 20 seconds"}), 503
        if response.status_code != 200:
            return jsonify({"error": "Both local model and HuggingFace detection failed"}), 500

        results = response.json()
        scores = {item["label"]: round(item["score"] * 100, 2) for item in results}
        is_fake = scores.get("Fake", 0) > scores.get("Real", 0)

        return jsonify(
            {
                "is_fake": is_fake,
                "confidence": scores.get("Fake" if is_fake else "Real", 0),
                "label": "FAKE" if is_fake else "REAL",
                "scores": scores,
                "source": "huggingface",
            }
        )
    except httpx.TimeoutException:
        return jsonify({"error": "Request timed out"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500
