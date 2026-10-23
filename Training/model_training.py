import os
import sys
import json
import time
import ctypes
from ctypes import wintypes
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.applications import EfficientNetV2B0

def get_peak_ram_mb():
    try:
        class PROCESS_MEMORY_COUNTERS_EX(ctypes.Structure):
            _fields_ = [
                ('cb', wintypes.DWORD), ('PageFaultCount', wintypes.DWORD),
                ('PeakWorkingSetSize', ctypes.c_size_t), ('WorkingSetSize', ctypes.c_size_t),
                ('QuotaPeakPagedPoolUsage', ctypes.c_size_t), ('QuotaPagedPoolUsage', ctypes.c_size_t),
                ('QuotaPeakNonPagedPoolUsage', ctypes.c_size_t), ('QuotaNonPagedPoolUsage', ctypes.c_size_t),
                ('PagefileUsage', ctypes.c_size_t), ('PeakPagefileUsage', ctypes.c_size_t),
                ('PrivateUsage', ctypes.c_size_t),
            ]
        psapi = ctypes.windll.psapi
        psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(PROCESS_MEMORY_COUNTERS_EX), wintypes.DWORD]
        psapi.GetProcessMemoryInfo.restype = wintypes.BOOL
        pmc = PROCESS_MEMORY_COUNTERS_EX()
        pmc.cb = ctypes.sizeof(PROCESS_MEMORY_COUNTERS_EX)
        handle = ctypes.windll.kernel32.GetCurrentProcess()
        if psapi.GetProcessMemoryInfo(handle, ctypes.byref(pmc), pmc.cb):
            return round(pmc.PeakWorkingSetSize / (1024 * 1024), 2)
    except Exception:
        pass
    return None

# Ensure real-time line buffering on Windows terminal output
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
    except Exception:
        pass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# 1. Load Preprocessed Streaming Datasets
try:
    from data_preprocessing import (
        train_dataset, val_dataset,
        train_paths, test_paths,
        class_weight_dict, num_classes,
        label_encoder, class_names,
        IMG_SIZE, BATCH_SIZE,
        create_dataset, parse_and_preprocess_image
    )
except ImportError:
    from Training.data_preprocessing import (
        train_dataset, val_dataset,
        train_paths, test_paths,
        class_weight_dict, num_classes,
        label_encoder, class_names,
        IMG_SIZE, BATCH_SIZE,
        create_dataset, parse_and_preprocess_image
    )

# 2. Build the EfficientNetV2B0 Model (224x224x3 Input)
INPUT_SHAPE = (IMG_SIZE[0], IMG_SIZE[1], 3)
base_model = EfficientNetV2B0(
    weights='imagenet',
    include_top=False,
    input_shape=INPUT_SHAPE
)

# Crucial for Transfer Learning: Freeze the base model layers first
base_model.trainable = False

# 3. Add Custom Classification Layers
inputs = layers.Input(shape=INPUT_SHAPE, name="input_image")
x = base_model(inputs, training=False)
x = layers.GlobalAveragePooling2D(name="global_avg_pool")(x)
x = layers.Dropout(0.3, name="top_dropout")(x)
outputs = layers.Dense(num_classes, activation='softmax', name="predictions")(x)

model = models.Model(inputs, outputs, name="DermiAI_EfficientNetV2B0")

# 4. Model Architecture Verification
print("="*60)
print(" MODEL ARCHITECTURE VERIFICATION (tf.data.Dataset Pipeline)")
print("="*60)
print(f"Model Name:   {model.name}")
print(f"Input shape:  {model.input_shape}")
print(f"Output shape: {model.output_shape}")
print(f"Classes:      {num_classes}")
print(f"Class names:  {class_names}")
print(f"Total params: {model.count_params():,}")
print("="*60 + "\n", flush=True)

# 5. Training Execution Function
def train_model():
    start_time = time.time()
    output_model_path = os.path.join(SCRIPT_DIR, "my_dermiai_model.keras")
    class_names_path = os.path.join(SCRIPT_DIR, "class_names.json")

    # Save class names mapping immediately
    with open(class_names_path, "w", encoding="utf-8") as f:
        json.dump(class_names, f, indent=2)
    print(f"✅ Class names mapping saved to: {class_names_path}\n", flush=True)

    # ── Phase 1: Train Top Head Warmup ────────────────────────────────────────
    print("="*60)
    print(" PHASE 1: Training top classification layer (Head Warmup)...")
    print("="*60, flush=True)
    
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )

    callbacks_phase1 = [
        tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=3, restore_best_weights=True, verbose=1),
        tf.keras.callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.2, patience=2, min_lr=1e-6, verbose=1),
        tf.keras.callbacks.ModelCheckpoint(filepath=output_model_path, monitor='val_accuracy', save_best_only=True, verbose=1)
    ]

    history_phase1 = model.fit(
        train_dataset,
        validation_data=val_dataset,
        epochs=10,
        class_weight=class_weight_dict,
        callbacks=callbacks_phase1,
        verbose=1
    )

    p1_epochs_completed = len(history_phase1.history.get("loss", []))
    print(f"\n✅ Phase 1 complete! ({p1_epochs_completed} epochs executed)\n", flush=True)

    # ── Phase 2: Unfreeze and Fine-Tune Backbone ──────────────────────────────
    print("="*60)
    print(" PHASE 2: Unfreezing base model for deep fine-tuning...")
    print("="*60, flush=True)
    
    base_model.trainable = True

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )

    callbacks_phase2 = [
        tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=4, restore_best_weights=True, verbose=1),
        tf.keras.callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.2, patience=2, min_lr=1e-7, verbose=1),
        tf.keras.callbacks.ModelCheckpoint(filepath=output_model_path, monitor='val_accuracy', save_best_only=True, verbose=1)
    ]

    history_phase2 = model.fit(
        train_dataset,
        validation_data=val_dataset,
        epochs=15,
        class_weight=class_weight_dict,
        callbacks=callbacks_phase2,
        verbose=1
    )

    p2_epochs_completed = len(history_phase2.history.get("loss", []))
    total_duration = time.time() - start_time

    # Save final model state if not saved by checkpoint
    if not os.path.exists(output_model_path):
        model.save(output_model_path)
    print(f"\n✅ Model successfully saved to: {output_model_path}", flush=True)

    # ── Calculate Accuracies & Metrics ────────────────────────────────────────
    all_train_acc = history_phase1.history.get("accuracy", []) + history_phase2.history.get("accuracy", [])
    all_val_acc = history_phase1.history.get("val_accuracy", []) + history_phase2.history.get("val_accuracy", [])
    all_val_loss = history_phase1.history.get("val_loss", []) + history_phase2.history.get("val_loss", [])

    best_train_acc = max(all_train_acc) if all_train_acc else 0.0
    best_val_acc = max(all_val_acc) if all_val_acc else 0.0
    final_val_acc = all_val_acc[-1] if all_val_acc else 0.0
    final_val_loss = all_val_loss[-1] if all_val_loss else 0.0

    model_file_size_mb = round(os.path.getsize(output_model_path) / (1024 * 1024), 2)

    peak_ram = get_peak_ram_mb()
    print("\n" + "="*60)
    print(" 🎉 TRAINING SUMMARY & METRICS")
    print("="*60)
    print(f"Status:                      Training completed successfully!")
    print(f"Phase 1 Epochs:              {p1_epochs_completed} / 10")
    print(f"Phase 2 Epochs:              {p2_epochs_completed} / 15")
    print(f"Best Training Accuracy:      {best_train_acc*100:.2f}%")
    print(f"Best Validation Accuracy:    {best_val_acc*100:.2f}%")
    print(f"Final Validation Accuracy:   {final_val_acc*100:.2f}%")
    print(f"Final Validation Loss:       {final_val_loss:.4f}")
    print(f"Total Training Duration:     {total_duration/60:.2f} minutes ({total_duration:.1f}s)")
    print(f"Final Model File Size:       {model_file_size_mb} MB")
    print(f"Peak RAM Usage:              {peak_ram} MB" if peak_ram else "Peak RAM Usage:              N/A")
    print(f"Exact Model Path:            {output_model_path}")
    print(f"Model Input Shape:           {model.input_shape}")
    print(f"Model Output Shape:          {model.output_shape}")
    print(f"Number of Classes:           {num_classes}")
    print(f"Exact Class Order:           {class_names}")
    print("="*60, flush=True)

    # ── Verification: Reload model from disk ───────────────────────────────────
    print("\nVerifying saved model reload from disk...")
    reloaded_model = tf.keras.models.load_model(output_model_path, compile=False)
    print(f"✅ Reload verified! Model input: {reloaded_model.input_shape}, output: {reloaded_model.output_shape}")

    # ── Run Test Prediction on 1 Validation Sample ─────────────────────────────
    print("\nRunning test prediction on a validation sample...")
    for test_batch_imgs, test_batch_lbls in val_dataset.take(1):
        sample_img = test_batch_imgs[0:1]
        sample_lbl = test_batch_lbls[0].numpy()
        true_label_idx = int(np.argmax(sample_lbl))
        true_class = class_names[true_label_idx]
        
        raw_pred = reloaded_model(sample_img, training=False).numpy()[0]
        pred_idx = int(np.argmax(raw_pred))
        pred_class = class_names[pred_idx]
        confidence = raw_pred[pred_idx] * 100.0

        print(f"Sample ground truth:      {true_class} (index {true_label_idx})")
        print(f"Model prediction:         {pred_class} (index {pred_idx})")
        print(f"Confidence score:         {confidence:.2f}%")
        print(f"Softmax distribution:     {[round(float(p), 4) for p in raw_pred]}")
        print("✅ Model test prediction executed successfully!\n", flush=True)
        break

    return reloaded_model, history_phase1, history_phase2

if __name__ == "__main__":
    train_model()
