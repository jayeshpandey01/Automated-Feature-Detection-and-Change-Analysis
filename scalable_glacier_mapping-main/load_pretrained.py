"""
===========================================================
  GlacioWatch: Load & Use Pre-trained U-Net for Inference
===========================================================

Three options:
  1. Load from locally saved weights (best_model_png.weights.h5)
  2. Load from GlaViTU official weights downloaded from Google Drive
  3. Use transfer learning via a pretrained VGG16/ResNet backbone

Usage:
  python load_pretrained.py --mode predict --weights weights/best_model_png.weights.h5
  python load_pretrained.py --mode predict --weights path/to/your/weights.h5
  python load_pretrained.py --mode demo   # Uses random demo model (no weights needed)
"""

import os
import sys
import argparse
import numpy as np

# Disable oneDNN to prevent MKL memory allocation errors on CPU
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["PYTHONIOENCODING"] = "utf-8"

import tensorflow as tf
import matplotlib
matplotlib.use("Agg")   # headless backend - no display needed
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from PIL import Image
import glob

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
IMG_HEIGHT   = 256
IMG_WIDTH    = 256
DATASET_PATH = "glacier-lake-dataset"
IMAGES_PATH  = os.path.join(DATASET_PATH, "images")
MASKS_PATH   = os.path.join(DATASET_PATH, "masks")

# ─────────────────────────────────────────────
# U-Net ARCHITECTURE  (identical to train_with_png_dataset.py)
# ─────────────────────────────────────────────

def conv_block(inputs, filters, dropout_rate=0.1):
    x = tf.keras.layers.Conv2D(filters, 3, padding="same")(inputs)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Activation("relu")(x)
    x = tf.keras.layers.Dropout(dropout_rate)(x)
    x = tf.keras.layers.Conv2D(filters, 3, padding="same")(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Activation("relu")(x)
    return x

def encoder_block(inputs, filters, dropout_rate=0.1):
    x = conv_block(inputs, filters, dropout_rate)
    p = tf.keras.layers.MaxPool2D(2)(x)
    return x, p

def decoder_block(inputs, skip_features, filters, dropout_rate=0.1):
    x = tf.keras.layers.Conv2DTranspose(filters, 2, strides=2, padding="same")(inputs)
    x = tf.keras.layers.Concatenate()([x, skip_features])
    x = conv_block(x, filters, dropout_rate)
    return x

def build_unet(input_shape=(IMG_HEIGHT, IMG_WIDTH, 3), n_classes=2):
    """Build the same U-Net architecture used during training."""
    inputs = tf.keras.layers.Input(input_shape)
    s1, p1 = encoder_block(inputs, 64)
    s2, p2 = encoder_block(p1,    128)
    s3, p3 = encoder_block(p2,    256)
    s4, p4 = encoder_block(p3,    512)
    b1     = conv_block(p4, 1024)
    d1     = decoder_block(b1, s4, 512)
    d2     = decoder_block(d1, s3, 256)
    d3     = decoder_block(d2, s2, 128)
    d4     = decoder_block(d3, s1, 64)
    outputs = tf.keras.layers.Conv2D(n_classes, 1, padding="same", activation="softmax")(d4)
    return tf.keras.Model(inputs, outputs, name="UNet_Glacier")

# ─────────────────────────────────────────────
# CUSTOM METRICS (needed to load model with compile)
# ─────────────────────────────────────────────

def dice_coefficient(y_true, y_pred, smooth=1e-6):
    y_true_f = tf.keras.backend.flatten(y_true[:, :, :, 1])
    y_pred_f = tf.keras.backend.flatten(y_pred[:, :, :, 1])
    intersection = tf.keras.backend.sum(y_true_f * y_pred_f)
    return (2.0 * intersection + smooth) / (
        tf.keras.backend.sum(y_true_f) + tf.keras.backend.sum(y_pred_f) + smooth
    )

def iou_coefficient(y_true, y_pred, smooth=1e-6):
    y_true_f = tf.keras.backend.flatten(y_true[:, :, :, 1])
    y_pred_f = tf.keras.backend.flatten(y_pred[:, :, :, 1])
    intersection = tf.keras.backend.sum(y_true_f * y_pred_f)
    union = tf.keras.backend.sum(y_true_f) + tf.keras.backend.sum(y_pred_f) - intersection
    return (intersection + smooth) / (union + smooth)

CUSTOM_OBJECTS = {
    "dice_coefficient": dice_coefficient,
    "iou_coefficient":  iou_coefficient,
}

# ─────────────────────────────────────────────
# LOADING FUNCTIONS
# ─────────────────────────────────────────────

def load_model_weights(weights_path: str) -> tf.keras.Model:
    """Load U-Net and restore weights from a .weights.h5 or full .h5 file."""
    print(f"\n[1] Building U-Net architecture ({IMG_HEIGHT}x{IMG_WIDTH})...")
    model = build_unet()
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-4),
        loss="categorical_crossentropy",
        metrics=["accuracy", dice_coefficient, iou_coefficient],
    )
    print(f"    Parameters : {model.count_params():,}")

    if not os.path.exists(weights_path):
        raise FileNotFoundError(
            f"Weights not found at: {weights_path}\n"
            "Run training first OR download official weights from:\n"
            "  https://bit.ly/49aVPIJ  (Google Drive - gsgm_dataset_DEMO)\n"
            "Then place the .h5 file in the 'weights/' folder."
        )

    print(f"[2] Loading weights from: {weights_path}")
    if weights_path.endswith(".weights.h5"):
        model.load_weights(weights_path)
    else:
        # Full model save - load entire model (architecture + weights)
        model = tf.keras.models.load_model(weights_path, custom_objects=CUSTOM_OBJECTS)
    print("    Weights loaded successfully!")
    return model


def load_demo_model() -> tf.keras.Model:
    """Build model with random weights - useful to verify the inference pipeline."""
    print("\n[DEMO MODE] Building U-Net with random weights (no training required)...")
    model = build_unet()
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-4),
        loss="categorical_crossentropy",
        metrics=["accuracy", dice_coefficient, iou_coefficient],
    )
    print(f"    Parameters : {model.count_params():,}")
    print("    (Results are random - load real weights for meaningful predictions)")
    return model

# ─────────────────────────────────────────────
# INFERENCE
# ─────────────────────────────────────────────

def preprocess_image(image_path: str) -> np.ndarray:
    """Load and preprocess a single image for inference."""
    img = Image.open(image_path).convert("RGB")
    img = img.resize((IMG_WIDTH, IMG_HEIGHT))
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)   # (1, H, W, 3)


def predict_single(model, image_path: str) -> dict:
    """Run inference on one image and return result dict."""
    img_batch  = preprocess_image(image_path)
    pred       = model.predict(img_batch, verbose=0)          # (1, H, W, 2)
    glacier_map = pred[0, :, :, 1]                            # glacier probability
    binary_mask = (glacier_map > 0.5).astype(np.uint8)

    glacier_pct = float(binary_mask.mean() * 100)
    mean_conf   = float(glacier_map[binary_mask == 1].mean()) if binary_mask.any() else 0.0

    return {
        "image_path":    image_path,
        "glacier_mask":  binary_mask,
        "glacier_prob":  glacier_map,
        "glacier_area_%": glacier_pct,
        "mean_confidence": mean_conf,
    }


def run_batch_inference(model, n_samples: int = 9):
    """Run inference on n_samples random images and save a summary grid."""
    image_files = sorted(glob.glob(os.path.join(IMAGES_PATH, "*.png")))
    if not image_files:
        print(f"No images found at {IMAGES_PATH}")
        return

    rng     = np.random.default_rng(42)
    sample  = rng.choice(image_files, size=min(n_samples, len(image_files)), replace=False)

    print(f"\n[3] Running inference on {len(sample)} images...")
    results = [predict_single(model, p) for p in sample]

    # ── Plot grid ────────────────────────────────────────────────────────
    ncols = 3
    nrows = len(results)
    fig, axes = plt.subplots(nrows, ncols, figsize=(ncols * 5, nrows * 4))
    fig.suptitle("GlacioWatch - Glacier Segmentation Inference Results", fontsize=14, fontweight="bold")

    for row_idx, res in enumerate(results):
        # Original image
        orig = np.array(Image.open(res["image_path"]).convert("RGB").resize((IMG_WIDTH, IMG_HEIGHT)))
        axes[row_idx, 0].imshow(orig)
        axes[row_idx, 0].set_title(f"Image: {os.path.basename(res['image_path'])}", fontsize=8)
        axes[row_idx, 0].axis("off")

        # Probability heatmap
        im = axes[row_idx, 1].imshow(res["glacier_prob"], cmap="RdYlBu_r", vmin=0, vmax=1)
        axes[row_idx, 1].set_title(f"Glacier Probability (area={res['glacier_area_%']:.1f}%)", fontsize=8)
        axes[row_idx, 1].axis("off")
        plt.colorbar(im, ax=axes[row_idx, 1], fraction=0.046, pad=0.04)

        # Binary mask overlay
        overlay = orig.copy().astype(float) / 255.0
        mask    = res["glacier_mask"]
        overlay[mask == 1, 0] += 0.3   # red channel boost on glacier pixels
        overlay = np.clip(overlay, 0, 1)
        axes[row_idx, 2].imshow(overlay)
        axes[row_idx, 2].set_title(f"Mask Overlay (conf={res['mean_confidence']:.2f})", fontsize=8)
        axes[row_idx, 2].axis("off")

    os.makedirs("predictions", exist_ok=True)
    out_path = "predictions/inference_results.png"
    plt.tight_layout()
    plt.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"[4] Inference grid saved to: {out_path}")

    # ── Print summary table ───────────────────────────────────────────────
    print("\n" + "=" * 65)
    print(f"  {'Image':<35} {'Glacier %':>10} {'Confidence':>12}")
    print("=" * 65)
    for r in results:
        name = os.path.basename(r["image_path"])
        print(f"  {name:<35} {r['glacier_area_%']:>9.1f}% {r['mean_confidence']:>11.3f}")
    print("=" * 65)


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="GlacioWatch - Pretrained U-Net Inference")
    p.add_argument(
        "--mode", choices=["predict", "demo"], default="demo",
        help="'predict' = load weights and run inference, 'demo' = random weights (sanity check)"
    )
    p.add_argument(
        "--weights", type=str, default="weights/best_model_png.weights.h5",
        help="Path to .weights.h5 or full model .h5 file"
    )
    p.add_argument(
        "--n", type=int, default=9,
        help="Number of images to run inference on (default 9)"
    )
    return p.parse_args()


def main():
    args = parse_args()
    print("=" * 65)
    print("  GlacioWatch - Pre-trained U-Net Glacier Segmentation")
    print("=" * 65)
    print(f"  TensorFlow : {tf.__version__}")
    print(f"  GPU        : {tf.config.list_physical_devices('GPU') or 'None (CPU mode)'}")
    print(f"  Mode       : {args.mode}")
    if args.mode == "predict":
        print(f"  Weights    : {args.weights}")

    if args.mode == "demo":
        model = load_demo_model()
    else:
        model = load_model_weights(args.weights)

    run_batch_inference(model, n_samples=args.n)
    print("\nDone!")


if __name__ == "__main__":
    main()
