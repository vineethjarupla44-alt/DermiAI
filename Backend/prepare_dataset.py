import os
import shutil
import pandas as pd
from sklearn.model_selection import train_test_split

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")
METADATA = os.path.join(DATASET_DIR, "HAM10000_metadata.csv")

TRAIN_DIR = os.path.join(DATASET_DIR, "train")
VAL_DIR = os.path.join(DATASET_DIR, "val")

CLASSES = ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"]

# Create train/val/class folders
for split_dir in [TRAIN_DIR, VAL_DIR]:
    for cls in CLASSES:
        os.makedirs(os.path.join(split_dir, cls), exist_ok=True)

print("Reading metadata...")
df = pd.read_csv(METADATA)

# Find all image files inside dataset recursively
image_files = {}

for root, dirs, files in os.walk(DATASET_DIR):
    for file in files:
        if file.lower().endswith((".jpg", ".jpeg", ".png")):
            image_id = os.path.splitext(file)[0]
            image_files[image_id] = os.path.join(root, file)

print(f"Found {len(image_files)} image files.")

# Keep only images that exist
df["path"] = df["image_id"].map(image_files)
df = df.dropna(subset=["path"])

print(f"Images matched with metadata: {len(df)}")

# Split 80% train / 20% validation
train_df, val_df = train_test_split(
    df,
    test_size=0.20,
    random_state=42,
    stratify=df["dx"]
)

print(f"Training images: {len(train_df)}")
print(f"Validation images: {len(val_df)}")

def copy_images(dataframe, destination):
    for _, row in dataframe.iterrows():
        src = row["path"]
        label = row["dx"]
        filename = os.path.basename(src)

        dst = os.path.join(destination, label, filename)

        if not os.path.exists(dst):
            shutil.copy2(src, dst)

print("\nCopying training images...")
copy_images(train_df, TRAIN_DIR)

print("Copying validation images...")
copy_images(val_df, VAL_DIR)

print("\nDataset preparation completed successfully!")

for cls in CLASSES:
    train_count = len(os.listdir(os.path.join(TRAIN_DIR, cls)))
    val_count = len(os.listdir(os.path.join(VAL_DIR, cls)))

    print(f"{cls}: train={train_count}, val={val_count}")