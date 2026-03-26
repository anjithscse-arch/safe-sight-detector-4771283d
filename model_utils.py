from pathlib import Path
import time

import timm
import torch
import torch.nn as nn
from torchvision import transforms


IMAGE_SIZE = 224
DEFAULT_MODEL_PATH = Path("models/best_model.pth")
_RUNTIME_CACHE = None


class DeepfakeEfficientNet(nn.Module):
    def __init__(self, pretrained_backbone: bool = False):
        super().__init__()
        self.backbone = timm.create_model("efficientnet_b0", pretrained=pretrained_backbone, num_classes=0)
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


def build_preprocess():
    return transforms.Compose(
        [
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )


def load_model(model_path: Path | str = DEFAULT_MODEL_PATH, device: torch.device | None = None):
    device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model_path = Path(model_path)

    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found at: {model_path}")

    model = DeepfakeEfficientNet()
    load_start = time.perf_counter()
    checkpoint = torch.load(model_path, map_location=device)
    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        checkpoint = checkpoint["model_state_dict"]
    if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
        checkpoint = checkpoint["state_dict"]
    if isinstance(checkpoint, dict):
        checkpoint = {k.replace("module.", ""): v for k, v in checkpoint.items()}

    model.load_state_dict(checkpoint, strict=True)
    model = model.to(device)
    model.eval()

    total_params = sum(p.numel() for p in model.parameters())
    load_ms = (time.perf_counter() - load_start) * 1000
    return model, total_params, load_ms


def get_runtime(model_path: Path | str = DEFAULT_MODEL_PATH):
    global _RUNTIME_CACHE
    if _RUNTIME_CACHE is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model, total_params, load_ms = load_model(model_path=model_path, device=device)
        preprocess = build_preprocess()
        _RUNTIME_CACHE = {
            "device": device,
            "model": model,
            "preprocess": preprocess,
            "total_params": total_params,
            "load_ms": load_ms,
            "model_path": Path(model_path),
        }
    return _RUNTIME_CACHE
