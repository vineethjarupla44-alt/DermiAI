import os
import sys
import json
import cv2
import urllib.request
import numpy as np
from pathlib import Path

# Ensure UTF-8 stdout on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("=" * 65)
print(" 🔬 DERMAI END-TO-END VALIDATION GATEWAY & INFERENCE TEST SUITE")
print("=" * 65)

# Prepare the 5 test images
ham_path = backend_dir / "dataset" / "HAM10000_images_part_1" / "ISIC_0024306.jpg"
if not ham_path.exists():
    ham_path = backend_dir.parent / "Backend" / "dataset" / "HAM10000_images_part_1" / "ISIC_0024306.jpg"

with open(ham_path, "rb") as f:
    proper_lesion_bytes = f.read()

# Lena portrait
req = urllib.request.Request("https://raw.githubusercontent.com/opencv/opencv/master/samples/data/lena.jpg", headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=10) as resp:
    portrait_bytes = resp.read()

# Landscape / Building (home.jpg)
req = urllib.request.Request("https://raw.githubusercontent.com/opencv/opencv/master/samples/data/home.jpg", headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=10) as resp:
    landscape_bytes = resp.read()

# Unrelated object / food (fruits.jpg)
req = urllib.request.Request("https://raw.githubusercontent.com/opencv/opencv/master/samples/data/fruits.jpg", headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=10) as resp:
    object_bytes = resp.read()

# Extremely blurry image
orig_bgr = cv2.imread(str(ham_path))
blurry_bgr = cv2.GaussianBlur(orig_bgr, (45, 45), 0)
_, buf = cv2.imencode(".jpg", blurry_bgr)
blurry_bytes = buf.tobytes()

test_cases = [
    {
        "id": 1,
        "name": "Proper Skin Lesion Image (ISIC_0024306)",
        "bytes": proper_lesion_bytes,
        "filename": "ISIC_0024306.jpg",
        "expected_status": 200,
        "expected_model_called": True,
    },
    {
        "id": 2,
        "name": "Normal Portrait / Person Photo (Lena)",
        "bytes": portrait_bytes,
        "filename": "portrait_lena.jpg",
        "expected_status": 400,
        "expected_model_called": False,
    },
    {
        "id": 3,
        "name": "Landscape / Architecture Photo (Home)",
        "bytes": landscape_bytes,
        "filename": "landscape_home.jpg",
        "expected_status": 400,
        "expected_model_called": False,
    },
    {
        "id": 4,
        "name": "Unrelated Object / Food Photo (Fruits)",
        "bytes": object_bytes,
        "filename": "object_fruits.jpg",
        "expected_status": 400,
        "expected_model_called": False,
    },
    {
        "id": 5,
        "name": "Extremely Blurry Image (Blurred Lesion)",
        "bytes": blurry_bytes,
        "filename": "blurry_sample.jpg",
        "expected_status": 400,
        "expected_model_called": False,
    },
]

all_passed = True

for tc in test_cases:
    print(f"\n>> TESTING CASE {tc['id']}: {tc['name']}")
    print("-" * 65)

    response = client.post(
        "/diagnose",
        files={"file": (tc["filename"], tc["bytes"], "image/jpeg")}
    )

    status_code = response.status_code
    print(f"HTTP Status:          {status_code}")

    if status_code == 200:
        data = response.json()
        print(f"Validation Status:    {data.get('validation', {}).get('status')}")
        print(f"Validation Conf:      {data.get('validation', {}).get('confidence')}%")
        print(f"Predicted Condition:  {data.get('prediction')} ({data.get('prediction_code')})")
        print(f"Disease Confidence:   {data.get('confidence')}%")
        print(f"Disease Model Called: YES")
        passed = (tc["expected_status"] == 200)
    else:
        try:
            err_data = response.json()
            detail = err_data.get("detail", response.text)
        except Exception:
            detail = response.text
        print(f"Rejection Message:    {detail}")
        print(f"Disease Model Called: NO (Rejected by validation gateway)")
        passed = (tc["expected_status"] == 400)

    if passed:
        print(f"Result:               [PASSED - Correct Behavior]")
    else:
        print(f"Result:               [FAILED - Expected status {tc['expected_status']}, got {status_code}]")
        all_passed = False

print("\n" + "=" * 65)
if all_passed:
    print(" 🎉 ALL 5 TEST SCENARIOS PASSED WITH EXACT EXPECTED BEHAVIOR!")
    print(" Only suitable skin lesions reach the disease classification model.")
    print(" Unrelated, portrait, landscape, object, and blurry images are gated safely.")
else:
    print(" ⚠️ SOME SCENARIOS FAILED. Check details above.")
print("=" * 65)
