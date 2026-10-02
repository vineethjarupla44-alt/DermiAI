"""
tune_model.py
-------------
Complete End-to-End Fine-Tuning Script for DermAI (EfficientNetV2 HAM10000).

Features:
- Automatically loads local 'best_final.keras' or downloads from Hugging Face if missing.
- Implements two-phase transfer learning:
    Phase 1: Freeze backbone, train top classifier head (warmup).
    Phase 2: Fine-tune top convolutional blocks with low learning rate (1e-5).
- Balanced class weighting to counter extreme HAM10000 dataset imbalance (nv bias).
- Data augmentation (flips, rotations, zoom, contrast).
- Saves tuned model checkpoint and outputs instructions to plug it into the app.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import numpy as np
import tensorflow as tf

# ── Global Constants ──────────────────────────────────────────────────────────
IMG_SIZE = 224
CLASS_NAMES = ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"]
NUM_CLASSES = len(CLASS_NAMES)
HF_REPO = "ganirathod/dermiAI"
MODEL_FILENAME = "best_final.keras"


def parse_args():
    parser = argparse.ArgumentParser(description="Tune DermAI Skin Lesion Model")
    parser.add_argument(
        "--data_dir",
        type=str,
        default="./dataset",
        help="Path to dataset containing 'train' and 'val' subfolders",
    )
    parser.add_argument(
        "--model_path",
        type=str,
        default="best_final.keras",
        help="Path to base model file or destination for download",
    )
    parser.add_argument(
        "--output_model",
        type=str,
        default="best_final_tuned.keras",
        help="Path where tuned model will be saved",
    )
    parser.add_argument("--batch_size", type=int, default=16, help="Batch size for training")
    parser.add_argument("--phase1_epochs", type=int, default=3, help="Epochs for top head warmup")
    parser.add_argument("--phase2_epochs", type=int, default=12, help="Epochs for fine-tuning")
    parser.add_argument("--lr", type=float, default=1e-5, help="Learning rate for fine-tuning")
    parser.add_argument("--unfreeze_layers", type=int, default=80, help="Top layers to unfreeze in phase 2")
    return parser.parse_args()


def ensure_model_file(model_path: Path) -> Path:
    """Checks if base model exists locally. If not, downloads from Hugging Face."""
    if model_path.exists() and model_path.stat().st_size > 1_000_000:
        print(f"Loaded existing model from: {model_path.resolve()}")
        return model_path

    # Check root directory as well
    root_candidate = Path("..") / MODEL_FILENAME
    if root_candidate.exists() and root_candidate.stat().st_size > 1_000_000:
        print(f"Found base model in root directory: {root_candidate.resolve()}")
        return root_candidate

    print(f"Model file not found locally. Downloading from Hugging Face Hub ({HF_REPO}) ...")
    try:
        from huggingface_hub import hf_hub_download
        downloaded = hf_hub_download(
            repo_id=HF_REPO,
            filename=MODEL_FILENAME,
            local_dir=model_path.parent,
            local_dir_use_symlinks=False,
        )
        return Path(downloaded)
    except Exception as e:
        print(f"Failed to auto-download model from Hugging Face: {e}")
        print(f"Please place '{MODEL_FILENAME}' in this folder manually.")
        sys.exit(1)


def build_data_pipelines(data_dir: Path, batch_size: int):
    """Loads and prepares tf.data pipelines with EfficientNetV2 preprocessing."""
    train_dir = data_dir / "train"
    val_dir = data_dir / "val"

    if not train_dir.exists() or not val_dir.exists():
        raise FileNotFoundError(
            f"Dataset directory '{data_dir}' must contain 'train' and 'val' folders.\n"
            f"Expected structure:\n"
            f"  {data_dir}/train/[akiec, bcc, bkl, df, mel, nv, vasc]/\n"
            f"  {data_dir}/val/[akiec, bcc, bkl, df, mel, nv, vasc]/\n"
        )

    print("Loading datasets...")
    train_ds = tf.keras.utils.image_dataset_from_directory(
        train_dir,
        labels="inferred",
        label_mode="categorical",
        class_names=CLASS_NAMES,
        color_mode="rgb",
        batch_size=batch_size,
        image_size=(IMG_SIZE, IMG_SIZE),
        shuffle=True,
        seed=42,
    )

    val_ds = tf.keras.utils.image_dataset_from_directory(
        val_dir,
        labels="inferred",
        label_mode="categorical",
        class_names=CLASS_NAMES,
        color_mode="rgb",
        batch_size=batch_size,
        image_size=(IMG_SIZE, IMG_SIZE),
        shuffle=False,
        seed=42,
    )

    # Data augmentation for skin lesion invariance
    augmentation = tf.keras.Sequential([
        tf.keras.layers.RandomFlip("horizontal_and_vertical"),
        tf.keras.layers.RandomRotation(0.25),
        tf.keras.layers.RandomZoom(0.15),
        tf.keras.layers.RandomContrast(0.1),
    ], name="data_augmentation")

    def preprocess_train(x, y):
        x = augmentation(x, training=True)
        x = tf.keras.applications.efficientnet_v2.preprocess_input(x)
        return x, y

    def preprocess_val(x, y):
        x = tf.keras.applications.efficientnet_v2.preprocess_input(x)
        return x, y

    AUTOTUNE = tf.data.AUTOTUNE
    train_pipeline = train_ds.map(preprocess_train, num_parallel_calls=AUTOTUNE).prefetch(AUTOTUNE)
    val_pipeline = val_ds.map(preprocess_val, num_parallel_calls=AUTOTUNE).prefetch(AUTOTUNE)

    # Compute class weights to counter dataset imbalance
    train_labels = []
    for _, batch_y in train_ds:
        train_labels.extend(np.argmax(batch_y.numpy(), axis=1))
    
    train_labels = np.array(train_labels)
    total_samples = len(train_labels)
    unique_classes, counts = np.unique(train_labels, return_counts=True)
    n_classes = len(unique_classes)
    class_weight_dict = {
        int(cls): float(total_samples / (n_classes * count))
        for cls, count in zip(unique_classes, counts)
    }
    print("Computed balanced class weights:", class_weight_dict)

    return train_pipeline, val_pipeline, class_weight_dict


def tune_model(args):
    model_path = ensure_model_file(Path(args.model_path))
    output_path = Path(args.output_model)
    data_dir = Path(args.data_dir)

    train_ds, val_ds, class_weights = build_data_pipelines(data_dir, args.batch_size)

    print("\nLoading base model into memory...")
    model = tf.keras.models.load_model(model_path, compile=False)
    print(f"Base model loaded successfully! Total layers: {len(model.layers)}")

    # ── Phase 1: Warm up top classification head ───────────────────────────
    print("\n================== PHASE 1: WARMUP TOP CLASSIFIER ==================")
    
    # 1. Ensure root model is trainable
    model.trainable = True

    # 2. Freeze all base EfficientNetV2 layers, keep ONLY custom head trainable
    base_layers = []
    head_layers = []
    gap_found = False

    for layer in model.layers:
        if not gap_found:
            base_layers.append(layer)
            layer.trainable = False
            if "global_average_pooling" in layer.name or "pooling" in layer.name:
                gap_found = True
        else:
            head_layers.append(layer)
            layer.trainable = True

    # Fallback if layer naming differs: unfreeze the top 8 dense/BN head layers
    if not head_layers:
        for layer in model.layers[:-8]:
            layer.trainable = False
        for layer in model.layers[-8:]:
            layer.trainable = True
        head_layers = model.layers[-8:]

    # 3. Calculate and print parameter breakdown before compiling
    trainable_weights_list = model.trainable_weights
    trainable_params = sum(int(tf.size(w).numpy()) for w in trainable_weights_list)
    non_trainable_params = sum(int(tf.size(w).numpy()) for w in model.non_trainable_weights)

    print(f"Total model layers: {len(model.layers)}")
    print(f"Base EfficientNetV2 layers frozen: {len(base_layers)}")
    print(f"Trainable head layers: {[l.name for l in head_layers]}")
    print(f"Trainable weight tensors: {len(trainable_weights_list)}")
    print(f"Trainable parameters:     {trainable_params:,}")
    print(f"Non-trainable parameters: {non_trainable_params:,}")

    # 4. Strict verification: ensure trainable weights exist
    if len(trainable_weights_list) == 0 or trainable_params == 0:
        raise RuntimeError(
            "ERROR: The model does not have any trainable weights for Phase 1! "
            "Base freezing blocked all weights. Halting."
        )

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-4),
        loss="categorical_crossentropy",
        metrics=["accuracy", tf.keras.metrics.AUC(name="auc")],
    )

    phase1_trained = False
    if args.phase1_epochs > 0:
        print(f"\nTraining Phase 1 for {args.phase1_epochs} epoch(s)...")
        phase1_history = model.fit(
            train_ds,
            validation_data=val_ds,
            epochs=args.phase1_epochs,
            class_weight=class_weights,
        )
        if phase1_history and "loss" in phase1_history.history and len(phase1_history.history["loss"]) > 0:
            phase1_trained = True
            print(" Phase 1 completed successfully with active weight updates.")
    else:
        print("Skipping Phase 1 as requested (--phase1_epochs=0).")
        phase1_trained = True

    # 5. Requirement 7: Do not start Phase 2 until Phase 1 is verified
    if not phase1_trained:
        raise RuntimeError(
            "ERROR: Phase 1 did not train successfully! "
            "Phase 2 fine-tuning will NOT start until Phase 1 has trained."
        )

    # ── Phase 2: Fine-tune top convolutional blocks ────────────────────────
    print(f"\n================== PHASE 2: FINE-TUNING (TOP {args.unfreeze_layers} LAYERS) ==================")
    model.trainable = True

    for layer in model.layers[:-args.unfreeze_layers]:
        layer.trainable = False

    for layer in model.layers[-args.unfreeze_layers:]:
        # Keep BatchNorm frozen in backbone to preserve stable running stats during fine-tuning
        if isinstance(layer, tf.keras.layers.BatchNormalization):
            layer.trainable = False
        else:
            layer.trainable = True

    p2_weights = model.trainable_weights
    p2_trainable_params = sum(int(tf.size(w).numpy()) for w in p2_weights)
    p2_non_trainable_params = sum(int(tf.size(w).numpy()) for w in model.non_trainable_weights)

    print(f"Phase 2 trainable weight tensors: {len(p2_weights)}")
    print(f"Phase 2 trainable parameters:     {p2_trainable_params:,}")
    print(f"Phase 2 non-trainable parameters: {p2_non_trainable_params:,}")

    if len(p2_weights) == 0 or p2_trainable_params == 0:
        raise RuntimeError(
            "ERROR: The model does not have any trainable weights for Phase 2! Halting."
        )

    # Use a very low learning rate for fine-tuning to prevent catastrophic forgetting
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=args.lr),
        loss="categorical_crossentropy",
        metrics=[
            "accuracy",
            tf.keras.metrics.AUC(name="auc"),
            tf.keras.metrics.Precision(name="precision"),
            tf.keras.metrics.Recall(name="recall"),
        ],
    )

    callbacks = [
        tf.keras.callbacks.ModelCheckpoint(
            filepath=str(output_path),
            monitor="val_accuracy",
            save_best_only=True,
            verbose=1,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=2,
            min_lr=1e-7,
            verbose=1,
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=5,
            restore_best_weights=True,
            verbose=1,
        ),
    ]

    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.phase2_epochs,
        callbacks=callbacks,
        class_weight=class_weights,
    )

    print(f"\n Fine-tuning complete! Best model saved to: {output_path.resolve()}")
    print("\nTo use this newly tuned model in your DermAI application:")
    print(f"1. Replace 'best_final.keras' with '{output_path.name}'.")
    print("2. Restart the backend server.\n")


if __name__ == "__main__":
    cli_args = parse_args()
    tune_model(cli_args)
