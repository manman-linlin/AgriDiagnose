from pathlib import Path
from typing import Tuple
import torch
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, transforms


IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


def build_transforms(image_size: int):
    train_tf = transforms.Compose(
        [
            transforms.RandomResizedCrop(image_size, scale=(0.7, 1.0)),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomRotation(15),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )
    val_tf = transforms.Compose(
        [
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )
    return train_tf, val_tf


def _split_indices(length: int, val_ratio: float, seed: int):
    indices = torch.randperm(length, generator=torch.Generator().manual_seed(seed)).tolist()
    val_len = max(1, int(length * val_ratio))
    train_len = max(1, length - val_len)
    train_indices = indices[:train_len]
    val_indices = indices[train_len:]
    if not val_indices:
        val_indices = indices[-val_len:]
        train_indices = indices[:-val_len]
    return train_indices, val_indices


def _has_train_val_split(root: Path) -> bool:
    return (root / "train").is_dir() and (root / "val").is_dir()


def build_datasets(data_root, image_size: int, val_ratio: float = 0.2, seed: int = 42):
    data_root = Path(data_root)
    train_tf, val_tf = build_transforms(image_size)

    if not data_root.exists():
        raise FileNotFoundError(f"Data root not found: {data_root}")

    if _has_train_val_split(data_root):
        train_dataset = datasets.ImageFolder(data_root / "train", transform=train_tf)
        val_dataset = datasets.ImageFolder(data_root / "val", transform=val_tf)
        classes = train_dataset.classes
        return train_dataset, val_dataset, classes

    full_train = datasets.ImageFolder(data_root, transform=train_tf)
    full_val = datasets.ImageFolder(data_root, transform=val_tf)
    train_indices, val_indices = _split_indices(len(full_train), val_ratio, seed)
    train_dataset = Subset(full_train, train_indices)
    val_dataset = Subset(full_val, val_indices)
    classes = full_train.classes
    return train_dataset, val_dataset, classes


def build_dataloaders(
    data_root,
    image_size: int,
    batch_size: int,
    val_ratio: float = 0.2,
    num_workers: int = 4,
    seed: int = 42,
):
    train_dataset, val_dataset, classes = build_datasets(
        data_root=data_root,
        image_size=image_size,
        val_ratio=val_ratio,
        seed=seed,
    )
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),
    )
    return train_loader, val_loader, classes

