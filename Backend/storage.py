from __future__ import annotations

import io
import os
import uuid
import base64
from pathlib import Path

import cloudinary
import cloudinary.uploader
import numpy as np
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
api_key = os.getenv("CLOUDINARY_API_KEY", "").strip()
api_secret = os.getenv("CLOUDINARY_API_SECRET", "").strip()

is_cloudinary_configured = (
    bool(cloud_name and api_key and api_secret)
    and cloud_name != "your_cloud_name"
    and api_key != "your_api_key"
)

if is_cloudinary_configured:
    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
    )
    print("☁️ Cloudinary configured for cloud storage.")
else:
    print("💾 Cloudinary credentials not configured. Using resilient local static file storage.")


def _ensure_local_dir(subfolder: str) -> Path:
    target_dir = STATIC_DIR / subfolder
    target_dir.mkdir(parents=True, exist_ok=True)
    return target_dir


def _upload_to_cloudinary(image_bytes: bytes, folder: str, filename: str) -> str:
    """Uploads an image to Cloudinary and returns the secure URL."""
    try:
        response = cloudinary.uploader.upload(
            image_bytes,
            folder=folder,
            public_id=filename,
            overwrite=True,
            resource_type="image"
        )
        return response.get("secure_url")
    except Exception as e:
        print(f"⚠️ Cloudinary upload failed ({e}). Falling back to local disk storage.")
        raise


def save_upload(image_bytes: bytes, filename: str | None = None) -> tuple[str, str]:
    """Saves original uploaded image to Cloudinary or local static/uploads/."""
    safe_name = filename or f"{uuid.uuid4().hex}"
    stem = Path(safe_name).stem

    upload_dir = _ensure_local_dir("uploads")
    local_path = upload_dir / f"{stem}.jpg"
    with open(local_path, "wb") as f:
        f.write(image_bytes)

    return stem, f"/static/uploads/{stem}.jpg"


def save_array_image(image_np: np.ndarray, stem: str, folder: str = "outputs") -> tuple[str, str]:
    """Saves a generated heatmap or saliency map to Cloudinary or local static folder."""
    local_subfolder = "saliency" if folder == "saliency" else "outputs"
    dest_dir = _ensure_local_dir(local_subfolder)
    local_path = dest_dir / f"{stem}.jpg"

    # Fast direct C++ OpenCV write (5ms vs 90ms PIL buffer roundtrip)
    import cv2
    bgr = cv2.cvtColor(image_np.astype("uint8"), cv2.COLOR_RGB2BGR)
    cv2.imwrite(str(local_path), bgr, [cv2.IMWRITE_JPEG_QUALITY, 90])

    if is_cloudinary_configured:
        try:
            cloud_folder = "dermai/saliency" if folder == "saliency" else "dermai/heatmaps"
            with open(local_path, "rb") as f:
                img_b = f.read()
            url = _upload_to_cloudinary(img_b, cloud_folder, stem)
            return stem, url
        except Exception:
            pass  # Fall through to local storage

    return stem, f"/static/{local_subfolder}/{stem}.jpg"


def delete_from_cloudinary(url: str):
    """Deletes an image from Cloudinary or local storage based on its URL."""
    if not url:
        return

    # 1. Local static file deletion
    if url.startswith("/static/"):
        try:
            rel_path = url[len("/static/"):]
            target_file = STATIC_DIR / rel_path
            if target_file.exists():
                target_file.unlink()
                print(f"🗑️ Deleted local static file: {target_file}")
        except Exception as e:
            print(f"⚠️ Failed to delete local static file: {e}")
        return

    # 2. Cloudinary deletion
    if "cloudinary.com" in url:
        try:
            parts = url.split("/")
            upload_idx = parts.index("upload")
            version_idx = upload_idx + 1
            if parts[version_idx].startswith("v") and parts[version_idx][1:].isdigit():
                start_idx = version_idx + 1
            else:
                start_idx = version_idx

            public_id_with_ext = "/".join(parts[start_idx:])
            public_id = os.path.splitext(public_id_with_ext)[0]

            print(f"🗑️ Deleting from Cloudinary: {public_id}")
            cloudinary.uploader.destroy(public_id)
        except Exception as e:
            print(f"❌ Failed to delete from Cloudinary: {e}")


def image_to_base64(image_np: np.ndarray) -> str:
    """Converts a numpy image array to a Base64 data URL."""
    image = Image.fromarray(image_np.astype("uint8"))
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=85)
    base64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{base64_str}"


def bytes_to_base64(image_bytes: bytes) -> str:
    """Converts image bytes to a Base64 data URL."""
    base64_str = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:image/jpeg;base64,{base64_str}"
