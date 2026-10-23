import io
import sys
import cv2
import numpy as np
from PIL import Image
from dataclasses import dataclass, field
import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import MobileNetV2, decode_predictions, preprocess_input

if sys.platform == "win32":
    try:
        if sys.stdout and hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if sys.stderr and hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

@dataclass
class ValidationResult:
    is_suitable: bool
    confidence: float
    rejection_reason: str | None = None
    error_code: str | None = None
    details: dict = field(default_factory=dict)

# Global lazy-loaded semantic validator
_mobilenet_validator = None

def get_mobilenet_validator():
    global _mobilenet_validator
    if _mobilenet_validator is None:
        try:
            _mobilenet_validator = MobileNetV2(weights='imagenet')
            # Pre-warm with dummy tensor
            dummy = np.zeros((1, 224, 224, 3), dtype=np.float32)
            _mobilenet_validator.predict(dummy, verbose=0)
            print("🛡️ [ImageValidator] Semantic MobileNetV2 pre-warmed successfully.")
        except Exception as e:
            print(f"⚠️ [ImageValidator Warning] Could not initialize MobileNetV2: {e}")
    return _mobilenet_validator

# Haar cascades for human portrait, face, and body detection
_face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
_profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
_eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
_upper_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_upperbody.xml')
_fullbody_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_fullbody.xml')

# Pseudo-classes in ImageNet that legitimate dermoscopic skin lesions frequently map to
BENIGN_DERM_IMAGENET_CLASSES = {
    'tick', 'band_aid', 'face_powder', 'velvet', 'nail', 'potpie', 'petri_dish',
    'nematode', 'walking_stick', 'sunscreen', 'lacewing', 'harvestman', 'ant',
    'flea', 'mite', 'sponge', 'coral_fungus', 'earthstar', 'agaric', 'mushroom', 'pinhead'
}

# ImageNet non-skin keywords to flag for secondary candidate verification
REJECT_KEYWORDS = {
    'alp', 'cliff', 'valley', 'lakeside', 'seashore', 'mountain', 'sandbar', 'volcano', 'geyser', 'promontory', 'coral_reef',
    'dog', 'hound', 'terrier', 'retriever', 'spaniel', 'cat', 'tabby', 'persian', 'siamese', 'bird', 'parrot', 'horse',
    'elephant', 'bear', 'tiger', 'lion', 'cheetah', 'cow', 'ox', 'sheep', 'pig', 'rabbit',
    'sports_car', 'convertible', 'cab', 'minivan', 'truck', 'trailer', 'bicycle', 'aircraft', 'airliner', 'boat', 'bus', 'train', 'motorcycle', 'wheel',
    'pizza', 'cheeseburger', 'hotdog', 'espresso', 'bread', 'bagel', 'burger', 'sandwich', 'ice_cream', 'orange', 'banana', 'apple', 'lemon',
    'church', 'castle', 'palace', 'monastery', 'greenhouse', 'barn', 'library', 'bridge',
    'laptop', 'computer_keyboard', 'mouse', 'television', 'monitor', 'cellular_telephone', 'coffee_mug', 'cup', 'water_bottle', 'desk', 'sofa', 'chair',
    'suit', 'jersey', 'cardigan', 'coat', 'shoe', 'boot', 'sneaker', 'envelope', 'comic_book', 'web_site'
}

def validate_skin_lesion_image(image_bytes: bytes) -> ValidationResult:
    """
    Validates whether an uploaded image is suitable for dermatological skin lesion analysis.

    Pipeline:
    1. File integrity, corruption, and format decoding
    2. Minimum resolution & aspect ratio
    3. Lighting, exposure, and contrast quality
    4. Blur & sharpness quality (Laplacian variance)
    5. Human portrait, face, and body detection (OpenCV Haar cascades)
    6. Dermatological human skin presence (Dual YCrCb + HSV multi-ethnic segmentation)
    7. Localized lesion & abnormality contrast detection
    8. Semantic non-skin object & landscape filter (MobileNetV2 ImageNet classifier)
    9. Suitability confidence calculation and threshold gating

    Returns:
        ValidationResult(is_suitable, confidence, rejection_reason, error_code, details)
    """
    # ── 1. Image Decoding & Integrity Check ─────────────────────────────
    if not image_bytes or len(image_bytes) < 100:
        return ValidationResult(
            is_suitable=False,
            confidence=0.0,
            rejection_reason="The uploaded file is empty or corrupted. Please upload a valid image file.",
            error_code="CORRUPT_FILE"
        )

    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
        pil_img.verify()
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        return ValidationResult(
            is_suitable=False,
            confidence=0.0,
            rejection_reason="The uploaded file could not be read or is corrupted. Please upload a valid JPEG, PNG, or WEBP image.",
            error_code="CORRUPT_FILE"
        )

    rgb = np.array(pil_img)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    h, w = bgr.shape[:2]

    # ── 2. Resolution & Aspect Ratio Check ──────────────────────────────
    if w < 150 or h < 150:
        return ValidationResult(
            is_suitable=False,
            confidence=0.0,
            rejection_reason="Image resolution is too low. Please upload a clear photo of at least 200x200 pixels.",
            error_code="LOW_RESOLUTION",
            details={"width": w, "height": h}
        )

    aspect_ratio = max(w, h) / max(min(w, h), 1)
    if aspect_ratio > 4.5:
        return ValidationResult(
            is_suitable=False,
            confidence=0.0,
            rejection_reason="The image has an invalid or extreme aspect ratio. Please upload a standard photograph.",
            error_code="INVALID_ASPECT_RATIO",
            details={"aspect_ratio": round(aspect_ratio, 2)}
        )

    # ── 3. Lighting, Exposure & Contrast Quality Check ──────────────────
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    mean_brightness = float(np.mean(gray))
    std_contrast = float(np.std(gray))

    if mean_brightness < 28.0:
        return ValidationResult(
            is_suitable=False,
            confidence=0.05,
            rejection_reason="The image is too dark or underexposed. Please ensure the skin area is well-lit.",
            error_code="UNDEREXPOSED",
            details={"mean_brightness": round(mean_brightness, 2)}
        )

    if mean_brightness > 238.0 and std_contrast < 30.0:
        return ValidationResult(
            is_suitable=False,
            confidence=0.05,
            rejection_reason="The image is overexposed or too bright. Please upload a clear photo without strong glare.",
            error_code="OVEREXPOSED",
            details={"mean_brightness": round(mean_brightness, 2), "contrast": round(std_contrast, 2)}
        )

    if std_contrast < 12.0:
        return ValidationResult(
            is_suitable=False,
            confidence=0.05,
            rejection_reason="The image lacks visual detail or contrast. Please upload a clear photograph of the lesion.",
            error_code="LOW_CONTRAST",
            details={"contrast": round(std_contrast, 2)}
        )

    # ── 4. Blur & Sharpness Quality Check ───────────────────────────────
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if lap_var < 15.0:
        return ValidationResult(
            is_suitable=False,
            confidence=0.10,
            rejection_reason="The image is too blurry for reliable dermatological analysis. Please hold the camera steady and focus on the lesion.",
            error_code="BLURRY",
            details={"sharpness": round(lap_var, 2)}
        )

    # ── 5. Human Portrait, Face & Body Rejection ────────────────────────
    faces = _face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    if len(faces) == 0:
        faces = _profile_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))

    if len(faces) >= 2:
        return ValidationResult(
            is_suitable=False,
            confidence=0.05,
            rejection_reason="Multiple faces or people were detected in this image. Please upload a close-up image of a single skin lesion.",
            error_code="GROUP_PHOTO_DETECTED",
            details={"face_count": len(faces)}
        )

    if len(faces) == 1:
        fx, fy, fw, fh = faces[0]
        face_area_ratio = (fw * fh) / (w * h)
        if face_area_ratio > 0.05:
            face_roi = gray[fy:fy+fh, fx:fx+fw]
            eyes = _eye_cascade.detectMultiScale(face_roi, scaleFactor=1.1, minNeighbors=3)
            if len(eyes) >= 1 or face_area_ratio > 0.12:
                return ValidationResult(
                    is_suitable=False,
                    confidence=0.05,
                    rejection_reason="A portrait or face photograph was detected. Please upload a close-up image focusing directly on the affected skin lesion, not a full portrait.",
                    error_code="PORTRAIT_DETECTED",
                    details={"face_area_ratio": round(face_area_ratio, 3), "eyes_detected": len(eyes)}
                )

    bodies = _upper_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(100, 100))
    if len(bodies) > 0:
        return ValidationResult(
            is_suitable=False,
            confidence=0.05,
            rejection_reason="A person or body photograph was detected. Please zoom in and take a close-up photo of only the skin lesion.",
            error_code="BODY_DETECTED",
            details={"body_count": len(bodies)}
        )

    # ── 6. Dermatological Skin Presence (Multi-Ethnic Color Segmentation) ──
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    Cr = ycrcb[:, :, 1]
    Cb = ycrcb[:, :, 2]
    skin_ycrcb = (Cb >= 77) & (Cb <= 130) & (Cr >= 132) & (Cr <= 175)

    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    H = hsv[:, :, 0]
    S = hsv[:, :, 1]
    V = hsv[:, :, 2]
    skin_hsv = ((H <= 25) | (H >= 165)) & (S >= 20) & (S <= 200) & (V >= 40)

    R = rgb[:, :, 0]
    G = rgb[:, :, 1]
    B = rgb[:, :, 2]
    skin_rgb = (R > G) & (R > B) & ((R - G) >= 8) & (R >= 50)

    skin_mask = (skin_ycrcb & skin_hsv) | (skin_ycrcb & skin_rgb)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    skin_mask = cv2.morphologyEx(skin_mask.astype(np.uint8), cv2.MORPH_OPEN, kernel)
    skin_ratio = float(np.mean(skin_mask))

    if skin_ratio < 0.25:
        return ValidationResult(
            is_suitable=False,
            confidence=round(skin_ratio, 3),
            rejection_reason="This image does not appear suitable for skin analysis. No significant human skin region was detected. Please upload a clear close-up image of a skin lesion.",
            error_code="NON_SKIN_CONTENT",
            details={"skin_ratio": round(skin_ratio, 3)}
        )

    # ── 7. Localized Lesion / Abnormality Contrast Detection ────────────
    skin_pixels = gray[skin_mask > 0]
    skin_std = float(np.std(skin_pixels)) if len(skin_pixels) > 0 else 0.0

    if skin_std < 8.0:
        return ValidationResult(
            is_suitable=False,
            confidence=0.20,
            rejection_reason="No identifiable skin lesion, mole, or abnormality was detected on the skin. Please ensure the lesion is centered, focused, and clearly visible.",
            error_code="NO_LESION_DETECTED",
            details={"skin_contrast": round(skin_std, 2)}
        )

    # ── 8. Semantic Non-Skin Object / Landscape Filter (MobileNetV2) ────
    mobilenet = get_mobilenet_validator()
    if mobilenet is not None:
        try:
            resized_rgb = cv2.resize(rgb, (224, 224), interpolation=cv2.INTER_AREA)
            x_in = preprocess_input(np.expand_dims(resized_rgb.astype(np.float32), 0))
            preds = mobilenet.predict(x_in, verbose=0)
            top_preds = decode_predictions(preds, top=3)[0]

            top1_label = top_preds[0][1].lower().replace('_', ' ')
            top1_prob = float(top_preds[0][2])

            # If top1 is a recognized real-world object/scene with >=25% confidence
            if top1_prob >= 0.25 and not any(ok in top1_label for ok in BENIGN_DERM_IMAGENET_CLASSES):
                return ValidationResult(
                    is_suitable=False,
                    confidence=round(1.0 - top1_prob, 2),
                    rejection_reason=f"This image does not appear suitable for skin analysis (detected {top1_label}). Please upload a clear close-up image of a skin lesion.",
                    error_code="OBJECT_DETECTED",
                    details={"detected_object": top1_label, "object_confidence": round(top1_prob, 2)}
                )

            for _, label, prob in top_preds[1:]:
                prob = float(prob)
                clean_label = label.lower().replace('_', ' ')
                if prob > 0.35 and any(kw in clean_label for kw in REJECT_KEYWORDS):
                    return ValidationResult(
                        is_suitable=False,
                        confidence=round(1.0 - prob, 2),
                        rejection_reason=f"This image does not appear suitable for skin analysis (detected {clean_label}). Please upload a clear close-up image of a skin lesion.",
                        error_code="OBJECT_DETECTED",
                        details={"detected_object": clean_label, "object_confidence": round(prob, 2)}
                    )
        except Exception as e:
            print(f"⚠️ [ImageValidator Warning] Semantic check skipped: {e}")

    # ── 9. Compute Overall Suitability Confidence & Threshold Gating ─────
    base_confidence = 0.50
    skin_score = min(skin_ratio / 0.70, 1.0) * 0.35
    sharpness_score = min(lap_var / 80.0, 1.0) * 0.15
    contrast_penalty = 0.10 if skin_std < 12.0 else 0.0

    final_confidence = np.clip(base_confidence + skin_score + sharpness_score - contrast_penalty, 0.0, 1.0)
    final_confidence = round(float(final_confidence), 2)

    CONFIDENCE_THRESHOLD = 0.60
    if final_confidence < CONFIDENCE_THRESHOLD:
        return ValidationResult(
            is_suitable=False,
            confidence=final_confidence,
            rejection_reason="This image does not appear suitable for skin analysis. Please upload a clear close-up image of a skin lesion.",
            error_code="LOW_CONFIDENCE",
            details={"confidence": final_confidence, "skin_ratio": round(skin_ratio, 3)}
        )

    return ValidationResult(
        is_suitable=True,
        confidence=final_confidence,
        rejection_reason=None,
        error_code=None,
        details={
            "skin_ratio": round(skin_ratio, 3),
            "sharpness": round(lap_var, 2),
            "brightness": round(mean_brightness, 2),
            "contrast": round(std_contrast, 2)
        }
    )
