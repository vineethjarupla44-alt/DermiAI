import io
import sys
import cv2
import numpy as np
from PIL import Image, ImageOps
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

# Pseudo-classes in ImageNet that legitimate dermoscopic skin lesions frequently map to
BENIGN_DERM_IMAGENET_CLASSES = {
    'tick', 'band_aid', 'face_powder', 'velvet', 'petri_dish',
    'nematode', 'walking_stick', 'sunscreen', 'lacewing', 'harvestman', 'ant',
    'flea', 'mite', 'sponge', 'coral_fungus', 'earthstar', 'agaric', 'mushroom', 'pinhead',
    'bubble', 'nipple', 'spot', 'strawberry', 'pomegranate', 'measles', 'safety_pin'
}

# ImageNet non-skin categories and keywords for comprehensive multi-category rejection
NON_SKIN_CATEGORIES = {
    "pen / writing stationery": [
        'ballpoint', 'fountain_pen', 'pencil_box', 'pencil_sharpener', 'quill',
        'ruler', 'rule', 'pencil', 'pen', 'letter_opener', 'rubber_eraser'
    ],
    "phone / electronic device": [
        'cellular_telephone', 'dial_telephone', 'telephone', 'hand-held_computer', 'ipod',
        'laptop', 'notebook', 'desktop_computer', 'computer_keyboard', 'mouse', 'monitor',
        'television', 'screen', 'modem', 'hard_disc', 'remote_control', 'loudspeaker',
        'microphone', 'tape_player', 'radio', 'cassette', 'switch', 'cd_player'
    ],
    "furniture / table / surface": [
        'desk', 'dining_table', 'table_lamp', 'pool_table', 'chair', 'rocking_chair',
        'folding_chair', 'sofa', 'wardrobe', 'bookcase', 'bed', 'chiffonier'
    ],
    "tool / hardware": [
        'screwdriver', 'hammer', 'wrench', 'pliers', 'nail', 'screw', 'paintbrush', 'chisel',
        'axe', 'handsaw', 'power_drill', 'shovel', 'plow', 'chain', 'padlock', 'spindle', 'reel'
    ],
    "vehicle": [
        'sports_car', 'convertible', 'cab', 'minivan', 'truck', 'trailer', 'bicycle',
        'aircraft', 'airliner', 'boat', 'bus', 'train', 'motorcycle', 'wheel', 'canoe',
        'fireboat', 'speedboat', 'submarine', 'tractor', 'passenger_car', 'jeep', 'limousine'
    ],
    "building / outdoor landscape": [
        'church', 'castle', 'palace', 'monastery', 'library', 'barn', 'greenhouse', 'bridge',
        'suspension_bridge', 'steel_arch_bridge', 'viaduct', 'beacon', 'bell_cote', 'dam',
        'dock', 'pier', 'water_tower', 'vault', 'triumphal_arch', 'tile_roof', 'shoji',
        'mosque', 'pagoda', 'planetarium', 'alp', 'cliff', 'valley', 'promontory', 'seashore',
        'sandbar', 'volcano', 'geyser', 'lakeside', 'coral_reef'
    ],
    "document / printed media": [
        'web_site', 'envelope', 'menu', 'comic_book', 'book_jacket', 'packet', 'carton', 'binder'
    ],
    "household / clothing": [
        'cup', 'coffee_mug', 'mug', 'plate', 'bowl', 'fork', 'spoon', 'knife', 'bottle',
        'water_bottle', 'wine_bottle', 'beer_bottle', 'suit', 'jersey', 'cardigan', 'coat',
        'shoe', 'boot', 'sneaker', 'sock', 'sandal', 'jean', 'trench_coat', 'tie', 'bow_tie',
        'sunglasses', 'spectacles', 'sunglass', 'watch', 'digital_watch', 'analog_clock',
        'wall_clock', 'backpack', 'wallet', 'purse', 'umbrella', 'window_shade', 'tennis_ball',
        'balloon', 'pizza', 'cheeseburger', 'hotdog', 'espresso', 'bread', 'bagel', 'burger',
        'sandwich', 'ice_cream', 'orange', 'banana', 'apple', 'lemon'
    ],
    "animal": [
        'dog', 'terrier', 'retriever', 'hound', 'spaniel', 'shepherd', 'bulldog', 'cat',
        'tabby', 'persian', 'siamese', 'bird', 'parrot', 'eagle', 'vulture', 'owl',
        'horse', 'cow', 'ox', 'sheep', 'pig', 'rabbit', 'elephant', 'bear', 'tiger',
        'lion', 'cheetah', 'wolf', 'fox', 'monkey', 'gorilla', 'chimpanzee', 'zebra',
        'giraffe', 'camel', 'kangaroo', 'fish', 'shark', 'whale', 'dolphin', 'frog', 'toad', 'snake'
    ]
}

def validate_skin_lesion_image(image_bytes: bytes) -> ValidationResult:
    """
    Validates whether an uploaded image is suitable for dermatological skin lesion analysis.

    Pipeline:
    1. File integrity, corruption, and format decoding (Pillow & EXIF auto-orientation)
    2. Resolution & aspect ratio check (accommodates 265x148, landscape, and portrait crops >=25,000 px)
    3. Lighting, exposure, and contrast quality
    4. Blur & sharpness quality (resolution-invariant Laplacian variance)
    5. Human portrait, face, and body rejection (OpenCV Haar cascades)
    6. Multi-ethnic skin presence & erythematous/red spot detection (YCrCb + HSV + RGB)
    7. Semantic non-skin object & landscape filter (MobileNetV2 ImageNet classifier)
    8. Suitability confidence calculation and threshold gating

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
        stream = io.BytesIO(image_bytes)
        pil_img = Image.open(stream)
        pil_img.load()
        pil_img = ImageOps.exif_transpose(pil_img)
        pil_img = pil_img.convert("RGB")
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
    # Avoid unnecessarily rejecting valid close-up skin photographs because of aspect ratio.
    # Supports real crops like 265x148 (39,220 px) and 200x200 (40,000 px).
    # Rejects genuinely low-resolution images (<25,000 px like 100x100 or 120x120).
    total_pixels = w * h
    if max(w, h) < 180 or min(w, h) < 100 or total_pixels < 25000:
        return ValidationResult(
            is_suitable=False,
            confidence=0.0,
            rejection_reason="Image resolution is too low. Please upload a clear photo of at least 25,000 pixels (e.g. 200×200 or 265×148).",
            error_code="LOW_RESOLUTION",
            details={"width": w, "height": h, "total_pixels": total_pixels}
        )

    aspect_ratio = max(w, h) / max(min(w, h), 1)
    if aspect_ratio > 4.0:
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

    if mean_brightness < 20.0:
        return ValidationResult(
            is_suitable=False,
            confidence=0.05,
            rejection_reason="The image is too dark or underexposed. Please ensure the skin area is well-lit.",
            error_code="UNDEREXPOSED",
            details={"mean_brightness": round(mean_brightness, 2)}
        )

    if mean_brightness > 245.0 and std_contrast < 20.0:
        return ValidationResult(
            is_suitable=False,
            confidence=0.05,
            rejection_reason="The image is overexposed or too bright. Please upload a clear photo without strong glare.",
            error_code="OVEREXPOSED",
            details={"mean_brightness": round(mean_brightness, 2), "contrast": round(std_contrast, 2)}
        )

    if std_contrast < 8.0:
        return ValidationResult(
            is_suitable=False,
            confidence=0.05,
            rejection_reason="The image lacks visual detail or contrast. Please upload a clear photograph of the lesion.",
            error_code="LOW_CONTRAST",
            details={"contrast": round(std_contrast, 2)}
        )

    # ── 4. Blur & Sharpness Quality Check (Resolution-Invariant) ────────
    max_dim = max(w, h)
    if max_dim > 600:
        scale = 500.0 / max_dim
        blur_gray = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    else:
        blur_gray = gray
    lap_var = float(cv2.Laplacian(blur_gray, cv2.CV_64F).var())
    if lap_var < 8.0:
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
        if face_area_ratio > 0.08:
            face_roi = gray[fy:fy+fh, fx:fx+fw]
            eyes = _eye_cascade.detectMultiScale(face_roi, scaleFactor=1.1, minNeighbors=3)
            if len(eyes) >= 1 or face_area_ratio > 0.15:
                return ValidationResult(
                    is_suitable=False,
                    confidence=0.05,
                    rejection_reason="A portrait or face photograph was detected. Please upload a close-up image focusing directly on the affected skin lesion, not a full portrait.",
                    error_code="PORTRAIT_DETECTED",
                    details={"face_area_ratio": round(face_area_ratio, 3), "eyes_detected": len(eyes)}
                )

    bodies = _upper_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(100, 100))
    if len(bodies) > 0:
        bx, by, bw, bh = bodies[0]
        body_area_ratio = (bw * bh) / (w * h)
        if body_area_ratio > 0.15:
            return ValidationResult(
                is_suitable=False,
                confidence=0.05,
                rejection_reason="A person or body photograph was detected. Please zoom in and take a close-up photo of only the skin lesion.",
                error_code="BODY_DETECTED",
                details={"body_count": len(bodies)}
            )

    # ── 6. Dermatological Skin Presence (Multi-Ethnic & Erythematous/Lesion Detection) ──
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    Y, Cr, Cb = ycrcb[:, :, 0], ycrcb[:, :, 1], ycrcb[:, :, 2]

    # Multi-space color rules:
    # 1. Standard skin chromaticity
    mask_ycrcb_std = (Cb >= 70) & (Cb <= 140) & (Cr >= 128) & (Cr <= 185)
    # 2. Inflamed skin / reddish spots / vascular lesions (elevated red chroma)
    mask_ycrcb_red = (Cb >= 65) & (Cb <= 145) & (Cr > 160) & (Cr <= 220)
    # 3. Deeply pigmented / dark skin (lower luminance Y)
    mask_ycrcb_dark = (Cb >= 75) & (Cb <= 140) & (Cr >= 125) & (Cr <= 175) & (Y < 125)
    mask_ycrcb = mask_ycrcb_std | mask_ycrcb_red | mask_ycrcb_dark

    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    H, S, V = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    # Hue in red, orange, yellow spectrum; tolerate high saturation in inflamed/reddish spots
    mask_hsv = ((H <= 35) | (H >= 155)) & (S >= 15) & (S <= 245) & (V >= 25)

    R, G, B = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    # Human skin is dominated by blood/melanin so R is generally highest component
    mask_rgb = (R >= G) & (R >= B) & (R >= 35) & ((R.astype(int) - G.astype(int)) >= 2)

    # Combined skin mask (any two agreeing color spaces or strong YCrCb)
    skin_mask = (mask_ycrcb & mask_hsv) | (mask_ycrcb & mask_rgb) | (mask_rgb & mask_hsv)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    skin_mask = cv2.morphologyEx(skin_mask.astype(np.uint8), cv2.MORPH_OPEN, kernel)
    skin_ratio = float(np.mean(skin_mask))

    if skin_ratio < 0.15:
        return ValidationResult(
            is_suitable=False,
            confidence=round(skin_ratio, 3),
            rejection_reason="This image does not appear suitable for skin analysis. No significant human skin region was detected. Please upload a clear close-up photograph of the affected skin area.",
            error_code="NON_SKIN_IMAGE",
            details={"skin_ratio": round(skin_ratio, 3)}
        )

    # ── 7. Semantic Non-Skin Object / Landscape Filter (MobileNetV2) ────
    # Definitively filters out non-skin objects (pens, phones, laptops, tools, cars, animals, buildings, documents)
    mobilenet = get_mobilenet_validator()
    if mobilenet is not None:
        try:
            resized_rgb = cv2.resize(rgb, (224, 224), interpolation=cv2.INTER_AREA)
            x_in = preprocess_input(np.expand_dims(resized_rgb.astype(np.float32), 0))
            preds = mobilenet.predict(x_in, verbose=0)
            top_preds = decode_predictions(preds, top=5)[0]

            top1_label = top_preds[0][1].lower()
            top1_prob = float(top_preds[0][2])

            # If top prediction is a recognized dermatological texture pseudo-class with >= 20% confidence
            is_derm_texture = top1_label in BENIGN_DERM_IMAGENET_CLASSES and top1_prob >= 0.20

            if not is_derm_texture:
                non_skin_matches = []
                total_non_skin_prob = 0.0

                for _, raw_label, p in top_preds:
                    prob = float(p)
                    lbl = raw_label.lower()
                    if lbl in BENIGN_DERM_IMAGENET_CLASSES:
                        continue
                    for cat_name, keywords in NON_SKIN_CATEGORIES.items():
                        if any(kw in lbl for kw in keywords):
                            clean_name = lbl.replace('_', ' ')
                            non_skin_matches.append((cat_name, clean_name, prob))
                            total_non_skin_prob += prob
                            break

                # Priority 1: Direct stationery/pen, electronics/phones/laptops, or tools detection (prob >= 0.14)
                priority_cats = {"pen / writing stationery", "phone / electronic device", "tool / hardware"}
                for cat, obj, pr in non_skin_matches:
                    if cat in priority_cats and pr >= 0.14:
                        return ValidationResult(
                            is_suitable=False,
                            confidence=round(1.0 - pr, 2),
                            rejection_reason=f"This image does not appear suitable for skin analysis (detected {obj} / {cat}). Please upload a clear close-up photograph of the affected skin area.",
                            error_code="NON_SKIN_IMAGE",
                            details={"detected_category": cat, "detected_object": obj, "confidence": round(pr, 2)}
                        )

                # Priority 2: Top-1 is any non-skin category with prob >= 0.25
                if non_skin_matches and non_skin_matches[0][1] == top1_label.replace('_', ' ') and top1_prob >= 0.25:
                    cat, obj, pr = non_skin_matches[0]
                    return ValidationResult(
                        is_suitable=False,
                        confidence=round(1.0 - top1_prob, 2),
                        rejection_reason=f"This image does not appear suitable for skin analysis (detected {obj} / {cat} with {pr*100:.1f}% confidence). Please upload a clear close-up photograph of the affected skin area.",
                        error_code="NON_SKIN_IMAGE",
                        details={"detected_category": cat, "detected_object": obj, "confidence": round(pr, 2)}
                    )

                # Priority 3: Cumulative non-skin probability >= 0.40
                if total_non_skin_prob >= 0.40 and non_skin_matches:
                    cat, obj, pr = non_skin_matches[0]
                    return ValidationResult(
                        is_suitable=False,
                        confidence=round(1.0 - total_non_skin_prob, 2),
                        rejection_reason=f"This image does not appear suitable for skin analysis (detected {obj} / {cat}). Please upload a clear close-up photograph of the affected skin area.",
                        error_code="NON_SKIN_IMAGE",
                        details={"detected_category": cat, "detected_object": obj, "total_non_skin_confidence": round(total_non_skin_prob, 2)}
                    )
        except Exception as e:
            print(f"⚠️ [ImageValidator Warning] Semantic check skipped: {e}")

    # ── 8. Compute Overall Suitability Confidence ────────────────────────
    base_confidence = 0.65
    skin_score = min(skin_ratio / 0.50, 1.0) * 0.25
    sharpness_score = min(lap_var / 50.0, 1.0) * 0.10
    final_confidence = round(float(np.clip(base_confidence + skin_score + sharpness_score, 0.60, 0.98)), 2)

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
