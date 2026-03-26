# EfficientNet-B0 Setup

This project is configured to train and serve a binary deepfake classifier based on `efficientnet_b0`.

## Dataset Layout

Create your dataset in this structure:

```text
dataset/
  train/
    fake/
    real/
  val/
    fake/
    real/
  test/
    fake/
    real/
```

Class folder names must be exactly `fake` and `real`.

## Install

Use your existing virtual environment, then install the backend requirements:

```powershell
pip install -r requirements.txt
```

## Train

Run:

```powershell
python train_efficientnet_b0.py --data-dir dataset --epochs 10 --batch-size 16
```

This writes the best checkpoint to:

```text
models/best_model.pth
```

## Serve

Start the Flask app normally:

```powershell
python app.py
```

`/api/detect` now uses the same EfficientNet-B0 checkpoint and preprocessing pipeline as the rest of the backend.
