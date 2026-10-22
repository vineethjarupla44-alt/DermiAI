import os
import glob
import pandas as pd
import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from tensorflow.keras.utils import to_categorical
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_class_weight

# 1. Define Paths and Configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
POSSIBLE_DATASET_DIRS = [
    os.path.join(SCRIPT_DIR, "..", "Backend", "dataset"),
    os.path.join(SCRIPT_DIR, "dataset"),
    os.path.join(os.getcwd(), "Backend", "dataset"),
    os.path.join(os.getcwd(), "dataset"),
    os.getcwd(),
]

DATASET_DIR = "."
for d in POSSIBLE_DATASET_DIRS:
    if os.path.exists(os.path.join(d, "HAM10000_metadata.csv")):
        DATASET_DIR = os.path.abspath(d)
        break

METADATA_PATH = os.path.join(DATASET_DIR, "HAM10000_metadata.csv")
FOLDER_1 = os.path.join(DATASET_DIR, "HAM10000_images_part_1")
FOLDER_2 = os.path.join(DATASET_DIR, "HAM10000_images_part_2")

IMG_SIZE = (224, 224)
BATCH_SIZE = 32

print(f"Dataset root directory: {DATASET_DIR}")
print("Mapping image paths...")

# 2. Map Image IDs to Their Actual File Paths
image_path_mapping = {}
for folder in [FOLDER_1, FOLDER_2]:
    for path in glob.glob(os.path.join(folder, "*.jpg")):
        image_id = os.path.splitext(os.path.basename(path))[0]
        image_path_mapping[image_id] = path

# 3. Load Metadata and Filter Valid Images
df = pd.read_csv(METADATA_PATH)
df['image_path'] = df['image_id'].map(image_path_mapping)
df = df.dropna(subset=['image_path']).reset_index(drop=True)
total_valid_images = len(df)
print(f"Total valid images found: {total_valid_images} / 10,015")

# 4. Encode Labels (dx column)
label_encoder = LabelEncoder()
df['label_idx'] = label_encoder.fit_transform(df['dx'])
num_classes = len(label_encoder.classes_)
class_names = list(label_encoder.classes_)
print(f"Classes found ({num_classes}): {class_names}")

print("Class distribution:")
for cls_name, count in df['dx'].value_counts().items():
    print(f"  - {cls_name}: {count}")

# 5. Train-Test Split (80% Train, 20% Test) on File Paths & Labels (RAM Usage < 2 MB)
train_df, test_df = train_test_split(
    df, test_size=0.2, random_state=42, stratify=df['label_idx']
)

train_paths = train_df['image_path'].values
test_paths = test_df['image_path'].values

train_labels_idx = train_df['label_idx'].values
test_labels_idx = test_df['label_idx'].values

train_labels_onehot = to_categorical(train_labels_idx, num_classes=num_classes).astype(np.float32)
test_labels_onehot = to_categorical(test_labels_idx, num_classes=num_classes).astype(np.float32)

print(f"\nTrain/Test splits created without loading images into RAM:")
print(f"  - Train samples: {len(train_paths)} (80.0%)")
print(f"  - Test samples:  {len(test_paths)} (20.0%)")

# 6. Compute Balanced Class Weights
train_class_weights = compute_class_weight(
    class_weight='balanced',
    classes=np.unique(train_labels_idx),
    y=train_labels_idx
)
class_weight_dict = dict(enumerate(train_class_weights))
print(f"\nComputed balanced class weights:")
for idx, cls_name in enumerate(class_names):
    print(f"  - [{idx}] {cls_name}: {class_weight_dict[idx]:.4f}")

# 7. TensorFlow Image Loader & Preprocessor (On-the-fly streaming)
def parse_and_preprocess_image(file_path, label):
    """Loads a single JPEG from disk and normalizes it to [0, 1] on the fly."""
    img_bytes = tf.io.read_file(file_path)
    img = tf.io.decode_jpeg(img_bytes, channels=3)
    img = tf.image.resize(img, IMG_SIZE, method="area")
    img = tf.cast(img, tf.float32) / 255.0
    return img, label

# 8. Memory-Efficient Dataset Pipeline Generator
def create_dataset(paths, labels, batch_size=BATCH_SIZE, is_training=True):
    """Builds a memory-efficient streaming tf.data.Dataset pipeline."""
    dataset = tf.data.Dataset.from_tensor_slices((paths, labels))
    if is_training:
        dataset = dataset.shuffle(buffer_size=1024, seed=42)
    dataset = dataset.map(parse_and_preprocess_image, num_parallel_calls=tf.data.AUTOTUNE)
    dataset = dataset.batch(batch_size)
    dataset = dataset.prefetch(buffer_size=tf.data.AUTOTUNE)
    return dataset

# Instantiate standard train and val streaming datasets
train_dataset = create_dataset(train_paths, train_labels_onehot, batch_size=BATCH_SIZE, is_training=True)
val_dataset = create_dataset(test_paths, test_labels_onehot, batch_size=BATCH_SIZE, is_training=False)

print("\n" + "="*60)
print(" MEMORY-EFFICIENT PIPELINE READY (tf.data.Dataset)")
print("="*60)
print(f"Pipeline:      On-the-fly streaming (Zero 15GB RAM allocations)")
print(f"Image Size:    {IMG_SIZE} (RGB 3-channel)")
print(f"Batch Size:    {BATCH_SIZE}")
print(f"Train Batches: {len(train_paths) // BATCH_SIZE + (1 if len(train_paths) % BATCH_SIZE else 0)}")
print(f"Val Batches:   {len(test_paths) // BATCH_SIZE + (1 if len(test_paths) % BATCH_SIZE else 0)}")
print("="*60 + "\n")