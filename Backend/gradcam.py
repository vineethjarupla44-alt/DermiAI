from __future__ import annotations

import io
import json
import os
import sys
from pathlib import Path

# Ensure clean UTF-8 terminal logging on Windows
if sys.platform == "win32":
    try:
        if sys.stdout and hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if sys.stderr and hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import cv2
import numpy as np
from PIL import Image
import tensorflow as tf
from huggingface_hub import hf_hub_download

CLASS_NAMES = ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"]
CLASS_DETAILS = {
    "akiec": {"name": "Actinic keratoses", "risk_severity": "Moderate", "risk_label": "Precancerous"},
    "bcc": {"name": "Basal cell carcinoma", "risk_severity": "High", "risk_label": "Malignant"},
    "bkl": {"name": "Benign keratosis", "risk_severity": "Low", "risk_label": "Benign"},
    "df": {"name": "Dermatofibroma", "risk_severity": "Low", "risk_label": "Benign"},
    "mel": {"name": "Melanoma", "risk_severity": "High", "risk_label": "Malignant"},
    "nv": {"name": "Melanocytic nevus", "risk_severity": "Low", "risk_label": "Benign"},
    "vasc": {"name": "Vascular lesion", "risk_severity": "Moderate", "risk_label": "Usually benign"},
}
IMG_SIZE = 224

def load_scales(scales_path: str | Path | None = None) -> np.ndarray:
    default_scales = {
        "akiec": 0.4,
        "bcc": 0.8,
        "bkl": 0.55,
        "df": 0.4,
        "mel": 0.7,
        "nv": 1.45,
        "vasc": 0.5,
    }

    if scales_path:
        path = Path(scales_path)
        if path.exists():
            with path.open("r", encoding="utf-8") as file:
                default_scales.update(json.load(file))

    return np.array([default_scales[name] for name in CLASS_NAMES], dtype=np.float32)


def load_model(model_path: str | Path) -> tuple[tf.keras.Model, str, bool]:
    resolved_path = Path(model_path)
    
    if not resolved_path.exists():
        repo_id = os.getenv("HF_MODEL_REPO")
        if not repo_id:
            raise RuntimeError(f"Model file not found at {resolved_path} and HF_MODEL_REPO is not set.")
        
        print(f"Model not found locally at {resolved_path}. Downloading from Hugging Face ({repo_id})...")
        try:
            # We assume the model is stored as best_final.keras in the root of the HF repo
            downloaded_path = hf_hub_download(
                repo_id=repo_id,
                filename="best_final.keras",
                local_dir=resolved_path.parent,
                local_dir_use_symlinks=False,
                token=os.getenv("HF_TOKEN")
            )
            # Rename if the downloaded filename doesn't match the expected model_path
            if Path(downloaded_path).absolute() != resolved_path.absolute():
                os.rename(downloaded_path, resolved_path)
            print(f"Successfully downloaded model to {resolved_path}")
        except Exception as e:
            raise RuntimeError(f"Failed to download model from Hugging Face: {e}")

    model = tf.keras.models.load_model(resolved_path, compile=False)
    try:
        last_conv = _find_last_conv_layer_name(model)
        if last_conv:
            base_m, head_m = _get_base_and_head(model, last_conv)
            feat_fn = _get_compiled_feature_fn(base_m)
            head_cam_fn = _get_compiled_head_cam_fn(head_m)
            dummy = tf.zeros((1, IMG_SIZE, IMG_SIZE, 3), dtype=tf.float32)
            c_idx = tf.constant(0, dtype=tf.int32)
            f = feat_fn(dummy)
            _ = head_cam_fn(f, c_idx)
            print("[INFO] Model and Grad-CAM pre-warmed for ultra-fast inference!")
    except Exception as warm_err:
        print(f"[INFO] Pre-warm skipped: {warm_err}")
    return model, "cpu", False


def _preprocess_for_model(img_rgb_uint8: np.ndarray) -> np.ndarray:
    img = cv2.resize(img_rgb_uint8, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA).astype(np.float32)
    img = tf.keras.applications.efficientnet_v2.preprocess_input(img)  # [-1, 1]
    return img


def _tta_variants(img_rgb_uint8: np.ndarray) -> list[np.ndarray]:
    # Dual-pass TTA: original + horizontal flip for robust predictions with fast CPU inference
    return [
        img_rgb_uint8,
        np.ascontiguousarray(img_rgb_uint8[:, ::-1, :]),
    ]


def _scaled_probs(probs: np.ndarray, class_scales: np.ndarray) -> np.ndarray:
    scaled = probs.astype(np.float32) * class_scales.astype(np.float32)
    return scaled / max(float(np.sum(scaled)), 1e-8)


def predict_probs_tta(model: tf.keras.Model, img_rgb_uint8: np.ndarray, class_scales: np.ndarray) -> np.ndarray:
    variants = _tta_variants(img_rgb_uint8)
    batch = np.stack([_preprocess_for_model(v) for v in variants], axis=0)
    logits = model(batch, training=False).numpy()
    # Check if the model already outputs softmax probabilities (sums to 1.0, all positive)
    is_prob = np.allclose(np.sum(logits, axis=-1), 1.0, atol=1e-4) and np.all(logits >= -1e-5)
    if is_prob:
        probs = logits.mean(axis=0)
    else:
        probs = tf.nn.softmax(logits, axis=-1).numpy().mean(axis=0)
    return _scaled_probs(probs, class_scales)

def overlay_heatmap(original_np: np.ndarray, cam: np.ndarray) -> np.ndarray:
    height, width = original_np.shape[:2]
    resized_cam = cv2.resize(cam, (width, height))
    colored = cv2.applyColorMap(np.uint8(resized_cam * 255), cv2.COLORMAP_JET)
    colored = cv2.cvtColor(colored, cv2.COLOR_BGR2RGB)
    return np.clip((0.45 * colored) + (0.55 * original_np), 0, 255).astype("uint8")

_last_conv_name_cache: str | None = None
_grad_model_cache: dict[str, tf.keras.Model] = {}

def _find_last_conv_layer_name(model: tf.keras.Model) -> str | None:
    """Recursively find the name of the last Conv2D layer."""
    global _last_conv_name_cache
    if _last_conv_name_cache is not None:
        return _last_conv_name_cache

    for layer in reversed(model.layers):
        # If the layer is a model itself, recurse into it
        if isinstance(layer, tf.keras.Model):
            found = _find_last_conv_layer_name(layer)
            if found:
                _last_conv_name_cache = found
                return found
        if isinstance(layer, tf.keras.layers.Conv2D):
            _last_conv_name_cache = layer.name
            return layer.name
    return None


def _get_grad_model(model: tf.keras.Model, last_conv_layer_name: str) -> tf.keras.Model:
    global _grad_model_cache
    if last_conv_layer_name not in _grad_model_cache:
        last_conv_layer = model.get_layer(last_conv_layer_name)
        _grad_model_cache[last_conv_layer_name] = tf.keras.Model(model.inputs, [last_conv_layer.output, model.output])
    return _grad_model_cache[last_conv_layer_name]


_base_model_cache = {}
_head_model_cache = {}
_compiled_feat_fn = None
_compiled_head_cam_fn = None

def _get_base_and_head(model: tf.keras.Model, last_conv_layer_name: str):
    global _base_model_cache, _head_model_cache
    if last_conv_layer_name not in _base_model_cache:
        last_conv = model.get_layer(last_conv_layer_name)
        _base_model_cache[last_conv_layer_name] = tf.keras.Model(model.inputs, last_conv.output)
        _head_model_cache[last_conv_layer_name] = tf.keras.Model(last_conv.output, model.output)
    return _base_model_cache[last_conv_layer_name], _head_model_cache[last_conv_layer_name]

def _get_compiled_feature_fn(base_m: tf.keras.Model):
    global _compiled_feat_fn
    if _compiled_feat_fn is None:
        @tf.function
        def _feat_fn(x):
            return base_m(x, training=False)
        _compiled_feat_fn = _feat_fn
    return _compiled_feat_fn

def _get_compiled_head_cam_fn(head_m: tf.keras.Model):
    global _compiled_head_cam_fn
    if _compiled_head_cam_fn is None:
        @tf.function
        def _h_cam(feat, class_idx):
            with tf.GradientTape() as tape:
                tape.watch(feat)
                preds = head_m(feat, training=False)
                if isinstance(preds, (list, tuple)):
                    preds = preds[0]
                score = preds[:, class_idx]
            grads = tape.gradient(score, feat)
            pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
            conv_f = feat[0]
            heatmap = tf.reduce_sum(conv_f * pooled_grads, axis=-1)
            heatmap = tf.nn.relu(heatmap)
            return preds, heatmap / (tf.reduce_max(heatmap) + 1e-8)
        _compiled_head_cam_fn = _h_cam
    return _compiled_head_cam_fn


def reset_model_cache():
    """Clears all cached submodels and compiled graph functions when reloading model."""
    global _base_model_cache, _head_model_cache, _compiled_feat_fn, _compiled_head_cam_fn, _last_conv_name_cache
    _base_model_cache.clear()
    _head_model_cache.clear()
    _compiled_feat_fn = None
    _compiled_head_cam_fn = None
    _last_conv_name_cache = None


def run_inference(
    model: tf.keras.Model,
    device: str,
    image_bytes: bytes,
    class_scales: np.ndarray,
    demo_mode: bool,
) -> dict:
    pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    original_np = np.array(pil)

    # 1. Preprocess once for model
    input_img = _preprocess_for_model(original_np)
    input_tensor = tf.convert_to_tensor(np.expand_dims(input_img, axis=0))

    last_conv_name = _find_last_conv_layer_name(model)
    if not last_conv_name:
        raise RuntimeError("Could not find a Conv2D layer for Grad-CAM.")

    base_m, head_m = _get_base_and_head(model, last_conv_name)
    feat_fn = _get_compiled_feature_fn(base_m)
    head_cam_fn = _get_compiled_head_cam_fn(head_m)

    # 2. Single forward pass through the 1000-layer backbone (~0.9s on CPU)
    feat = feat_fn(input_tensor)

    # Fast head prediction (<3ms)
    raw_logits = head_m(feat, training=False)
    if isinstance(raw_logits, (list, tuple)):
        raw_logits = raw_logits[0]
    logits = raw_logits.numpy()

    is_prob = np.allclose(np.sum(logits, axis=-1), 1.0, atol=1e-4) and np.all(logits >= -1e-5)
    if is_prob:
        probs = logits[0]
    else:
        probs = tf.nn.softmax(logits, axis=-1).numpy()[0]

    scaled_probs = _scaled_probs(probs, class_scales)
    prediction_index = int(np.argmax(scaled_probs))
    max_prob = float(scaled_probs[prediction_index])

    # 3. Instant Grad-CAM backprop through ONLY the 10-layer head (<4ms)
    _, cam_tensor = head_cam_fn(feat, tf.constant(prediction_index, dtype=tf.int32))
    cam = cam_tensor.numpy()

    # 4. Fast visual canvas (scaled to max 800px for instantaneous colormap and encoding)
    h, w = original_np.shape[:2]
    if max(h, w) > 800:
        scale = 800.0 / max(h, w)
        vis_w, vis_h = int(w * scale), int(h * scale)
        vis_np = cv2.resize(original_np, (vis_w, vis_h), interpolation=cv2.INTER_AREA)
    else:
        vis_w, vis_h = w, h
        vis_np = original_np

    # 5. Fast Grad-CAM heatmap overlay
    resized_cam = cv2.resize(cam, (vis_w, vis_h))
    colored_cam = cv2.applyColorMap(np.uint8(resized_cam * 255), cv2.COLORMAP_JET)
    colored_cam = cv2.cvtColor(colored_cam, cv2.COLOR_BGR2RGB)
    heatmap_overlay = np.clip((0.45 * colored_cam) + (0.55 * vis_np), 0, 255).astype("uint8")

    # 6. Fine structural lesion saliency map (instantaneous 0.03s)
    gray = cv2.cvtColor(vis_np, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    grad_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    grad_mag = np.sqrt(grad_x**2 + grad_y**2)
    grad_mag = grad_mag / (np.max(grad_mag) + 1e-8)
    sal = resized_cam * (0.5 * grad_mag + 0.5)
    sal = sal / (np.max(sal) + 1e-8)
    sal_hot = cv2.applyColorMap(np.uint8(sal * 255), cv2.COLORMAP_HOT)
    sal_hot = cv2.cvtColor(sal_hot, cv2.COLOR_BGR2RGB)
    saliency_overlay = np.clip((0.6 * sal_hot) + (0.4 * vis_np), 0, 255).astype("uint8")

    if max_prob < 0.20:
        prediction_code = "unrelated"
        prediction_detail = {
            "name": "Invalid Image / Not a Skin Lesion",
            "risk_severity": "N/A",
            "risk_label": "Unknown"
        }
    elif max_prob < 0.35:
        prediction_code = "normal"
        prediction_detail = {
            "name": "Normal / No Disease Detected",
            "risk_severity": "None",
            "risk_label": "Healthy"
        }
    else:
        prediction_code = CLASS_NAMES[prediction_index]
        prediction_detail = CLASS_DETAILS[prediction_code]

    top_indices = np.argsort(scaled_probs)[::-1][:3].tolist()
    top3 = [
        {
            "name": CLASS_DETAILS[CLASS_NAMES[index]]["name"],
            "value": round(float(scaled_probs[index] * 100), 2),
            "class": CLASS_NAMES[index]
        }
        for index in top_indices
    ]

    return {
        "prediction": prediction_detail["name"],
        "confidence": round(float(scaled_probs[prediction_index] * 100), 2),
        "top3": top3,
        "heatmap_img": Image.fromarray(heatmap_overlay),
        "saliency_img": Image.fromarray(saliency_overlay),
        "prediction_code": prediction_code,
        "risk_level": prediction_detail["risk_label"],
        "risk_severity": prediction_detail["risk_severity"],
    }
