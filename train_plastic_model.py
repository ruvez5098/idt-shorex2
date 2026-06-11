#!/usr/bin/env python3
"""
Plastic Detection Model Training Script — YOLOv8 Edition
=========================================================
Drop-in replacement for train_plastic_model.py (TensorFlow/Keras version).

Every function mirrors the original script's interface so existing code
that imports from train_plastic_model.py can switch by just changing the import.

Requirements:
    pip install ultralytics numpy pillow pyyaml

Usage:
    python train_plastic_model.py --data-dir ./dataset --epochs 50 --batch-size 16

Export formats:
    --export tfjs      → TensorFlow.js  (browser)
    --export tflite    → TensorFlow Lite (mobile)
    --export onnx      → ONNX           (universal)
    --export pt        → PyTorch .pt    (default, keep for inference)
"""

import os
import sys
import shutil
import argparse
import textwrap
import json
import random
from collections import defaultdict
from pathlib import Path

# ── dependency check ──────────────────────────────────────────────────────────
try:
    from ultralytics import YOLO
    import yaml
except ImportError:
    print("Ultralytics not installed.  Run:  pip install ultralytics")
    sys.exit(1)

# Work around Ultralytics polars import issues on older or CPU-only Windows systems.
# If polars fails, fall back to Python CSV parsing for results.csv during training.
try:
    from ultralytics.engine import trainer as _trainer

    def _yaml_like_value(value: str):
        if value == "":
            return []
        try:
            if "." in value:
                return float(value)
            return int(value)
        except ValueError:
            return value

    def _read_results_csv_fallback(self):
        import csv

        data = {}
        try:
            with open(self.csv, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    for key, raw_value in row.items():
                        value = _yaml_like_value(raw_value)
                        data.setdefault(key, []).append(value)
        except FileNotFoundError:
            return {}
        return data

    _trainer.BaseTrainer.read_results_csv = _read_results_csv_fallback
except Exception:
    pass

try:
    import numpy as np
    from PIL import Image
except ImportError:
    print("Missing deps.  Run:  pip install numpy pillow")
    sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# 1.  MODEL CREATION  (replaces create_plastic_detection_model)
# ─────────────────────────────────────────────────────────────────────────────

# Available sizes — choose the one that fits your hardware
YOLO_MODELS = {
    "nano":   "yolov8n.pt",   # fastest, least accurate  → good for testing
    "small":  "yolov8s.pt",   # fast, decent accuracy    → recommended start
    "medium": "yolov8m.pt",   # balanced                 → most use-cases
    "large":  "yolov8l.pt",   # accurate, needs GPU
    "xlarge": "yolov8x.pt",   # most accurate, slowest
}

PLASTIC_CLASSES = [
    "plastic_bottle",
    "plastic_bag",
    "plastic_cup",
    "plastic_wrapper",
    "plastic_container",
    "plastic_straw",
    "plastic_film",
]


def create_plastic_detection_model(model_size: str = "small") -> YOLO:
    """
    Replacement for create_plastic_detection_model().

    Returns a YOLOv8 model pre-loaded with COCO weights, ready for fine-tuning.

    Args:
        model_size: one of 'nano', 'small', 'medium', 'large', 'xlarge'

    Returns:
        ultralytics.YOLO instance
    """
    if model_size not in YOLO_MODELS:
        print(f"Unknown size '{model_size}'. Using 'small'.")
        model_size = "small"

    weights = YOLO_MODELS[model_size]
    print(f"  Loading YOLOv8-{model_size} weights ({weights}) …")
    model = YOLO(weights)   # downloads automatically on first run
    print(f"  ✓ Model ready  —  backbone: YOLOv8-{model_size}")
    return model


# ─────────────────────────────────────────────────────────────────────────────
# 2.  DATA PREPARATION  (replaces load_and_preprocess_image / create_dummy_dataset)
# ─────────────────────────────────────────────────────────────────────────────

def load_and_preprocess_image(img_path: str, target_size=(416, 416)):
    """
    Replacement for load_and_preprocess_image().

    YOLOv8 handles preprocessing internally, but this helper is kept so any
    code that calls it directly still works.

    Returns:
        numpy array (H, W, 3) uint8, or None on error
    """
    try:
        img = Image.open(img_path).convert("RGB").resize(target_size)
        return np.array(img)
    except Exception as exc:
        print(f"  Error loading {img_path}: {exc}")
        return None


def create_dummy_dataset(num_samples: int = 20, output_dir: str = "./dummy_dataset") -> str:
    """
    Replacement for create_dummy_dataset().

    Generates a tiny valid YOLOv8 dataset (blank images + label files)
    so the training pipeline can be tested end-to-end without real data.

    Args:
        num_samples: how many dummy images to create
        output_dir:  where to write the dataset

    Returns:
        path to the generated data.yaml file
    """
    print(f"  Creating dummy dataset ({num_samples} samples) in {output_dir} …")

    splits = {"train": int(num_samples * 0.7),
              "val":   int(num_samples * 0.2),
              "test":  max(1, num_samples - int(num_samples * 0.7) - int(num_samples * 0.2))}

    for split, count in splits.items():
        img_dir = Path(output_dir) / "images" / split
        lbl_dir = Path(output_dir) / "labels" / split
        img_dir.mkdir(parents=True, exist_ok=True)
        lbl_dir.mkdir(parents=True, exist_ok=True)

        for i in range(count):
            img = Image.fromarray(np.full((416, 416, 3), 180, dtype=np.uint8))
            img.save(img_dir / f"dummy_{split}_{i:04d}.jpg")

            class_id = np.random.randint(0, len(PLASTIC_CLASSES))
            cx, cy   = np.random.uniform(0.2, 0.8, 2)
            bw, bh   = np.random.uniform(0.1, 0.4, 2)
            with open(lbl_dir / f"dummy_{split}_{i:04d}.txt", "w") as f:
                f.write(f"{class_id} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}\n")

    yaml_path = Path(output_dir) / "data.yaml"
    dataset_cfg = {
        "train": str((Path(output_dir) / "images" / "train").resolve()),
        "val":   str((Path(output_dir) / "images" / "val").resolve()),
        "test":  str((Path(output_dir) / "images" / "test").resolve()),
        "nc":    len(PLASTIC_CLASSES),
        "names": PLASTIC_CLASSES,
    }
    with open(yaml_path, "w") as f:
        yaml.dump(dataset_cfg, f, default_flow_style=False)

    print(f"  ✓ Dummy dataset ready — {yaml_path}")
    return str(yaml_path)


TACO_CATEGORY_TO_PLASTIC_CLASS = {
    "other plastic bottle": "plastic_bottle",
    "clear plastic bottle": "plastic_bottle",
    "plastic bottle": "plastic_bottle",
    "plastic cup": "plastic_cup",
    "disposable plastic cup": "plastic_cup",
    "foam cup": "plastic_cup",
    "other plastic cup": "plastic_cup",
    "plastic film": "plastic_film",
    "other plastic wrapper": "plastic_wrapper",
    "crisp packet": "plastic_wrapper",
    "plastic straw": "plastic_straw",
    "tupperware": "plastic_container",
    "disposable food container": "plastic_container",
    "foam food container": "plastic_container",
    "other plastic container": "plastic_container",
    "garbage bag": "plastic_bag",
    "single-use carrier bag": "plastic_bag",
    "polypropylene bag": "plastic_bag",
    "produce bag": "plastic_bag",
    "cereal bag": "plastic_bag",
    "bread bag": "plastic_bag",
    "plastic bag": "plastic_bag",
    "plastic lid": "plastic_container",
}

TACO_CLASS_INDEX = {
    name: PLASTIC_CLASSES.index(mapped)
    for name, mapped in TACO_CATEGORY_TO_PLASTIC_CLASS.items()
}


def find_coco_annotation_file(data_dir: Path):
    candidates = [
        data_dir / "annotations.json",
        data_dir / "data" / "annotations.json",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate

    for candidate in data_dir.glob("*.json"):
        try:
            payload = json.loads(candidate.read_text(encoding="utf-8"))
        except Exception:
            continue
        if all(key in payload for key in ("images", "annotations", "categories")):
            return candidate

    return None


def find_image_root(data_dir: Path, sample_names):
    candidates = [
        data_dir,
        data_dir / "data",
        data_dir / "images",
        data_dir / "data" / "images",
    ]
    for candidate in candidates:
        if not candidate.exists():
            continue
        found = sum(1 for name in sample_names if (candidate / name).exists())
        if found > 0:
            return candidate
    raise FileNotFoundError("Could not locate image root for COCO dataset.")


def prepare_coco_dataset(data_dir: str, output_dir: str = None) -> str:
    data_dir = Path(data_dir)
    annotation_file = find_coco_annotation_file(data_dir)
    if annotation_file is None:
        raise FileNotFoundError(f"No COCO annotation file found in {data_dir}")

    with open(annotation_file, "r", encoding="utf-8") as f:
        coco = json.load(f)

    images = coco.get("images", [])
    if not images:
        raise ValueError("COCO annotation file contains no images.")

    categories = {cat["id"]: cat["name"].strip().lower() for cat in coco.get("categories", [])}
    annotations_by_image = defaultdict(list)

    for ann in coco.get("annotations", []):
        category_name = categories.get(ann.get("category_id"), "").lower()
        class_index = TACO_CLASS_INDEX.get(category_name)
        if class_index is None:
            continue

        bbox = ann.get("bbox")
        if not bbox or len(bbox) < 4:
            continue

        annotations_by_image[ann["image_id"]].append((class_index, bbox))

    image_root = find_image_root(data_dir, [img["file_name"] for img in images[:20]])
    output_dir = Path(output_dir) if output_dir else data_dir / "taco_yolo_dataset"

    images_out = output_dir / "images"
    labels_out = output_dir / "labels"
    images_out.mkdir(parents=True, exist_ok=True)
    labels_out.mkdir(parents=True, exist_ok=True)

    images_by_id = {img["id"]: img for img in images}
    image_ids = list(images_by_id.keys())
    random.Random(42).shuffle(image_ids)

    train_split = int(len(image_ids) * 0.75)
    val_split = int(len(image_ids) * 0.85)

    for idx, image_id in enumerate(image_ids):
        if idx < train_split:
            split = "train"
        elif idx < val_split:
            split = "val"
        else:
            split = "test"

        image = images_by_id[image_id]
        rel_path = Path(image["file_name"])
        source_image = image_root / rel_path

        if not source_image.exists():
            print(f"  Skipping missing image: {source_image}")
            continue

        target_image = images_out / split / rel_path
        target_image.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(str(source_image), str(target_image))

        label_path = labels_out / split / rel_path.with_suffix(".txt")
        label_path.parent.mkdir(parents=True, exist_ok=True)

        with open(label_path, "w", encoding="utf-8") as f:
            for class_id, bbox in annotations_by_image.get(image_id, []):
                x, y, w, h = bbox
                if image["width"] == 0 or image["height"] == 0:
                    continue
                x_center = x + w / 2
                y_center = y + h / 2
                f.write(
                    f"{class_id} {x_center / image['width']:.6f} {y_center / image['height']:.6f} "
                    f"{w / image['width']:.6f} {h / image['height']:.6f}\n"
                )

    yaml_path = output_dir / "data.yaml"
    dataset_cfg = {
        "train": str((images_out / "train").resolve()),
        "val":   str((images_out / "val").resolve()),
        "test":  str((images_out / "test").resolve()),
        "nc":    len(PLASTIC_CLASSES),
        "names": PLASTIC_CLASSES,
    }
    with open(yaml_path, "w", encoding="utf-8") as f:
        yaml.dump(dataset_cfg, f, default_flow_style=False)

    print(f"  ✓ Converted COCO/TACO dataset → {output_dir}")
    print(f"  ✓ Generated data.yaml → {yaml_path}")
    return str(yaml_path)


def prepare_dataset(data_dir: str) -> str:
    """
    Validate an existing dataset folder and return the path to data.yaml.

    Expected layout (Roboflow YOLOv8 export):
        data_dir/
        ├── images/train/   images/val/   images/test/
        ├── labels/train/   labels/val/   labels/test/
        └── data.yaml

    If data.yaml is missing, one is auto-generated from the folder contents.

    Returns:
        path to data.yaml
    """
    data_dir = Path(data_dir)
    yaml_path = data_dir / "data.yaml"

    coco_annotation = find_coco_annotation_file(data_dir)
    if coco_annotation is not None:
        print(f"  Detected COCO/TACO dataset at {data_dir}. Converting to YOLOv8 layout.")
        return prepare_coco_dataset(str(data_dir))

    if yaml_path.exists():
        print(f"  ✓ Found data.yaml at {yaml_path}")
        return str(yaml_path)

    print("  data.yaml not found — generating one …")
    cfg = {
        "train": str((data_dir / "images" / "train").resolve()),
        "val":   str((data_dir / "images" / "val").resolve()),
        "test":  str((data_dir / "images" / "test").resolve()),
        "nc":    len(PLASTIC_CLASSES),
        "names": PLASTIC_CLASSES,
    }
    with open(yaml_path, "w") as f:
        yaml.dump(cfg, f, default_flow_style=False)
    print(f"  ✓ Generated {yaml_path}")
    return str(yaml_path)


# ─────────────────────────────────────────────────────────────────────────────
# 3.  TRAINING  (replaces train_model)
# ─────────────────────────────────────────────────────────────────────────────

def train_model(
    model:      YOLO,
    data_yaml:  str,
    epochs:     int = 50,
    batch_size: int = 16,
    img_size:   int = 416,
    project:    str = "./runs",
    name:       str = "plastic_yolov8",
) -> dict:
    """
    Replacement for train_model().

    Args:
        model:      YOLO instance from create_plastic_detection_model()
        data_yaml:  path to data.yaml
        epochs:     training epochs (more = better, slower)
        batch_size: images per batch (lower if GPU memory error)
        img_size:   input resolution (416 or 640 recommended)
        project:    parent folder for run outputs
        name:       sub-folder name for this run

    Returns:
        dict with keys: best_weights, last_weights, metrics
    """
    print(f"\n  Training config:")
    print(f"    data     : {data_yaml}")
    print(f"    epochs   : {epochs}")
    print(f"    batch    : {batch_size}")
    print(f"    img size : {img_size}px")

    results = model.train(
        data       = data_yaml,
        epochs     = epochs,
        batch      = batch_size,
        imgsz      = img_size,
        project    = project,
        name       = name,
        verbose    = True,
        augment    = True,
        patience   = 20,
        plots      = False,  # disable polars-backed result plotting on Windows/CPU
        show       = False,
    )

    save_dir = None
    if hasattr(model, "trainer") and getattr(model.trainer, "save_dir", None) is not None:
        save_dir = Path(model.trainer.save_dir)
    else:
        save_dir = Path(project) / name

    best_weights = save_dir / "weights" / "best.pt"
    last_weights = save_dir / "weights" / "last.pt"

    print(f"\n  ✓ Training complete")
    print(f"    Save directory : {save_dir}")
    print(f"    Best weights : {best_weights}")
    print(f"    Last weights : {last_weights}")

    return {
        "best_weights": str(best_weights),
        "last_weights": str(last_weights),
        "results":      results,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4.  EVALUATION
# ─────────────────────────────────────────────────────────────────────────────

def evaluate_model(model: YOLO, data_yaml: str) -> dict:
    """
    Evaluate a trained model and print key metrics.

    Returns:
        dict with mAP50, mAP50-95, precision, recall
    """
    print("\n  Running evaluation …")
    metrics = model.val(data=data_yaml)

    results = {
        "mAP50":    round(metrics.box.map50,  4),
        "mAP50-95": round(metrics.box.map,    4),
        "precision": round(metrics.box.mp,    4),
        "recall":   round(metrics.box.mr,     4),
    }

    print(f"  mAP@50      : {results['mAP50']:.4f}  (>0.5 is good)")
    print(f"  mAP@50-95   : {results['mAP50-95']:.4f}")
    print(f"  Precision   : {results['precision']:.4f}")
    print(f"  Recall      : {results['recall']:.4f}")
    return results


# ─────────────────────────────────────────────────────────────────────────────
# 5.  EXPORT  (replaces convert_to_tfjs)
# ─────────────────────────────────────────────────────────────────────────────

EXPORT_FORMATS = {
    "pt":     "PyTorch (.pt)          — default, use for inference",
    "onnx":   "ONNX                   — universal, works everywhere",
    "tfjs":   "TensorFlow.js          — run in browser",
    "tflite": "TensorFlow Lite        — Android / iOS / Raspberry Pi",
    "coreml": "Core ML                — Apple devices",
    "openvino": "OpenVINO             — Intel CPUs/GPUs",
}


def convert_to_tfjs(model: YOLO, output_dir: str = "./public/models") -> str:
    """
    Replacement for convert_to_tfjs() — keeps the same name so old code works.

    Exports to TensorFlow.js format and copies the result to output_dir.

    Returns:
        path to the exported model folder
    """
    return export_model(model, fmt="tfjs", output_dir=output_dir)


def export_model(model: YOLO, fmt: str = "onnx", output_dir: str = "./exported_model") -> str:
    """
    Export a trained YOLO model to the target format.

    Args:
        model:      trained YOLO instance (or path to best.pt)
        fmt:        one of 'pt', 'onnx', 'tfjs', 'tflite', 'coreml', 'openvino'
        output_dir: where to copy the exported files

    Returns:
        path where the exported model was saved
    """
    if isinstance(model, (str, Path)):
        model_path = Path(model)
        if fmt == "pt":
            os.makedirs(output_dir, exist_ok=True)
            dest = Path(output_dir) / model_path.name
            shutil.copy2(str(model_path), str(dest))
            print(f"  ✓ Exported → {dest}")
            return str(dest)
        model = YOLO(str(model))
    else:
        model_path = Path(getattr(model, "path", "")) if hasattr(model, "path") else None

    if fmt not in EXPORT_FORMATS:
        print(f"  Unknown format '{fmt}'. Supported: {list(EXPORT_FORMATS)}")
        fmt = "onnx"

    print(f"\n  Exporting model → {fmt.upper()} …")

    if fmt == "pt":
        if model_path and model_path.exists():
            os.makedirs(output_dir, exist_ok=True)
            dest = Path(output_dir) / model_path.name
            shutil.copy2(str(model_path), str(dest))
            print(f"  ✓ Exported → {dest}")
            return str(dest)

        save_dir = None
        if hasattr(model, "trainer") and getattr(model.trainer, "save_dir", None) is not None:
            save_dir = Path(model.trainer.save_dir)
        if save_dir is not None:
            for candidate_name in ["best.pt", "last.pt"]:
                candidate = save_dir / "weights" / candidate_name
                if candidate.exists():
                    os.makedirs(output_dir, exist_ok=True)
                    dest = Path(output_dir) / candidate.name
                    shutil.copy2(str(candidate), str(dest))
                    print(f"  ✓ Exported → {dest}")
                    return str(dest)

        raise ValueError("Cannot export to PT: model path unavailable. Use a '.pt' path, load a saved weights file, or train the model first.")

    extras = {
        "tfjs":   "tensorflowjs",
        "tflite": "tensorflow",
        "coreml": "coremltools",
    }
    if fmt in extras:
        print(f"  (make sure '{extras[fmt]}' is installed)")

    exported = model.export(format=fmt)

    os.makedirs(output_dir, exist_ok=True)
    dest = Path(output_dir) / Path(str(exported)).name
    if Path(str(exported)).is_dir():
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(str(exported), str(dest))
    else:
        shutil.copy2(str(exported), str(dest))

    print(f"  ✓ Exported → {dest}")
    return str(dest)


# ─────────────────────────────────────────────────────────────────────────────
# 6.  INFERENCE HELPER
# ─────────────────────────────────────────────────────────────────────────────

def run_inference(source, weights: str = "best.pt", conf: float = 0.25, save: bool = True):
    """
    Run plastic detection on an image, video, folder, or webcam.

    Args:
        source:  path to image/video/folder, URL, or 0 for webcam
        weights: path to trained .pt file
        conf:    confidence threshold (0.0 – 1.0)
        save:    whether to save annotated output

    Returns:
        list of ultralytics Results objects
    """
    model = YOLO(weights)
    results = model.predict(source=source, conf=conf, save=save, stream=True)

    all_results = []
    for r in results:
        all_results.append(r)
        boxes   = r.boxes.xyxy.cpu().numpy()
        confs   = r.boxes.conf.cpu().numpy()
        classes = r.boxes.cls.cpu().numpy().astype(int)

        print(f"\n  Detections in {Path(str(r.path)).name}:")
        if len(boxes) == 0:
            print("    — no plastic detected")
        for box, conf_val, cls in zip(boxes, confs, classes):
            label = PLASTIC_CLASSES[cls] if cls < len(PLASTIC_CLASSES) else f"class_{cls}"
            print(f"    {label:25s}  conf={conf_val:.2f}  box={box.astype(int).tolist()}")

    return all_results


# ─────────────────────────────────────────────────────────────────────────────
# 7.  CLI ENTRY POINT  (same flags as original script)
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Train plastic detection model using YOLOv8",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""
        Examples:
          # Quick test with dummy data
          python train_plastic_yolov8.py

          # Train on a real Roboflow dataset
          python train_plastic_yolov8.py --data-dir ./plastic-dataset --epochs 50

          # Train on a COCO/TACO dataset with annotations.json
          python train_plastic_yolov8.py --data-dir ./TACO-master --epochs 50

          # Export trained model to TensorFlow.js
          python train_plastic_yolov8.py --data-dir ./dataset --export tfjs

          # Run inference on an image
          python train_plastic_yolov8.py --predict ./test.jpg --weights ./runs/plastic_yolov8/weights/best.pt
        """),
    )

    parser.add_argument("--epochs",     type=int,   default=50,              help="Training epochs")
    parser.add_argument("--batch-size", type=int,   default=16,              help="Batch size")
    parser.add_argument("--data-dir",   type=str,   default=None,            help="Dataset directory or COCO/TACO root")
    parser.add_argument("--output-dir", type=str,   default="./public/models", help="Export output dir")

    parser.add_argument("--model-size", type=str,   default="small",
                        choices=list(YOLO_MODELS),   help="YOLOv8 model size")
    parser.add_argument("--img-size",   type=int,   default=416,             help="Input image size")
    parser.add_argument("--export",     type=str,   default="tfjs",
                        choices=list(EXPORT_FORMATS), help="Export format")
    parser.add_argument("--predict",    type=str,   default=None,            help="Run inference on this path")
    parser.add_argument("--weights",    type=str,   default=None,            help="Weights for inference")
    parser.add_argument("--conf",       type=float, default=0.25,            help="Confidence threshold")
    parser.add_argument("--no-train",   action="store_true",                 help="Skip training (export/predict only)")

    args = parser.parse_args()

    if args.predict:
        w = args.weights or "yolov8s.pt"
        print(f"\nRunning inference on: {args.predict}")
        print(f"Using weights: {w}")
        run_inference(args.predict, weights=w, conf=args.conf)
        return

    print("=" * 60)
    print("  Plastic Detection — YOLOv8 Training Pipeline")
    print("=" * 60)

    print("\n[1/4] Creating model …")
    model = create_plastic_detection_model(model_size=args.model_size)

    print("\n[2/4] Preparing dataset …")
    if args.data_dir and Path(args.data_dir).exists():
        data_yaml = prepare_dataset(args.data_dir)
    else:
        print("  No --data-dir provided. Using dummy dataset.")
        data_yaml = create_dummy_dataset(num_samples=30)

    if args.no_train:
        print("\n  --no-train set. Skipping training.")
    else:
        print("\n[3/4] Training …")
        result = train_model(
            model,
            data_yaml  = data_yaml,
            epochs     = args.epochs,
            batch_size = args.batch_size,
            img_size   = args.img_size,
        )

        best = result["best_weights"]
        if Path(best).exists():
            model = YOLO(best)
            print(f"\n  Reloaded best weights from {best}")

        print("\n  Evaluating best model …")
        try:
            evaluate_model(model, data_yaml)
        except Exception as exc:
            print(f"  Evaluation skipped: {exc}")

    print(f"\n[4/4] Exporting to {args.export.upper()} …")
    export_source = model
    if args.export == "pt" and not args.no_train:
        best_weights = result.get("best_weights") if isinstance(result, dict) else None
        if best_weights and Path(best_weights).exists():
            export_source = best_weights
    export_model(export_source, fmt=args.export, output_dir=args.output_dir)

    print("\n" + "=" * 60)
    print("  Done! Your YOLOv8 plastic detector is ready.")
    print(f"  Model saved to: {args.output_dir}")
    print("=" * 60)


if __name__ == "__main__":
    main()
