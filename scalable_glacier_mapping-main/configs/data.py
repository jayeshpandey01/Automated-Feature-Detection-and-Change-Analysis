import dataloaders
import dataloaders.transformations
import h5py
import os


def initialize_datasets():
    """Initialize dataset connections when files are available"""
    global train_sampler_args, val_sampler_args
    
    if os.path.exists(train_dataset_path):
        train_sampler_args["dataset"] = h5py.File(train_dataset_path, "r")
    else:
        print(f"Warning: Train dataset not found at {train_dataset_path}")
        
    if os.path.exists(val_dataset_path):
        val_sampler_args["dataset"] = h5py.File(val_dataset_path, "r")
    else:
        print(f"Warning: Validation dataset not found at {val_dataset_path}")


# TODO: Replace these paths with actual dataset paths after downloading
# Download demo dataset from: https://bit.ly/49aVPIJ
# Or full dataset from: https://bit.ly/3UgEDgA
train_dataset_path = "output/train_dataset.h5"  # Replace with actual path
val_dataset_path = "output/val_dataset.h5"      # Replace with actual path  
test_dataset_path = "output/test_dataset.h5"    # Replace with actual path

predictions_dir = "output/predictions"  # Replace with desired output directory

n_outputs = 2
patch_size = 384
batch_size = 8

features = ["optical", "dem"]
labels = "outlines"
input_shapes = {
    "optical": (patch_size, patch_size, 6),
    "dem": (patch_size, patch_size, 2)
}

train_sampler_builder = dataloaders.RandomSampler
train_sampler_args = {
    "dataset": None,  # Will be set when dataset file exists: h5py.File(train_dataset_path, "r"), 
    "patch_size": patch_size, 
    "features": features,
    "labels": labels
}
train_plugins = [
    dataloaders.Augmentation([
        dataloaders.transformations.random_vertical_flip(),
        dataloaders.transformations.random_horizontal_flip(),
        dataloaders.transformations.random_rotation(),
        dataloaders.transformations.crop_and_scale(patch_size=patch_size)
    ])
]

val_sampler_builder = dataloaders.ConsecutiveSampler
val_sampler_args = {
    "dataset": None,  # Will be set when dataset file exists: h5py.File(val_dataset_path, "r"), 
    "patch_size": patch_size, 
    "features": features,
    "labels": labels
}
val_plugins = []
