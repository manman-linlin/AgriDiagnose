import json
from pathlib import Path
import torch
from PIL import Image
from torch.utils.data import ConcatDataset, DataLoader, Dataset, Subset
from torchvision import datasets, transforms


IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)
IMG_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


class ContributedImageDataset(Dataset):
    def __init__(self, samples, transform=None):
        self.samples = samples
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        path, target = self.samples[index]
        image = Image.open(path).convert("RGB")
        if self.transform:
            image = self.transform(image)
        return image, target


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


def _contribution_class_name(record: dict) -> str:
    if record.get("mode") == "extend":
        return (record.get("existing_class") or "").strip()
    crop = (record.get("crop_name") or "").strip()
    disease = (record.get("disease_name") or "").strip()
    if crop and disease:
        return f"{crop}___{disease}"
    return ""


def _load_contributed_samples(model_dir: Path, class_to_idx: dict, status: str = "approved"):
    index_path = model_dir / "Data" / "contributed" / "contributions.json"
    if not index_path.exists():
        return []

    with index_path.open("r", encoding="utf-8") as f:
        records = json.load(f)

    accepted_statuses = None if status == "all" else {status}
    samples = []
    for record in records:
        if accepted_statuses is not None and record.get("status") not in accepted_statuses:
            continue
        class_name = _contribution_class_name(record)
        if not class_name:
            continue
        target = class_to_idx.setdefault(class_name, len(class_to_idx))
        for rel_path in record.get("image_paths", []):
            path = model_dir / rel_path
            if path.is_file() and path.suffix.lower() in IMG_EXTENSIONS:
                samples.append((path, target))
    return samples


def _split_samples(samples, val_ratio: float, seed: int):
    if len(samples) < 2:
        return samples, []
    indices = torch.randperm(len(samples), generator=torch.Generator().manual_seed(seed)).tolist()
    val_len = max(1, int(len(samples) * val_ratio))
    val_indices = set(indices[-val_len:])
    train_samples = [sample for i, sample in enumerate(samples) if i not in val_indices]
    val_samples = [sample for i, sample in enumerate(samples) if i in val_indices]
    return train_samples, val_samples


def build_datasets(
    data_root,
    image_size: int,
    val_ratio: float = 0.2,
    seed: int = 42,
    include_contributed: bool = False,
    contributed_status: str = "approved",
):
    data_root = Path(data_root)
    train_tf, val_tf = build_transforms(image_size)

    if not data_root.exists():
        raise FileNotFoundError(f"Data root not found: {data_root}")

    if _has_train_val_split(data_root):
        train_dataset = datasets.ImageFolder(data_root / "train", transform=train_tf)
        val_dataset = datasets.ImageFolder(data_root / "val", transform=val_tf)
        class_to_idx = dict(train_dataset.class_to_idx)
        contributed_samples = []
        if include_contributed:
            contributed_samples = _load_contributed_samples(data_root.parents[3], class_to_idx, contributed_status)
        classes = [name for name, _ in sorted(class_to_idx.items(), key=lambda item: item[1])]
        if contributed_samples:
            train_samples, val_samples = _split_samples(contributed_samples, val_ratio, seed)
            train_parts = [train_dataset]
            val_parts = [val_dataset]
            if train_samples:
                train_parts.append(ContributedImageDataset(train_samples, transform=train_tf))
            if val_samples:
                val_parts.append(ContributedImageDataset(val_samples, transform=val_tf))
            train_dataset = ConcatDataset(train_parts) if len(train_parts) > 1 else train_dataset
            val_dataset = ConcatDataset(val_parts) if len(val_parts) > 1 else val_dataset
        return train_dataset, val_dataset, classes

    full_train = datasets.ImageFolder(data_root, transform=train_tf)
    full_val = datasets.ImageFolder(data_root, transform=val_tf)
    train_indices, val_indices = _split_indices(len(full_train), val_ratio, seed)
    train_dataset = Subset(full_train, train_indices)
    val_dataset = Subset(full_val, val_indices)
    class_to_idx = dict(full_train.class_to_idx)
    contributed_samples = []
    if include_contributed:
        contributed_samples = _load_contributed_samples(data_root.parents[3], class_to_idx, contributed_status)
    classes = [name for name, _ in sorted(class_to_idx.items(), key=lambda item: item[1])]
    if contributed_samples:
        train_samples, val_samples = _split_samples(contributed_samples, val_ratio, seed)
        train_parts = [train_dataset]
        val_parts = [val_dataset]
        if train_samples:
            train_parts.append(ContributedImageDataset(train_samples, transform=train_tf))
        if val_samples:
            val_parts.append(ContributedImageDataset(val_samples, transform=val_tf))
        train_dataset = ConcatDataset(train_parts) if len(train_parts) > 1 else train_dataset
        val_dataset = ConcatDataset(val_parts) if len(val_parts) > 1 else val_dataset
    return train_dataset, val_dataset, classes


def build_dataloaders(
    data_root,
    image_size: int,
    batch_size: int,
    val_ratio: float = 0.2,
    num_workers: int = 4,
    seed: int = 42,
    include_contributed: bool = False,
    contributed_status: str = "approved",
):
    train_dataset, val_dataset, classes = build_datasets(
        data_root=data_root,
        image_size=image_size,
        val_ratio=val_ratio,
        seed=seed,
        include_contributed=include_contributed,
        contributed_status=contributed_status,
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

