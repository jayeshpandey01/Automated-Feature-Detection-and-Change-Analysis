"""
Dataset Explorer for PNG Glacier Dataset
This script helps you visualize and understand your glacier-lake-dataset
"""

import os
import numpy as np
import matplotlib.pyplot as plt
import cv2
import glob
from collections import Counter

# Dataset paths
DATASET_PATH = "glacier-lake-dataset"
IMAGES_PATH = os.path.join(DATASET_PATH, "images")
MASKS_PATH = os.path.join(DATASET_PATH, "masks")

def explore_dataset_structure():
    """Explore the basic structure of the dataset"""
    
    print("=" * 60)
    print("GLACIER DATASET EXPLORER")
    print("=" * 60)
    
    # Check if paths exist
    if not os.path.exists(IMAGES_PATH):
        print(f"❌ Images path not found: {IMAGES_PATH}")
        return False
    
    if not os.path.exists(MASKS_PATH):
        print(f"❌ Masks path not found: {MASKS_PATH}")
        return False
    
    # Get file lists
    image_files = sorted(glob.glob(os.path.join(IMAGES_PATH, "*.png")))
    mask_files = sorted(glob.glob(os.path.join(MASKS_PATH, "*.png")))
    
    print(f"✓ Dataset found at: {DATASET_PATH}")
    print(f"✓ Images: {len(image_files)} files")
    print(f"✓ Masks: {len(mask_files)} files")
    
    # Check matching pairs
    image_names = set([os.path.basename(f) for f in image_files])
    mask_names = set([os.path.basename(f) for f in mask_files])
    matching_names = image_names & mask_names
    
    print(f"✓ Matching pairs: {len(matching_names)}")
    
    if len(matching_names) != len(image_files):
        missing_masks = image_names - mask_names
        missing_images = mask_names - image_names
        if missing_masks:
            print(f"⚠️  Images without masks: {len(missing_masks)}")
        if missing_images:
            print(f"⚠️  Masks without images: {len(missing_images)}")
    
    return len(matching_names) > 0

def analyze_sample_data():
    """Analyze a few sample images and masks"""
    
    print("\n" + "-" * 40)
    print("SAMPLE DATA ANALYSIS")
    print("-" * 40)
    
    image_files = sorted(glob.glob(os.path.join(IMAGES_PATH, "*.png")))
    mask_files = sorted(glob.glob(os.path.join(MASKS_PATH, "*.png")))
    
    if len(image_files) == 0:
        print("No images found!")
        return
    
    # Analyze first few samples
    samples_to_check = min(5, len(image_files))
    
    for i in range(samples_to_check):
        img_path = image_files[i]
        mask_path = mask_files[i] if i < len(mask_files) else None
        
        # Load image
        img = cv2.imread(img_path)
        if img is None:
            print(f"❌ Could not load image: {img_path}")
            continue
            
        img_name = os.path.basename(img_path)
        print(f"\nSample {i+1}: {img_name}")
        print(f"  Image shape: {img.shape}")
        print(f"  Image dtype: {img.dtype}")
        print(f"  Image range: [{img.min()}, {img.max()}]")
        
        # Load mask if available
        if mask_path and os.path.exists(mask_path):
            mask = cv2.imread(mask_path, 0)  # Load as grayscale
            if mask is not None:
                print(f"  Mask shape: {mask.shape}")
                print(f"  Mask dtype: {mask.dtype}")
                print(f"  Mask unique values: {np.unique(mask)}")
                
                # Calculate glacier percentage
                glacier_pixels = np.sum(mask > 0)
                total_pixels = mask.shape[0] * mask.shape[1]
                glacier_percentage = (glacier_pixels / total_pixels) * 100
                print(f"  Glacier coverage: {glacier_percentage:.1f}%")
            else:
                print(f"  ❌ Could not load mask: {mask_path}")
        else:
            print(f"  ❌ No corresponding mask found")

def visualize_samples(n_samples=6):
    """Visualize sample images and masks"""
    
    print(f"\n" + "-" * 40)
    print(f"VISUALIZING {n_samples} SAMPLES")
    print("-" * 40)
    
    image_files = sorted(glob.glob(os.path.join(IMAGES_PATH, "*.png")))
    mask_files = sorted(glob.glob(os.path.join(MASKS_PATH, "*.png")))
    
    # Get matching pairs
    image_names = [os.path.basename(f) for f in image_files]
    mask_names = [os.path.basename(f) for f in mask_files]
    matching_names = sorted(list(set(image_names) & set(mask_names)))
    
    if len(matching_names) == 0:
        print("No matching image-mask pairs found!")
        return
    
    # Select samples
    n_samples = min(n_samples, len(matching_names))
    step = max(1, len(matching_names) // n_samples)
    selected_indices = range(0, len(matching_names), step)[:n_samples]
    
    # Create visualization
    fig, axes = plt.subplots(n_samples, 3, figsize=(12, 3*n_samples))
    if n_samples == 1:
        axes = axes.reshape(1, -1)
    
    glacier_percentages = []
    
    for i, idx in enumerate(selected_indices):
        name = matching_names[idx]
        img_path = os.path.join(IMAGES_PATH, name)
        mask_path = os.path.join(MASKS_PATH, name)
        
        # Load image and mask
        img = cv2.imread(img_path)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)  # Convert BGR to RGB
        mask = cv2.imread(mask_path, 0)
        
        # Original image
        axes[i, 0].imshow(img)
        axes[i, 0].set_title(f'Image: {name}')
        axes[i, 0].axis('off')
        
        # Mask
        axes[i, 1].imshow(mask, cmap='gray')
        axes[i, 1].set_title(f'Mask: {name}')
        axes[i, 1].axis('off')
        
        # Overlay
        overlay = img.copy()
        overlay[mask > 0] = [255, 0, 0]  # Red overlay for glacier areas
        blended = cv2.addWeighted(img, 0.7, overlay, 0.3, 0)
        axes[i, 2].imshow(blended)
        axes[i, 2].set_title(f'Overlay: {name}')
        axes[i, 2].axis('off')
        
        # Calculate statistics
        glacier_pixels = np.sum(mask > 0)
        total_pixels = mask.shape[0] * mask.shape[1]
        glacier_percentage = (glacier_pixels / total_pixels) * 100
        glacier_percentages.append(glacier_percentage)
        
        print(f"Sample {i+1} ({name}): {glacier_percentage:.1f}% glacier area")
    
    plt.tight_layout()
    plt.show()
    
    # Print statistics
    print(f"\nGlacier Coverage Statistics:")
    print(f"  Mean: {np.mean(glacier_percentages):.1f}%")
    print(f"  Std: {np.std(glacier_percentages):.1f}%")
    print(f"  Min: {np.min(glacier_percentages):.1f}%")
    print(f"  Max: {np.max(glacier_percentages):.1f}%")

def analyze_full_dataset():
    """Analyze the entire dataset for statistics"""
    
    print(f"\n" + "-" * 40)
    print("FULL DATASET ANALYSIS")
    print("-" * 40)
    
    image_files = sorted(glob.glob(os.path.join(IMAGES_PATH, "*.png")))
    mask_files = sorted(glob.glob(os.path.join(MASKS_PATH, "*.png")))
    
    # Get matching pairs
    image_names = [os.path.basename(f) for f in image_files]
    mask_names = [os.path.basename(f) for f in mask_files]
    matching_names = sorted(list(set(image_names) & set(mask_names)))
    
    print(f"Analyzing {len(matching_names)} image-mask pairs...")
    
    glacier_percentages = []
    image_shapes = []
    mask_shapes = []
    
    for name in matching_names[:50]:  # Analyze first 50 for speed
        img_path = os.path.join(IMAGES_PATH, name)
        mask_path = os.path.join(MASKS_PATH, name)
        
        # Load image and mask
        img = cv2.imread(img_path)
        mask = cv2.imread(mask_path, 0)
        
        if img is not None and mask is not None:
            image_shapes.append(img.shape)
            mask_shapes.append(mask.shape)
            
            # Calculate glacier percentage
            glacier_pixels = np.sum(mask > 0)
            total_pixels = mask.shape[0] * mask.shape[1]
            glacier_percentage = (glacier_pixels / total_pixels) * 100
            glacier_percentages.append(glacier_percentage)
    
    # Print statistics
    print(f"\nImage Statistics (first 50 samples):")
    if image_shapes:
        unique_shapes = list(set(image_shapes))
        print(f"  Unique image shapes: {unique_shapes}")
        
    if mask_shapes:
        unique_mask_shapes = list(set(mask_shapes))
        print(f"  Unique mask shapes: {unique_mask_shapes}")
    
    if glacier_percentages:
        print(f"\nGlacier Coverage Distribution:")
        print(f"  Mean: {np.mean(glacier_percentages):.2f}%")
        print(f"  Std: {np.std(glacier_percentages):.2f}%")
        print(f"  Min: {np.min(glacier_percentages):.2f}%")
        print(f"  Max: {np.max(glacier_percentages):.2f}%")
        print(f"  Median: {np.median(glacier_percentages):.2f}%")
        
        # Create histogram
        plt.figure(figsize=(10, 6))
        plt.hist(glacier_percentages, bins=20, alpha=0.7, edgecolor='black')
        plt.xlabel('Glacier Coverage (%)')
        plt.ylabel('Number of Images')
        plt.title('Distribution of Glacier Coverage in Dataset')
        plt.grid(True, alpha=0.3)
        plt.show()

def main():
    """Main function to run all analyses"""
    
    # Basic structure analysis
    dataset_ok = explore_dataset_structure()
    
    if not dataset_ok:
        print("\n❌ Dataset not found or invalid structure!")
        print("\nExpected structure:")
        print("glacier-lake-dataset/")
        print("├── images/")
        print("│   ├── image_1.png")
        print("│   ├── image_2.png")
        print("│   └── ...")
        print("└── masks/")
        print("    ├── image_1.png")
        print("    ├── image_2.png")
        print("    └── ...")
        return
    
    # Detailed analysis
    analyze_sample_data()
    
    # Visualizations
    visualize_samples(6)
    
    # Full dataset statistics
    analyze_full_dataset()
    
    print("\n" + "=" * 60)
    print("DATASET EXPLORATION COMPLETE!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. If the dataset looks good, run: python train_with_png_dataset.py")
    print("2. Training will automatically split your data into train/val/test sets")
    print("3. The model will be saved to weights/ directory after training")

if __name__ == "__main__":
    main()