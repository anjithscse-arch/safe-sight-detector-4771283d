from __future__ import annotations

import argparse
from pathlib import Path
import random
import time

import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

from model_utils import DeepfakeEfficientNet, IMAGE_SIZE


def parse_args():
    parser = argparse.ArgumentParser(description="Train EfficientNet-B0 for deepfake image detection.")
    parser.add_argument("--data-dir", type=Path, default=Path("dataset"))
    parser.add_argument("--output", type=Path, default=Path("models/best_model.pth"))
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--freeze-backbone", action="store_true")
    return parser.parse_args()


def set_seed(seed: int):
    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def build_dataloaders(data_dir: Path, batch_size: int, workers: int):
    train_dir = data_dir / "train"
    val_dir = data_dir / "val"
    test_dir = data_dir / "test"

    for required_dir in [train_dir, val_dir, test_dir]:
        if not required_dir.exists():
            raise FileNotFoundError(f"Missing dataset directory: {required_dir}")

    train_tfms = transforms.Compose(
        [
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(5),
            transforms.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    eval_tfms = transforms.Compose(
        [
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )

    train_ds = datasets.ImageFolder(train_dir, transform=train_tfms)
    val_ds = datasets.ImageFolder(val_dir, transform=eval_tfms)
    test_ds = datasets.ImageFolder(test_dir, transform=eval_tfms)

    expected_classes = {"fake", "real"}
    actual_classes = {name.lower() for name in train_ds.classes}
    if actual_classes != expected_classes:
        raise ValueError(
            f"Expected dataset classes {sorted(expected_classes)}, found {sorted(train_ds.classes)}"
        )

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=workers, pin_memory=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=workers, pin_memory=True)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False, num_workers=workers, pin_memory=True)
    return train_ds, val_ds, test_ds, train_loader, val_loader, test_loader


def class_to_targets(dataset: datasets.ImageFolder):
    mapping = {}
    for name, idx in dataset.class_to_idx.items():
        key = name.lower()
        if key == "fake":
            mapping[idx] = 1.0
        elif key == "real":
            mapping[idx] = 0.0
        else:
            raise ValueError(f"Unexpected class name: {name}")
    return mapping


def run_epoch(model, loader, criterion, device, optimizer=None, target_map=None):
    is_train = optimizer is not None
    model.train(is_train)

    total_loss = 0.0
    total_correct = 0
    total_samples = 0

    for images, labels in loader:
        images = images.to(device)
        labels = labels.to(device)
        targets = torch.tensor([target_map[int(label)] for label in labels], device=device).unsqueeze(1)

        if is_train:
            optimizer.zero_grad()

        with torch.set_grad_enabled(is_train):
            logits = model(images)
            loss = criterion(logits, targets)
            probs = torch.sigmoid(logits)
            preds = (probs > 0.5).float()

            if is_train:
                loss.backward()
                optimizer.step()

        total_loss += loss.item() * images.size(0)
        total_correct += (preds == targets).sum().item()
        total_samples += images.size(0)

    return total_loss / total_samples, total_correct / total_samples


def main():
    args = parse_args()
    set_seed(args.seed)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[INFO] Training on device: {device}")

    train_ds, val_ds, test_ds, train_loader, val_loader, test_loader = build_dataloaders(
        args.data_dir, args.batch_size, args.workers
    )
    target_map = class_to_targets(train_ds)

    print(f"[INFO] train samples: {len(train_ds)}")
    print(f"[INFO] val samples: {len(val_ds)}")
    print(f"[INFO] test samples: {len(test_ds)}")

    model = DeepfakeEfficientNet(pretrained_backbone=True).to(device)
    if args.freeze_backbone:
        for param in model.backbone.parameters():
            param.requires_grad = False

    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.AdamW(
        [p for p in model.parameters() if p.requires_grad],
        lr=args.lr,
        weight_decay=args.weight_decay,
    )

    best_val_acc = 0.0
    args.output.parent.mkdir(parents=True, exist_ok=True)

    for epoch in range(1, args.epochs + 1):
        start = time.perf_counter()
        train_loss, train_acc = run_epoch(model, train_loader, criterion, device, optimizer, target_map)
        val_loss, val_acc = run_epoch(model, val_loader, criterion, device, None, target_map)
        elapsed = time.perf_counter() - start

        print(
            f"[INFO] epoch {epoch}/{args.epochs} "
            f"train_loss={train_loss:.4f} train_acc={train_acc:.4f} "
            f"val_loss={val_loss:.4f} val_acc={val_acc:.4f} "
            f"time={elapsed:.1f}s"
        )

        if val_acc >= best_val_acc:
            best_val_acc = val_acc
            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "val_accuracy": val_acc,
                    "class_to_idx": train_ds.class_to_idx,
                },
                args.output,
            )
            print(f"[INFO] Saved checkpoint to {args.output}")

    checkpoint = torch.load(args.output, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])
    test_loss, test_acc = run_epoch(model, test_loader, criterion, device, None, target_map)
    print(f"[INFO] test_loss={test_loss:.4f} test_acc={test_acc:.4f}")


if __name__ == "__main__":
    main()
