
"""
Glacier Detection Training Script (GPU Optimized)

This script provides a comprehensive workflow for training glacier detection models 
using the glacial lake dataset with GPU/CUDA optimization.

Features:
- Dataset: Glacial lake dataset with satellite imagery and ground truth masks
- Models: U-Net architecture for semantic segmentation
- Features: RGB imagery from PNG files
- Training: Data augmentation, custom loss functions
- GPU: CUDA acceleration, mixed precision, memory optimization
- Evaluation: IoU, Dice coefficient, precision, recall
"""

import os
import sys
import numpy as np
import matplotlib.pyplot as plt
import pickle
import tensorflow as tf
from tqdm import tqdm
import cv2
from sklearn.metrics import confusion_matrix, classification_report
import time
import psutil
from PIL import Image
import glob
from sklearn.model_selection import train_test_split

# Set random seeds for reproducibility
np.random.seed(42)
tf.random.set_seed(42)

print(f"TensorFlow version: {tf.__version__}")
print(f"Python version: {sys.version}")
print(f"NumPy version: {np.__version__}")

def setup_gpu_optimization():
    """Configure GPU settings for optimal training performance"""
    
    # Check GPU availability
    gpus = tf.config.experimental.list_physical_devices('GPU')
    if not gpus:
        print("⚠️  WARNING: No GPU detected! Training will be slow on CPU.")
        print("Please ensure CUDA and cuDNN are properly installed.")
        return False
    
    try:
        # Enable memory growth to avoid allocating all GPU memory at once
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
        
        # Set the first GPU as the logical device
        tf.config.experimental.set_visible_devices(gpus[0], 'GPU')
        
        # Enable mixed precision for better performance
        policy = tf.keras.mixed_precision.Policy('mixed_float16')
        tf.keras.mixed_precision.set_global_policy(policy)
        
        print(f"✅ GPU optimization enabled!")
        print(f"Available GPUs: {len(gpus)}")
        for i, gpu in enumerate(gpus):
            print(f"  GPU {i}: {gpu.name}")
        print(f"Mixed precision policy: {policy.name}")
        
        return True
        
    except RuntimeError as e:
        print(f"❌ GPU setup failed: {e}")
        return False

# Setup GPU optimization
gpu_available = setup_gpu_optimization()

# Additional TensorFlow optimizations
tf.config.optimizer.set_jit(True)  # Enable XLA compilation
tf.config.threading.set_inter_op_parallelism_threads(0)
tf.config.threading.set_intra_op_parallelism_threads(0)

# Dataset Configuration
DATASET_PATH = "glacier-lake-dataset"
IMAGES_PATH = os.path.join(DATASET_PATH, "images")
MASKS_PATH = os.path.join(DATASET_PATH, "masks")

# Training parameters
IMG_HEIGHT = 256
IMG_WIDTH = 256
BATCH_SIZE = 8
EPOCHS = int(os.environ.get("EPOCHS", 50))
LEARNING_RATE = 1e-4
VALIDATION_SPLIT = 0.2
TEST_SPLIT = 0.1

print(f"Dataset path: {DATASET_PATH}")
print(f"Images path: {IMAGES_PATH}")
print(f"Masks path: {MASKS_PATH}")
print(f"Image size: {IMG_HEIGHT}x{IMG_WIDTH}")
print(f"Batch size: {BATCH_SIZE}")
print(f"Epochs: {EPOCHS}")

# Dataset Loading and Validation
if not os.path.exists(DATASET_PATH):
    raise FileNotFoundError(f"Dataset not found at {DATASET_PATH}")

if not os.path.exists(IMAGES_PATH):
    raise FileNotFoundError(f"Images folder not found at {IMAGES_PATH}")

if not os.path.exists(MASKS_PATH):
    raise FileNotFoundError(f"Masks folder not found at {MASKS_PATH}")

# Get list of image files
image_files = sorted(glob.glob(os.path.join(IMAGES_PATH, "*.png")))
mask_files = sorted(glob.glob(os.path.join(MASKS_PATH, "*.png")))

print(f"Found {len(image_files)} images")
print(f"Found {len(mask_files)} masks")

# Find matching pairs
matching_pairs = []
for img_file in image_files:
    img_name = os.path.basename(img_file)
    mask_file = os.path.join(MASKS_PATH, img_name)
    if os.path.exists(mask_file):
        matching_pairs.append((img_file, mask_file))

print(f"Found {len(matching_pairs)} matching image-mask pairs")

if len(matching_pairs) == 0:
    raise ValueError("No matching image-mask pairs found!")

class GlacierDataGenerator(tf.keras.utils.Sequence):
    """Custom data generator for glacier detection using PNG images"""
    
    def __init__(self, image_mask_pairs, batch_size=8, img_height=256, img_width=256, 
                 shuffle=True, augment=False):
        self.image_mask_pairs = image_mask_pairs
        self.batch_size = batch_size
        self.img_height = img_height
        self.img_width = img_width
        self.shuffle = shuffle
        self.augment = augment
        self.indices = np.arange(len(self.image_mask_pairs))
        self.on_epoch_end()
    
    def __len__(self):
        return int(np.ceil(len(self.image_mask_pairs) / self.batch_size))
    
    def __getitem__(self, index):
        start_idx = index * self.batch_size
        end_idx = min((index + 1) * self.batch_size, len(self.image_mask_pairs))
        batch_indices = self.indices[start_idx:end_idx]
        
        batch_x, batch_y = self.__generate_batch(batch_indices)
        return batch_x, batch_y
    
    def on_epoch_end(self):
        if self.shuffle:
            np.random.shuffle(self.indices)
    
    def __generate_batch(self, batch_indices):
        batch_x = np.zeros((len(batch_indices), self.img_height, self.img_width, 3), dtype=np.float32)
        batch_y = np.zeros((len(batch_indices), self.img_height, self.img_width, 1), dtype=np.float32)
        
        for i, idx in enumerate(batch_indices):
            img_path, mask_path = self.image_mask_pairs[idx]
            
            image = self.__load_image(img_path)
            mask = self.__load_mask(mask_path)
            
            if self.augment:
                image, mask = self.__augment(image, mask)
            
            batch_x[i] = image
            batch_y[i] = mask
        
        return batch_x, batch_y
    
    def __load_image(self, img_path):
        """Load and preprocess image"""
        image = cv2.imread(img_path)
        if image is None:
            raise ValueError(f"Could not load image: {img_path}")
        
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        image = cv2.resize(image, (self.img_width, self.img_height))
        image = image.astype(np.float32) / 255.0
        
        return image
    
    def __load_mask(self, mask_path):
        """Load and preprocess mask"""
        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        if mask is None:
            raise ValueError(f"Could not load mask: {mask_path}")
        
        mask = cv2.resize(mask, (self.img_width, self.img_height))
        mask = mask.astype(np.float32) / 255.0
        mask = np.expand_dims(mask, axis=-1)
        mask = (mask > 0.5).astype(np.float32)
        
        return mask
    
    def __augment(self, image, mask):
        """Apply data augmentation"""
        # Random horizontal flip
        if np.random.random() > 0.5:
            image = np.fliplr(image)
            mask = np.fliplr(mask)
        
        # Random vertical flip
        if np.random.random() > 0.5:
            image = np.flipud(image)
            mask = np.flipud(mask)
        
        # Random rotation (90, 180, 270 degrees)
        if np.random.random() > 0.5:
            k = np.random.randint(1, 4)
            image = np.rot90(image, k)
            mask = np.rot90(mask, k)
        
        return image, mask

print("✅ Custom data generator defined")

# Data Splitting and Generator Creation
train_pairs, temp_pairs = train_test_split(
    matching_pairs, 
    test_size=(VALIDATION_SPLIT + TEST_SPLIT), 
    random_state=42
)

val_pairs, test_pairs = train_test_split(
    temp_pairs, 
    test_size=TEST_SPLIT/(VALIDATION_SPLIT + TEST_SPLIT), 
    random_state=42
)

print(f"Training samples: {len(train_pairs)}")
print(f"Validation samples: {len(val_pairs)}")
print(f"Test samples: {len(test_pairs)}")

# Create data generators
train_generator = GlacierDataGenerator(
    train_pairs,
    batch_size=BATCH_SIZE,
    img_height=IMG_HEIGHT,
    img_width=IMG_WIDTH,
    shuffle=True,
    augment=True
)

val_generator = GlacierDataGenerator(
    val_pairs,
    batch_size=BATCH_SIZE,
    img_height=IMG_HEIGHT,
    img_width=IMG_WIDTH,
    shuffle=False,
    augment=False
)

test_generator = GlacierDataGenerator(
    test_pairs,
    batch_size=BATCH_SIZE,
    img_height=IMG_HEIGHT,
    img_width=IMG_WIDTH,
    shuffle=False,
    augment=False
)

print(f"✅ Data generators created")
print(f"Training batches: {len(train_generator)}")
print(f"Validation batches: {len(val_generator)}")
print(f"Test batches: {len(test_generator)}")

def visualize_samples(generator, num_samples=4):
    """Visualize sample images and their corresponding masks"""
    batch_x, batch_y = generator[0]
    
    fig, axes = plt.subplots(2, num_samples, figsize=(15, 8))
    
    for i in range(min(num_samples, len(batch_x))):
        # Display image
        axes[0, i].imshow(batch_x[i])
        axes[0, i].set_title(f'Image {i+1}')
        axes[0, i].axis('off')
        
        # Display mask
        axes[1, i].imshow(batch_y[i].squeeze(), cmap='gray')
        axes[1, i].set_title(f'Mask {i+1}')
        axes[1, i].axis('off')
    
    plt.tight_layout()
    plt.savefig('sample_visualization.png', dpi=300, bbox_inches='tight')
    plt.show()

print("Visualizing training samples:")
visualize_samples(train_generator, num_samples=4)

def create_unet_model(input_shape=(256, 256, 3), num_classes=1):
    """Create a U-Net model for glacier segmentation"""
    
    inputs = tf.keras.layers.Input(shape=input_shape)
    
    # Encoder (Contracting Path)
    conv1 = tf.keras.layers.Conv2D(64, 3, activation='relu', padding='same')(inputs)
    conv1 = tf.keras.layers.Conv2D(64, 3, activation='relu', padding='same')(conv1)
    pool1 = tf.keras.layers.MaxPooling2D(pool_size=(2, 2))(conv1)
    
    conv2 = tf.keras.layers.Conv2D(128, 3, activation='relu', padding='same')(pool1)
    conv2 = tf.keras.layers.Conv2D(128, 3, activation='relu', padding='same')(conv2)
    pool2 = tf.keras.layers.MaxPooling2D(pool_size=(2, 2))(conv2)
    
    conv3 = tf.keras.layers.Conv2D(256, 3, activation='relu', padding='same')(pool2)
    conv3 = tf.keras.layers.Conv2D(256, 3, activation='relu', padding='same')(conv3)
    pool3 = tf.keras.layers.MaxPooling2D(pool_size=(2, 2))(conv3)
    
    conv4 = tf.keras.layers.Conv2D(512, 3, activation='relu', padding='same')(pool3)
    conv4 = tf.keras.layers.Conv2D(512, 3, activation='relu', padding='same')(conv4)
    drop4 = tf.keras.layers.Dropout(0.5)(conv4)
    pool4 = tf.keras.layers.MaxPooling2D(pool_size=(2, 2))(drop4)
    
    # Bottleneck
    conv5 = tf.keras.layers.Conv2D(1024, 3, activation='relu', padding='same')(pool4)
    conv5 = tf.keras.layers.Conv2D(1024, 3, activation='relu', padding='same')(conv5)
    drop5 = tf.keras.layers.Dropout(0.5)(conv5)
    
    # Decoder (Expanding Path)
    up6 = tf.keras.layers.Conv2D(512, 2, activation='relu', padding='same')(tf.keras.layers.UpSampling2D(size=(2, 2))(drop5))
    merge6 = tf.keras.layers.concatenate([drop4, up6], axis=3)
    conv6 = tf.keras.layers.Conv2D(512, 3, activation='relu', padding='same')(merge6)
    conv6 = tf.keras.layers.Conv2D(512, 3, activation='relu', padding='same')(conv6)
    
    up7 = tf.keras.layers.Conv2D(256, 2, activation='relu', padding='same')(tf.keras.layers.UpSampling2D(size=(2, 2))(conv6))
    merge7 = tf.keras.layers.concatenate([conv3, up7], axis=3)
    conv7 = tf.keras.layers.Conv2D(256, 3, activation='relu', padding='same')(merge7)
    conv7 = tf.keras.layers.Conv2D(256, 3, activation='relu', padding='same')(conv7)
    
    up8 = tf.keras.layers.Conv2D(128, 2, activation='relu', padding='same')(tf.keras.layers.UpSampling2D(size=(2, 2))(conv7))
    merge8 = tf.keras.layers.concatenate([conv2, up8], axis=3)
    conv8 = tf.keras.layers.Conv2D(128, 3, activation='relu', padding='same')(merge8)
    conv8 = tf.keras.layers.Conv2D(128, 3, activation='relu', padding='same')(conv8)
    
    up9 = tf.keras.layers.Conv2D(64, 2, activation='relu', padding='same')(tf.keras.layers.UpSampling2D(size=(2, 2))(conv8))
    merge9 = tf.keras.layers.concatenate([conv1, up9], axis=3)
    conv9 = tf.keras.layers.Conv2D(64, 3, activation='relu', padding='same')(merge9)
    conv9 = tf.keras.layers.Conv2D(64, 3, activation='relu', padding='same')(conv9)
    
    # Output layer
    outputs = tf.keras.layers.Conv2D(num_classes, 1, activation='sigmoid')(conv9)
    
    model = tf.keras.Model(inputs=inputs, outputs=outputs)
    
    return model

# Create the model
model = create_unet_model(input_shape=(IMG_HEIGHT, IMG_WIDTH, 3), num_classes=1)

print("✅ U-Net model created")
print(f"Model input shape: {model.input_shape}")
print(f"Model output shape: {model.output_shape}")
print(f"Total parameters: {model.count_params():,}")

def dice_coefficient(y_true, y_pred, smooth=1e-6):
    """Dice coefficient for binary segmentation"""
    y_true_f = tf.keras.backend.flatten(y_true)
    y_pred_f = tf.keras.backend.flatten(y_pred)
    intersection = tf.keras.backend.sum(y_true_f * y_pred_f)
    return (2. * intersection + smooth) / (tf.keras.backend.sum(y_true_f) + tf.keras.backend.sum(y_pred_f) + smooth)

def dice_loss(y_true, y_pred):
    """Dice loss for binary segmentation"""
    return 1 - dice_coefficient(y_true, y_pred)

def combined_loss(y_true, y_pred):
    """Combined binary crossentropy and dice loss"""
    bce = tf.keras.losses.binary_crossentropy(y_true, y_pred)
    dice = dice_loss(y_true, y_pred)
    return bce + dice

def iou_metric(y_true, y_pred, threshold=0.5):
    """Intersection over Union (IoU) metric"""
    y_pred_binary = tf.cast(y_pred > threshold, tf.float32)
    intersection = tf.reduce_sum(y_true * y_pred_binary)
    union = tf.reduce_sum(y_true) + tf.reduce_sum(y_pred_binary) - intersection
    return intersection / (union + 1e-6)

# Compile the model
optimizer = tf.keras.optimizers.Adam(learning_rate=LEARNING_RATE)

model.compile(
    optimizer=optimizer,
    loss=combined_loss,
    metrics=[
        'accuracy',
        dice_coefficient,
        iou_metric,
        tf.keras.metrics.Precision(name='precision'),
        tf.keras.metrics.Recall(name='recall')
    ]
)

print("✅ Model compiled with custom loss and metrics")

# Define callbacks for training
callbacks = [
    # Model checkpoint - save best model
    tf.keras.callbacks.ModelCheckpoint(
        'best_glacier_model.h5',
        monitor='val_dice_coefficient',
        mode='max',
        save_best_only=True,
        save_weights_only=False,
        verbose=1
    ),
    
    # Early stopping
    tf.keras.callbacks.EarlyStopping(
        monitor='val_dice_coefficient',
        mode='max',
        patience=10,
        restore_best_weights=True,
        verbose=1
    ),
    
    # Learning rate reduction
    tf.keras.callbacks.ReduceLROnPlateau(
        monitor='val_loss',
        mode='min',
        factor=0.5,
        patience=5,
        min_lr=1e-7,
        verbose=1
    ),
    
    # CSV logger
    tf.keras.callbacks.CSVLogger(
        'training_log.csv',
        append=True
    )
]

print("✅ Training callbacks configured")

# Start training
print("🚀 Starting model training...")
print(f"Training on {len(train_pairs)} samples")
print(f"Validating on {len(val_pairs)} samples")
print(f"Batch size: {BATCH_SIZE}")
print(f"Epochs: {EPOCHS}")
print(f"GPU available: {gpu_available}")

# Record training start time
training_start_time = time.time()

# Train the model
history = model.fit(
    train_generator,
    epochs=EPOCHS,
    validation_data=val_generator,
    callbacks=callbacks,
    verbose=1,
    workers=4,
    use_multiprocessing=False  # Set to False to avoid issues
)

# Record training end time
training_end_time = time.time()
training_duration = training_end_time - training_start_time

print(f"\n✅ Training completed!")
print(f"Total training time: {training_duration/3600:.2f} hours")
print(f"Average time per epoch: {training_duration/len(history.history['loss']):.2f} seconds")

def plot_training_history(history):
    """Plot training and validation metrics"""
    
    fig, axes = plt.subplots(2, 3, figsize=(18, 12))
    
    # Loss
    axes[0, 0].plot(history.history['loss'], label='Training Loss')
    axes[0, 0].plot(history.history['val_loss'], label='Validation Loss')
    axes[0, 0].set_title('Model Loss')
    axes[0, 0].set_xlabel('Epoch')
    axes[0, 0].set_ylabel('Loss')
    axes[0, 0].legend()
    axes[0, 0].grid(True)
    
    # Accuracy
    axes[0, 1].plot(history.history['accuracy'], label='Training Accuracy')
    axes[0, 1].plot(history.history['val_accuracy'], label='Validation Accuracy')
    axes[0, 1].set_title('Model Accuracy')
    axes[0, 1].set_xlabel('Epoch')
    axes[0, 1].set_ylabel('Accuracy')
    axes[0, 1].legend()
    axes[0, 1].grid(True)
    
    # Dice Coefficient
    axes[0, 2].plot(history.history['dice_coefficient'], label='Training Dice')
    axes[0, 2].plot(history.history['val_dice_coefficient'], label='Validation Dice')
    axes[0, 2].set_title('Dice Coefficient')
    axes[0, 2].set_xlabel('Epoch')
    axes[0, 2].set_ylabel('Dice Coefficient')
    axes[0, 2].legend()
    axes[0, 2].grid(True)
    
    # IoU
    axes[1, 0].plot(history.history['iou_metric'], label='Training IoU')
    axes[1, 0].plot(history.history['val_iou_metric'], label='Validation IoU')
    axes[1, 0].set_title('IoU Metric')
    axes[1, 0].set_xlabel('Epoch')
    axes[1, 0].set_ylabel('IoU')
    axes[1, 0].legend()
    axes[1, 0].grid(True)
    
    # Precision
    axes[1, 1].plot(history.history['precision'], label='Training Precision')
    axes[1, 1].plot(history.history['val_precision'], label='Validation Precision')
    axes[1, 1].set_title('Precision')
    axes[1, 1].set_xlabel('Epoch')
    axes[1, 1].set_ylabel('Precision')
    axes[1, 1].legend()
    axes[1, 1].grid(True)
    
    # Recall
    axes[1, 2].plot(history.history['recall'], label='Training Recall')
    axes[1, 2].plot(history.history['val_recall'], label='Validation Recall')
    axes[1, 2].set_title('Recall')
    axes[1, 2].set_xlabel('Epoch')
    axes[1, 2].set_ylabel('Recall')
    axes[1, 2].legend()
    axes[1, 2].grid(True)
    
    plt.tight_layout()
    plt.savefig('training_history.png', dpi=300, bbox_inches='tight')
    plt.show()

# Plot the training history
plot_training_history(history)

# Load the best model if available
if os.path.exists('best_glacier_model.h5'):
    print("Loading best model for evaluation...")
    best_model = tf.keras.models.load_model(
        'best_glacier_model.h5',
        custom_objects={
            'combined_loss': combined_loss,
            'dice_coefficient': dice_coefficient,
            'dice_loss': dice_loss,
            'iou_metric': iou_metric
        }
    )
else:
    print("Using current model for evaluation...")
    best_model = model

# Evaluate on test set
print("\n🔍 Evaluating model on test set...")
test_results = best_model.evaluate(test_generator, verbose=1)

# Print test results
print("\n📊 Test Results:")
for i, metric_name in enumerate(best_model.metrics_names):
    print(f"{metric_name}: {test_results[i]:.4f}")

def visualize_predictions(model, generator, num_samples=6):
    """Visualize model predictions"""
    
    # Get a batch of test data
    batch_x, batch_y = generator[0]
    
    # Make predictions
    predictions = model.predict(batch_x)
    
    # Create visualization
    fig, axes = plt.subplots(3, num_samples, figsize=(20, 12))
    
    for i in range(min(num_samples, len(batch_x))):
        # Original image
        axes[0, i].imshow(batch_x[i])
        axes[0, i].set_title(f'Original Image {i+1}')
        axes[0, i].axis('off')
        
        # Ground truth mask
        axes[1, i].imshow(batch_y[i].squeeze(), cmap='gray')
        axes[1, i].set_title(f'Ground Truth {i+1}')
        axes[1, i].axis('off')
        
        # Predicted mask
        pred_mask = (predictions[i].squeeze() > 0.5).astype(np.float32)
        axes[2, i].imshow(pred_mask, cmap='gray')
        axes[2, i].set_title(f'Prediction {i+1}')
        axes[2, i].axis('off')
    
    plt.tight_layout()
    plt.savefig('predictions_visualization.png', dpi=300, bbox_inches='tight')
    plt.show()

# Visualize predictions
print("🎨 Visualizing model predictions...")
visualize_predictions(best_model, test_generator, num_samples=6)

# Save the final model
model_save_path = 'glacier_detection_model_final.h5'
best_model.save(model_save_path)
print(f"✅ Model saved to {model_save_path}")

# Save training history
history_save_path = 'training_history.pickle'
with open(history_save_path, 'wb') as f:
    pickle.dump(history.history, f)
print(f"✅ Training history saved to {history_save_path}")

# Print final summary
print("\n🎉 Training Complete! Summary:")
print(f"📁 Dataset: {len(matching_pairs)} image-mask pairs")
print(f"🏋️  Training samples: {len(train_pairs)}")
print(f"✅ Validation samples: {len(val_pairs)}")
print(f"🧪 Test samples: {len(test_pairs)}")
print(f"⏱️  Training time: {training_duration/3600:.2f} hours")
print(f"🎯 Best validation Dice: {max(history.history['val_dice_coefficient']):.4f}")
print(f"💾 Model saved: {model_save_path}")

# System resource usage
memory_usage = psutil.virtual_memory().percent
print(f"\n💻 System Resources:")
print(f"Memory usage: {memory_usage:.1f}%")
if gpu_available:
    print(f"GPU training: Enabled")
else:
    print(f"GPU training: Disabled (CPU only)")

print("\n🎯 Script completed successfully!")