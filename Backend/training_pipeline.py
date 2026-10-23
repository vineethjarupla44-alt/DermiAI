"""
training_pipeline.py
--------------------
Automated, robust dataset-driven training & fine-tuning engine for DermAI.

Key Capabilities:
1. Validates dataset integrity and splits HAM10000 images if train/val are missing.
2. Dataset fingerprinting to detect data modifications and avoid redundant retraining.
3. Two-phase transfer learning (classifier head warmup + top conv fine-tuning).
4. Handles extreme class imbalance using balanced inverse frequency weighting.
5. Invariant dermatological data augmentation (rotation, flip, zoom, contrast).
6. Calculates full validation metrics: Multi-class Accuracy, Precision, Recall, F1-Score, and Confusion Matrix.
7. Thread-safe training state manager with real-time progress for API querying.
8. Safe model promotion with automatic backup of prior models and hot-reloading.
"""

from __future__ import annotations

import os
import sys
import json
import time
import shutil
import hashlib
import threading
from pathlib import Path
from typing import Callable, Optional, Dict, Any, List, Tuple

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, precision_recall_fscore_support

# ── Global Constants ──────────────────────────────────────────────────────────
IMG_SIZE = 224
CLASS_NAMES = ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"]
NUM_CLASSES = len(CLASS_NAMES)
BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "dataset"
FINGERPRINT_FILE = BASE_DIR / "dataset_fingerprint.json"


# ── Training State Manager (Singleton) ────────────────────────────────────────
class TrainingStateManager:
    """Thread-safe state manager for background model training tracking."""

    def __init__(self):
        self._lock = threading.Lock()
        self.is_training: bool = False
        self.job_id: str = ""
        self.current_phase: str = "Idle"
        self.current_epoch: int = 0
        self.total_epochs: int = 0
        self.progress_percent: float = 0.0
        self.current_loss: Optional[float] = None
        self.current_accuracy: Optional[float] = None
        self.val_loss: Optional[float] = None
        self.val_accuracy: Optional[float] = None
        self.best_val_accuracy: Optional[float] = None
        self.metrics: Dict[str, Any] = {}
        self.model_path: str = str(BASE_DIR / "best_final.keras")
        self.device: str = "GPU" if len(tf.config.list_physical_devices("GPU")) > 0 else "CPU"
        self.logs: List[str] = []
        self.error: Optional[str] = None
        self.started_at: Optional[float] = None
        self.completed_at: Optional[float] = None

    def log(self, message: str):
        timestamp = time.strftime("%H:%M:%S")
        formatted = f"[{timestamp}] {message}"
        print(formatted)
        with self._lock:
            self.logs.append(formatted)
            if len(self.logs) > 500:
                self.logs.pop(0)

    def start_job(self, job_id: str, total_epochs: int):
        with self._lock:
            self.is_training = True
            self.job_id = job_id
            self.current_phase = "Initializing dataset & model"
            self.current_epoch = 0
            self.total_epochs = total_epochs
            self.progress_percent = 0.0
            self.current_loss = None
            self.current_accuracy = None
            self.val_loss = None
            self.val_accuracy = None
            self.best_val_accuracy = None
            self.metrics = {}
            self.error = None
            self.logs = []
            self.started_at = time.time()
            self.completed_at = None

    def update_epoch(
        self,
        phase: str,
        epoch: int,
        total_epochs: int,
        loss: float,
        acc: float,
        val_loss: Optional[float] = None,
        val_acc: Optional[float] = None,
    ):
        with self._lock:
            self.current_phase = phase
            self.current_epoch = epoch
            self.total_epochs = total_epochs
            self.current_loss = round(float(loss), 4)
            self.current_accuracy = round(float(acc) * 100, 2)
            if val_loss is not None:
                self.val_loss = round(float(val_loss), 4)
            if val_acc is not None:
                self.val_accuracy = round(float(val_acc) * 100, 2)
                if self.best_val_accuracy is None or self.val_accuracy > self.best_val_accuracy:
                    self.best_val_accuracy = self.val_accuracy
            self.progress_percent = round((epoch / max(total_epochs, 1)) * 100, 1)

    def complete_job(self, metrics: Dict[str, Any], model_path: str):
        with self._lock:
            self.is_training = False
            self.current_phase = "Completed"
            self.progress_percent = 100.0
            self.metrics = metrics
            self.model_path = model_path
            self.completed_at = time.time()

    def fail_job(self, error_msg: str):
        with self._lock:
            self.is_training = False
            self.current_phase = "Failed"
            self.error = error_msg
            self.completed_at = time.time()

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            duration = None
            if self.started_at:
                end_time = self.completed_at or time.time()
                duration = round(end_time - self.started_at, 1)

            return {
                "is_training": self.is_training,
                "job_id": self.job_id,
                "current_phase": self.current_phase,
                "current_epoch": self.current_epoch,
                "total_epochs": self.total_epochs,
                "progress_percent": self.progress_percent,
                "current_loss": self.current_loss,
                "current_accuracy": self.current_accuracy,
                "val_loss": self.val_loss,
                "val_accuracy": self.val_accuracy,
                "best_val_accuracy": self.best_val_accuracy,
                "metrics": self.metrics,
                "model_path": self.model_path,
                "device": self.device,
                "duration_seconds": duration,
                "logs": self.logs[-40:],
                "error": self.error,
            }


# Singleton instance
training_state = TrainingStateManager()


# ── Dataset Verification & Splitting ──────────────────────────────────────────
def verify_and_prepare_dataset(data_dir: Path = DATASET_DIR) -> Tuple[Path, Path]:
    """Verifies train and val directories exist and are non-empty. If not, auto-splits HAM10000 images."""
    train_dir = data_dir / "train"
    val_dir = data_dir / "val"
    metadata_csv = data_dir / "HAM10000_metadata.csv"

    # Check if existing train/val are populated
    train_populated = train_dir.exists() and all((train_dir / c).exists() and len(os.listdir(train_dir / c)) > 0 for c in CLASS_NAMES)
    val_populated = val_dir.exists() and all((val_dir / c).exists() and len(os.listdir(val_dir / c)) > 0 for c in CLASS_NAMES)

    if train_populated and val_populated:
        train_count = sum(len(os.listdir(train_dir / c)) for c in CLASS_NAMES)
        val_count = sum(len(os.listdir(val_dir / c)) for c in CLASS_NAMES)
        training_state.log(f"Dataset verified: {train_count} train images, {val_count} val images across {NUM_CLASSES} classes.")
        return train_dir, val_dir

    training_state.log("Train/Val directory structure missing or incomplete. Auto-generating splits from HAM10000 dataset...")

    if not metadata_csv.exists():
        raise FileNotFoundError(f"Metadata file not found at: {metadata_csv}")

    df = pd.read_csv(metadata_csv)

    # Search for raw images in dataset folders
    image_paths = {}
    for root, _, files in os.walk(data_dir):
        for f in files:
            if f.lower().endswith((".jpg", ".jpeg", ".png")):
                image_id = os.path.splitext(f)[0]
                image_paths[image_id] = os.path.join(root, f)

    df["path"] = df["image_id"].map(image_paths)
    df = df.dropna(subset=["path"])

    if len(df) == 0:
        raise RuntimeError("No matching images found for HAM10000 metadata!")

    training_state.log(f"Matched {len(df)} images with metadata.")

    # Create target directories
    for split_dir in [train_dir, val_dir]:
        for c in CLASS_NAMES:
            (split_dir / c).mkdir(parents=True, exist_ok=True)

    # Stratified 80/20 train/val split
    from sklearn.model_selection import train_test_split
    train_df, val_df = train_test_split(
        df,
        test_size=0.20,
        random_state=42,
        stratify=df["dx"],
    )

    def _copy_split(subset_df, target_folder):
        for _, row in subset_df.iterrows():
            src = row["path"]
            label = row["dx"]
            dst = target_folder / label / os.path.basename(src)
            if not dst.exists():
                shutil.copy2(src, dst)

    training_state.log("Copying images to train/ and val/ folders...")
    _copy_split(train_df, train_dir)
    _copy_split(val_df, val_dir)

    training_state.log("Dataset preparation complete!")
    return train_dir, val_dir


# ── Dataset Change Detection / Fingerprinting ────────────────────────────────
def compute_dataset_fingerprint(data_dir: Path = DATASET_DIR) -> Dict[str, Any]:
    """Computes a checksum and summary fingerprint of the dataset."""
    metadata_csv = data_dir / "HAM10000_metadata.csv"
    train_dir = data_dir / "train"
    val_dir = data_dir / "val"

    csv_hash = ""
    if metadata_csv.exists():
        with open(metadata_csv, "rb") as f:
            csv_hash = hashlib.sha256(f.read()).hexdigest()

    train_counts = {c: len(os.listdir(train_dir / c)) if (train_dir / c).exists() else 0 for c in CLASS_NAMES}
    val_counts = {c: len(os.listdir(val_dir / c)) if (val_dir / c).exists() else 0 for c in CLASS_NAMES}

    return {
        "csv_sha256": csv_hash,
        "total_train_images": sum(train_counts.values()),
        "total_val_images": sum(val_counts.values()),
        "train_class_counts": train_counts,
        "val_class_counts": val_counts,
        "timestamp": time.time(),
    }


def is_retraining_needed(data_dir: Path = DATASET_DIR, model_path: Optional[Path] = None) -> Tuple[bool, str]:
    """Determines whether training is required based on model existence and dataset fingerprint."""
    target_model = model_path or (BASE_DIR / "best_final.keras")

    if not target_model.exists() or target_model.stat().st_size < 1_000_000:
        return True, "Model file does not exist locally."

    if not FINGERPRINT_FILE.exists():
        return False, "Model exists and no prior dataset change recorded."

    try:
        with open(FINGERPRINT_FILE, "r") as f:
            saved_fp = json.load(f)
        current_fp = compute_dataset_fingerprint(data_dir)

        if saved_fp.get("csv_sha256") != current_fp.get("csv_sha256"):
            return True, "Metadata CSV has been modified."
        if saved_fp.get("total_train_images") != current_fp.get("total_train_images"):
            return True, "Dataset image count has changed."
        if saved_fp.get("total_val_images") != current_fp.get("total_val_images"):
            return True, "Validation dataset image count has changed."

        return False, "Dataset fingerprint matches existing trained model."
    except Exception as e:
        return False, f"Fingerprint check error: {e}"


def save_dataset_fingerprint(data_dir: Path = DATASET_DIR):
    """Saves the current dataset fingerprint to disk."""
    try:
        fp = compute_dataset_fingerprint(data_dir)
        with open(FINGERPRINT_FILE, "w") as f:
            json.dump(fp, f, indent=2)
    except Exception as e:
        training_state.log(f"⚠️ Could not save dataset fingerprint: {e}")


# ── Data Pipelines & Preprocessing ────────────────────────────────────────────
def build_data_pipelines(train_dir: Path, val_dir: Path, batch_size: int = 16):
    """Builds optimized tf.data pipelines with data augmentation and balanced class weights."""
    training_state.log(f"Building data pipelines (Batch size: {batch_size}, Image size: {IMG_SIZE}x{IMG_SIZE})...")

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

    # Invariant dermatological data augmentation
    augmentation = tf.keras.Sequential(
        [
            tf.keras.layers.RandomFlip("horizontal_and_vertical"),
            tf.keras.layers.RandomRotation(0.25),
            tf.keras.layers.RandomZoom(0.15),
            tf.keras.layers.RandomContrast(0.1),
        ],
        name="dermatology_augmentation",
    )

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

    # Compute balanced class weights for HAM10000 imbalance
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

    distribution_msg = ", ".join(f"{CLASS_NAMES[c]}: {cnt} (wt: {class_weight_dict[c]:.2f})" for c, cnt in zip(unique_classes, counts))
    training_state.log(f"Class distribution & weights: {distribution_msg}")

    return train_pipeline, val_pipeline, val_ds, class_weight_dict


# ── Custom Keras Callback for Real-Time Tracking ──────────────────────────────
class RealTimeTrainingCallback(tf.keras.callbacks.Callback):
    """Bridges Keras epoch/batch events to TrainingStateManager for live API telemetry."""

    def __init__(self, phase_name: str, start_epoch_offset: int, total_job_epochs: int):
        super().__init__()
        self.phase_name = phase_name
        self.offset = start_epoch_offset
        self.total_job_epochs = total_job_epochs

    def on_epoch_begin(self, epoch, logs=None):
        current_global_epoch = self.offset + epoch + 1
        training_state.log(f"🚀 Starting {self.phase_name} - Epoch {current_global_epoch}/{self.total_job_epochs}...")

    def on_epoch_end(self, epoch, logs=None):
        logs = logs or {}
        current_global_epoch = self.offset + epoch + 1
        loss = logs.get("loss", 0.0)
        acc = logs.get("accuracy", 0.0)
        val_loss = logs.get("val_loss")
        val_acc = logs.get("val_accuracy")

        training_state.update_epoch(
            phase=self.phase_name,
            epoch=current_global_epoch,
            total_epochs=self.total_job_epochs,
            loss=loss,
            acc=acc,
            val_loss=val_loss,
            val_acc=val_acc,
        )

        val_msg = f", val_loss: {val_loss:.4f}, val_acc: {val_acc*100:.2f}%" if val_acc is not None else ""
        training_state.log(
            f"✅ Epoch {current_global_epoch}/{self.total_job_epochs} complete: "
            f"loss: {loss:.4f}, acc: {acc*100:.2f}%{val_msg}"
        )


# ── Full Validation Metrics & Confusion Matrix ────────────────────────────────
def evaluate_model_comprehensive(model: tf.keras.Model, raw_val_ds: tf.data.Dataset) -> Dict[str, Any]:
    """Runs complete multi-class evaluation computing Accuracy, Precision, Recall, F1, and Confusion Matrix."""
    training_state.log("Calculating comprehensive validation metrics & confusion matrix...")

    y_true_list = []
    y_pred_list = []
    y_prob_list = []

    for batch_x, batch_y in raw_val_ds:
        processed_x = tf.keras.applications.efficientnet_v2.preprocess_input(batch_x)
        preds = model(processed_x, training=False).numpy()

        y_true_batch = np.argmax(batch_y.numpy(), axis=1)
        y_pred_batch = np.argmax(preds, axis=1)

        y_true_list.extend(y_true_batch)
        y_pred_list.extend(y_pred_batch)
        y_prob_list.extend(preds)

    y_true = np.array(y_true_list)
    y_pred = np.array(y_pred_list)

    overall_acc = float(accuracy_score(y_true, y_pred))
    precision_macro, recall_macro, f1_macro, _ = precision_recall_fscore_support(y_true, y_pred, average="macro", zero_division=0)
    precision_weighted, recall_weighted, f1_weighted, _ = precision_recall_fscore_support(y_true, y_pred, average="weighted", zero_division=0)

    # Per-class metrics
    p_class, r_class, f1_class, support_class = precision_recall_fscore_support(y_true, y_pred, average=None, zero_division=0, labels=list(range(NUM_CLASSES)))

    per_class_metrics = {}
    for i, cname in enumerate(CLASS_NAMES):
        per_class_metrics[cname] = {
            "precision": round(float(p_class[i]), 4),
            "recall": round(float(r_class[i]), 4),
            "f1_score": round(float(f1_class[i]), 4),
            "samples": int(support_class[i]),
        }

    # Confusion Matrix
    cm = confusion_matrix(y_true, y_pred, labels=list(range(NUM_CLASSES))).tolist()

    metrics_summary = {
        "accuracy": round(overall_acc * 100, 2),
        "macro_precision": round(float(precision_macro), 4),
        "macro_recall": round(float(recall_macro), 4),
        "macro_f1": round(float(f1_macro), 4),
        "weighted_precision": round(float(precision_weighted), 4),
        "weighted_recall": round(float(recall_weighted), 4),
        "weighted_f1": round(float(f1_weighted), 4),
        "total_validation_samples": len(y_true),
        "per_class": per_class_metrics,
        "confusion_matrix": cm,
        "class_labels": CLASS_NAMES,
    }

    training_state.log(
        f"📊 Final Evaluation Results -> Accuracy: {metrics_summary['accuracy']}%, "
        f"Macro F1: {metrics_summary['macro_f1']}, Macro Recall: {metrics_summary['macro_recall']}"
    )

    return metrics_summary


# ── Core Training Pipeline Runner ─────────────────────────────────────────────
def run_training_pipeline(
    phase1_epochs: int = 2,
    phase2_epochs: int = 4,
    batch_size: int = 16,
    lr: float = 1e-5,
    unfreeze_layers: int = 60,
    force: bool = False,
    on_complete_callback: Optional[Callable[[], None]] = None,
) -> Dict[str, Any]:
    """Executes the full automated training and fine-tuning pipeline safely."""
    total_epochs = phase1_epochs + phase2_epochs
    job_id = f"train_{int(time.time())}"
    training_state.start_job(job_id, total_epochs)

    try:
        # Step 1: Dataset Verification
        training_state.log("Step 1/7: Validating HAM10000 dataset structure...")
        train_dir, val_dir = verify_and_prepare_dataset(DATASET_DIR)

        # Step 2: Data Pipeline Construction
        training_state.log("Step 2/7: Initializing data augmentation & pipelines...")
        train_ds, val_ds, raw_val_ds, class_weights = build_data_pipelines(train_dir, val_dir, batch_size=batch_size)

        # Step 3: Base Model Resolution
        training_state.log("Step 3/7: Resolving base neural network model...")
        target_model_path = BASE_DIR / "best_final.keras"
        candidate_paths = [
            target_model_path,
            BASE_DIR.parent / "best_final.keras",
            BASE_DIR / "models" / "best_final.keras",
        ]

        resolved_model_path = None
        for cp in candidate_paths:
            if cp.exists() and cp.is_file() and cp.stat().st_size > 1_000_000:
                resolved_model_path = cp
                break

        if resolved_model_path is None:
            training_state.log("Base model missing locally. Downloading from Hugging Face Hub...")
            from download_model import download_model
            resolved_model_path = download_model(target_model_path)

        training_state.log(f"Loading base model into memory from: {resolved_model_path}")
        model = tf.keras.models.load_model(str(resolved_model_path), compile=False)
        training_state.log(f"Base model loaded successfully ({len(model.layers)} total layers).")

        # Step 4: Phase 1 - Warm up Classifier Head
        if phase1_epochs > 0:
            training_state.log(f"Step 4/7: Phase 1 - Classifier Head Warmup ({phase1_epochs} epochs)...")
            model.trainable = True

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

            if not head_layers:
                for layer in model.layers[:-8]:
                    layer.trainable = False
                for layer in model.layers[-8:]:
                    layer.trainable = True
                head_layers = model.layers[-8:]

            trainable_params = sum(int(tf.size(w).numpy()) for w in model.trainable_weights)
            training_state.log(f"Phase 1 head parameters trainable: {trainable_params:,}")

            model.compile(
                optimizer=tf.keras.optimizers.Adam(learning_rate=1e-4),
                loss="categorical_crossentropy",
                metrics=["accuracy", tf.keras.metrics.AUC(name="auc")],
            )

            cb_p1 = RealTimeTrainingCallback("Phase 1: Classifier Warmup", 0, total_epochs)
            model.fit(
                train_ds,
                validation_data=val_ds,
                epochs=phase1_epochs,
                callbacks=[cb_p1],
                class_weight=class_weights,
            )

        # Step 5: Phase 2 - Fine-Tune Top Conv Layers
        if phase2_epochs > 0:
            training_state.log(f"Step 5/7: Phase 2 - Fine-Tuning Top {unfreeze_layers} Layers ({phase2_epochs} epochs)...")
            model.trainable = True

            for layer in model.layers[:-unfreeze_layers]:
                layer.trainable = False

            for layer in model.layers[-unfreeze_layers:]:
                if isinstance(layer, tf.keras.layers.BatchNormalization):
                    layer.trainable = False
                else:
                    layer.trainable = True

            p2_trainable_params = sum(int(tf.size(w).numpy()) for w in model.trainable_weights)
            training_state.log(f"Phase 2 fine-tuning parameters trainable: {p2_trainable_params:,}")

            temp_checkpoint_path = BASE_DIR / "best_training_temp.keras"

            model.compile(
                optimizer=tf.keras.optimizers.Adam(learning_rate=lr),
                loss="categorical_crossentropy",
                metrics=["accuracy", tf.keras.metrics.AUC(name="auc")],
            )

            callbacks = [
                RealTimeTrainingCallback("Phase 2: Fine-Tuning", phase1_epochs, total_epochs),
                tf.keras.callbacks.ModelCheckpoint(
                    filepath=str(temp_checkpoint_path),
                    monitor="val_accuracy",
                    save_best_only=True,
                    verbose=0,
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
                    patience=4,
                    restore_best_weights=True,
                    verbose=1,
                ),
            ]

            model.fit(
                train_ds,
                validation_data=val_ds,
                epochs=phase2_epochs,
                callbacks=callbacks,
                class_weight=class_weights,
            )

        # Step 6: Comprehensive Validation & Evaluation
        training_state.log("Step 6/7: Running complete validation evaluation...")
        evaluation_metrics = evaluate_model_comprehensive(model, raw_val_ds)

        # Step 7: Safe Promotion & Backup
        training_state.log("Step 7/7: Promoting trained model safely...")
        temp_checkpoint_path = BASE_DIR / "best_training_temp.keras"
        model.save(str(temp_checkpoint_path))

        # Create backup of current model
        if target_model_path.exists():
            backup_path = BASE_DIR / "best_final_backup.keras"
            shutil.copy2(target_model_path, backup_path)
            training_state.log(f"Created backup of previous model at: {backup_path.name}")

        # Promote new model to primary target
        shutil.copy2(temp_checkpoint_path, target_model_path)
        if (BASE_DIR.parent / "best_final.keras").exists():
            shutil.copy2(temp_checkpoint_path, BASE_DIR.parent / "best_final.keras")

        # Save fingerprint
        save_dataset_fingerprint(DATASET_DIR)

        # Clean up temporary checkpoint
        if temp_checkpoint_path.exists():
            try:
                temp_checkpoint_path.unlink()
            except Exception:
                pass

        training_state.complete_job(evaluation_metrics, str(target_model_path))
        training_state.log(f"🎉 Training pipeline completed successfully! Model active at: {target_model_path.resolve()}")

        # Hot reload in memory if callback provided
        if on_complete_callback:
            try:
                on_complete_callback()
                training_state.log("⚡ Model hot-reloaded into backend memory for instantaneous inference!")
            except Exception as reload_err:
                training_state.log(f"⚠️ Hot-reload notice: {reload_err}")

        return evaluation_metrics

    except Exception as exc:
        import traceback
        err_detail = f"{str(exc)}\n{traceback.format_exc()}"
        print(f"🔥 Training pipeline failed: {err_detail}")
        training_state.fail_job(str(exc))
        raise


def start_background_training(
    phase1_epochs: int = 2,
    phase2_epochs: int = 4,
    batch_size: int = 16,
    lr: float = 1e-5,
    unfreeze_layers: int = 60,
    force: bool = False,
    on_complete_callback: Optional[Callable[[], None]] = None,
) -> bool:
    """Launches training in a background daemon thread if not already running."""
    if training_state.is_training:
        return False

    def _worker():
        try:
            run_training_pipeline(
                phase1_epochs=phase1_epochs,
                phase2_epochs=phase2_epochs,
                batch_size=batch_size,
                lr=lr,
                unfreeze_layers=unfreeze_layers,
                force=force,
                on_complete_callback=on_complete_callback,
            )
        except Exception as e:
            print(f"Background training failed: {e}")

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()
    return True
