"""
Glacier Detection Training Script for PNG Dataset
This script trains a U-Net model on the glacier-lake-dataset (PNG images)
"""

import os
import sys

# Disable oneDNN to prevent MKL memory allocation errors on CPU
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import numpy as np
import matplotlib.pyplot as plt
import tensorflow as tf
from tqdm import tqdm
import cv2
from sklearn.metrics import confusion_matrix, classification_report
from sklearn.model_selection import train_test_split
import glob
from PIL import Image

# ============================================================================
# CONFIGURATION
# ============================================================================

DATASET_PATH = "glacier-lake-dataset"
IMAGES_PATH = os.path.join(DATASET_PATH, "images")
MASKS_PATH = os.path.join(DATASET_PATH, "masks")

# Training parameters
IMG_HEIGHT = 256  # Resize from 400 to 256 for faster training
IMG_WIDTH = 256
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", 4))
EPOCHS = int(os.environ.get("EPOCHS", 50))
LEARNING_RATE = 1e-4
VALIDATION_SPLIT = 0.2
TEST_SPLIT = 0.1

# Create output directories
os.makedirs("weights", exist_ok=True)
os.makedirs("logs", exist_ok=True)
os.makedirs("predictions", exist_ok=True)

# ============================================================================
# GPU SETUP
# ============================================================================

def setup_gpu():
    """Configure GPU settings"""
    gpus = tf.config.experimental.list_physical_devices('GPU')
    if gpus:
        try:
            for gpu in gpus:
                tf.config.experimental.set_memory_growth(gpu, True)
            tf.config.experimental.set_visible_devices(gpus[0], 'GPU')
            print(f"✓ GPU configured: {gpus[0]}")
            return True
        except RuntimeError as e:
            print(f"GPU configuration error: {e}")
            return False
    else:
        print("⚠️  No GPU detected - training will use CPU")
        return False

# Set random seeds
np.random.seed(42)
tf.random.set_seed(42)

setup_gpu()
print(f"TensorFlow version: {tf.__version__}")

# ============================================================================
# DATA LOADING AND PREPROCESSING
# ============================================================================

def load_and_preprocess_image(image_path, mask_path):
    """Load and preprocess a single image-mask pair"""
    
    # Load image
    image = tf.io.read_file(image_path)
    image = tf.image.decode_png(image, channels=3)
    image = tf.cast(image, tf.float32) / 255.0  # Normalize to [0, 1]
    
    # Load mask
    mask = tf.io.read_file(mask_path)
    mask = tf.image.decode_png(mask, channels=1)
    mask = tf.cast(mask, tf.float32) / 255.0  # Normalize to [0, 1]
    
    # Resize images
    image = tf.image.resize(image, [IMG_HEIGHT, IMG_WIDTH])
    mask = tf.image.resize(mask, [IMG_HEIGHT, IMG_WIDTH])
    
    # Convert mask to categorical (background=0, glacier=1)
    mask = tf.cast(mask > 0.5, tf.float32)  # Threshold at 0.5
    mask = tf.concat([1.0 - mask, mask], axis=-1)  # One-hot encoding
    
    return image, mask

def augment_image(image, mask):
    """Apply data augmentation"""
    
    # Random horizontal flip
    if tf.random.uniform(()) > 0.5:
        image = tf.image.flip_left_right(image)
        mask = tf.image.flip_left_right(mask)
    
    # Random vertical flip
    if tf.random.uniform(()) > 0.5:
        image = tf.image.flip_up_down(image)
        mask = tf.image.flip_up_down(mask)
    
    # Random rotation (90 degree increments)
    k = tf.random.uniform(shape=[], minval=0, maxval=4, dtype=tf.int32)
    image = tf.image.rot90(image, k)
    mask = tf.image.rot90(mask, k)
    
    # Random brightness and contrast
    image = tf.image.random_brightness(image, 0.1)
    image = tf.image.random_contrast(image, 0.8, 1.2)
    
    # Clip values to [0, 1]
    image = tf.clip_by_value(image, 0.0, 1.0)
    
    return image, mask

def create_dataset(image_paths, mask_paths, batch_size, augment=False):
    """Create a TensorFlow dataset"""
    
    dataset = tf.data.Dataset.from_tensor_slices((image_paths, mask_paths))
    dataset = dataset.map(load_and_preprocess_image, num_parallel_calls=tf.data.AUTOTUNE)
    
    if augment:
        dataset = dataset.map(augment_image, num_parallel_calls=tf.data.AUTOTUNE)
    
    dataset = dataset.batch(batch_size)
    dataset = dataset.prefetch(tf.data.AUTOTUNE)
    
    return dataset

# ============================================================================
# DATASET SPLITTING
# ============================================================================

def split_dataset():
    """Split dataset into train/validation/test sets"""
    
    # Get all image and mask paths
    image_files = sorted(glob.glob(os.path.join(IMAGES_PATH, "*.png")))
    mask_files = sorted(glob.glob(os.path.join(MASKS_PATH, "*.png")))
    
    # Ensure matching pairs
    image_names = [os.path.basename(f) for f in image_files]
    mask_names = [os.path.basename(f) for f in mask_files]
    
    # Filter to matching pairs only
    matching_names = set(image_names) & set(mask_names)
    matching_names = sorted(list(matching_names))
    
    image_paths = [os.path.join(IMAGES_PATH, name) for name in matching_names]
    mask_paths = [os.path.join(MASKS_PATH, name) for name in matching_names]
    
    print(f"Total matching pairs: {len(matching_names)}")
    
    # Split into train/temp
    train_images, temp_images, train_masks, temp_masks = train_test_split(
        image_paths, mask_paths, test_size=VALIDATION_SPLIT + TEST_SPLIT, random_state=42
    )
    
    # Split temp into validation/test
    val_size = VALIDATION_SPLIT / (VALIDATION_SPLIT + TEST_SPLIT)
    val_images, test_images, val_masks, test_masks = train_test_split(
        temp_images, temp_masks, test_size=1-val_size, random_state=42
    )
    
    print(f"Training samples: {len(train_images)}")
    print(f"Validation samples: {len(val_images)}")
    print(f"Test samples: {len(test_images)}")
    
    return (train_images, train_masks), (val_images, val_masks), (test_images, test_masks)

# ============================================================================
# MODEL ARCHITECTURE (U-Net)
# ============================================================================

def conv_block(inputs, filters, dropout_rate=0.1):
    """Convolutional block with batch normalization and dropout"""
    x = tf.keras.layers.Conv2D(filters, 3, padding='same')(inputs)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Activation('relu')(x)
    x = tf.keras.layers.Dropout(dropout_rate)(x)
    
    x = tf.keras.layers.Conv2D(filters, 3, padding='same')(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Activation('relu')(x)
    
    return x

def encoder_block(inputs, filters, dropout_rate=0.1):
    """Encoder block with max pooling"""
    x = conv_block(inputs, filters, dropout_rate)
    p = tf.keras.layers.MaxPool2D(2)(x)
    return x, p

def decoder_block(inputs, skip_features, filters, dropout_rate=0.1):
    """Decoder block with upsampling and skip connections"""
    x = tf.keras.layers.Conv2DTranspose(filters, 2, strides=2, padding='same')(inputs)
    x = tf.keras.layers.Concatenate()([x, skip_features])
    x = conv_block(x, filters, dropout_rate)
    return x

def create_unet_model(input_shape=(IMG_HEIGHT, IMG_WIDTH, 3), n_classes=2):
    """Create U-Net model for glacier detection"""
    
    inputs = tf.keras.layers.Input(input_shape)
    
    # Encoder
    s1, p1 = encoder_block(inputs, 64)
    s2, p2 = encoder_block(p1, 128)
    s3, p3 = encoder_block(p2, 256)
    s4, p4 = encoder_block(p3, 512)
    
    # Bottleneck
    b1 = conv_block(p4, 1024)
    
    # Decoder
    d1 = decoder_block(b1, s4, 512)
    d2 = decoder_block(d1, s3, 256)
    d3 = decoder_block(d2, s2, 128)
    d4 = decoder_block(d3, s1, 64)
    
    # Output
    outputs = tf.keras.layers.Conv2D(n_classes, 1, padding='same', activation='softmax')(d4)
    
    model = tf.keras.Model(inputs, outputs, name='UNet_Glacier')
    return model

# ============================================================================
# METRICS
# ============================================================================

def dice_coefficient(y_true, y_pred, smooth=1e-6):
    """Dice coefficient for glacier class"""
    y_true_f = tf.keras.backend.flatten(y_true[:, :, :, 1])  # Glacier class
    y_pred_f = tf.keras.backend.flatten(y_pred[:, :, :, 1])  # Glacier class
    intersection = tf.keras.backend.sum(y_true_f * y_pred_f)
    return (2. * intersection + smooth) / (tf.keras.backend.sum(y_true_f) + tf.keras.backend.sum(y_pred_f) + smooth)

def iou_coefficient(y_true, y_pred, smooth=1e-6):
    """IoU coefficient for glacier class"""
    y_true_f = tf.keras.backend.flatten(y_true[:, :, :, 1])  # Glacier class
    y_pred_f = tf.keras.backend.flatten(y_pred[:, :, :, 1])  # Glacier class
    intersection = tf.keras.backend.sum(y_true_f * y_pred_f)
    union = tf.keras.backend.sum(y_true_f) + tf.keras.backend.sum(y_pred_f) - intersection
    return (intersection + smooth) / (union + smooth)

# ============================================================================
# MAIN TRAINING FUNCTION
# ============================================================================

def main():
    """Main training function"""
    
    print("=" * 60)
    print("GLACIER DETECTION TRAINING - PNG DATASET")
    print("=" * 60)
    
    # Check if dataset exists
    if not os.path.exists(IMAGES_PATH) or not os.path.exists(MASKS_PATH):
        print(f"❌ Dataset not found!")
        print(f"Expected paths:")
        print(f"  - Images: {IMAGES_PATH}")
        print(f"  - Masks: {MASKS_PATH}")
        return
    
    # Split dataset
    print("\n1. Splitting dataset...")
    (train_images, train_masks), (val_images, val_masks), (test_images, test_masks) = split_dataset()
    
    # Create datasets
    print("\n2. Creating TensorFlow datasets...")
    train_dataset = create_dataset(train_images, train_masks, BATCH_SIZE, augment=True)
    val_dataset = create_dataset(val_images, val_masks, BATCH_SIZE, augment=False)
    test_dataset = create_dataset(test_images, test_masks, BATCH_SIZE, augment=False)
    print("✓ Datasets created")
    
    # Create model
    print("\n3. Creating U-Net model...")
    model = create_unet_model()
    print(f"✓ Model created with {model.count_params():,} parameters")
    
    # Compile model
    print("\n4. Compiling model...")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=LEARNING_RATE),
        loss='categorical_crossentropy',
        metrics=[
            'accuracy',
            dice_coefficient,
            iou_coefficient,
            tf.keras.metrics.Precision(class_id=1, name='precision_glacier'),
            tf.keras.metrics.Recall(class_id=1, name='recall_glacier')
        ]
    )
    print("✓ Model compiled")
    
    # Setup callbacks
    callbacks = [
        tf.keras.callbacks.ModelCheckpoint(
            'weights/best_model_png.weights.h5',
            monitor='val_iou_coefficient',
            mode='max',
            save_best_only=True,
            save_weights_only=True,
            verbose=1
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=1e-7,
            verbose=1
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=15,
            restore_best_weights=True,
            verbose=1
        ),
        tf.keras.callbacks.CSVLogger(
            'logs/training_log_png.csv',
            append=True
        )
    ]
    
    # Train model
    print("\n5. Starting training...")
    print(f"Training for {EPOCHS} epochs")
    print(f"Batch size: {BATCH_SIZE}")
    print(f"Learning rate: {LEARNING_RATE}")
    print("-" * 60)
    
    history = model.fit(
        train_dataset,
        epochs=EPOCHS,
        validation_data=val_dataset,
        callbacks=callbacks,
        verbose=1
    )
    
    # Evaluate on test set
    print("\n6. Evaluating on test set...")
    test_results = model.evaluate(test_dataset, verbose=1)
    
    print("\n" + "=" * 60)
    print("TRAINING COMPLETED!")
    print("=" * 60)
    print("\nTest Results:")
    for i, metric_name in enumerate(model.metrics_names):
        print(f"  {metric_name}: {test_results[i]:.4f}")
    
    print("\nModel files saved:")
    print("  - weights/best_model_png.h5")
    print("  - logs/training_log_png.csv")
    
    # Save full model
    model.save('weights/glacier_unet_png_full.h5')
    print("  - weights/glacier_unet_png_full.h5")
    
    print("\n✅ All done!")

if __name__ == "__main__":
    main()
