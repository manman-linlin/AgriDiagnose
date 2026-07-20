from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent


@dataclass
class TrainConfig:
    data_root: Path = ROOT_DIR / "Data" / "data" / "raw" / "color"
    output_dir: Path = ROOT_DIR / "Weights"
    model_name: str = "convnext_tiny"
    pretrained: bool = True
    image_size: int = 224
    batch_size: int = 16
    epochs: int = 20
    learning_rate: float = 3e-4
    weight_decay: float = 1e-4
    val_ratio: float = 0.2
    num_workers: int = 4
    seed: int = 42
    amp: bool = True
    label_smoothing: float = 0.0
    dropout: float = 0.0
    drop_path_rate: float = 0.1
    freeze_backbone: bool = False
    freeze_epochs: int = 0
    checkpoint_name: str = "convnext_tiny_best.pth"


@dataclass
class InferConfig:
    image_size: int = 224
    topk: int = 3
