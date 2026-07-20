import json
import os
import random
from pathlib import Path

import numpy as np
import torch


def ensure_dir(path):
    Path(path).mkdir(parents=True, exist_ok=True)


def set_seed(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def accuracy_top1(logits, targets):
    preds = torch.argmax(logits, dim=1)
    return (preds == targets).float().mean().item()


def per_class_accuracy(all_preds, all_targets, num_classes):
    """计算每个类别的准确率，返回 list of (class_idx, acc)."""
    correct = torch.zeros(num_classes)
    total = torch.zeros(num_classes)
    for p, t in zip(all_preds, all_targets):
        total[t] += 1
        if p == t:
            correct[t] += 1
    total = total.clamp(min=1)
    return [(i, (correct[i] / total[i]).item()) for i in range(num_classes)]


def load_class_names(labels_json):
    """从中英文对照 JSON 加载 {en: cn} 映射。"""
    path = Path(labels_json)
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return {item["en"]: item["cn"] for item in data}


def save_json(data, path):
    path = Path(path)
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_json(path):
    with Path(path).open("r", encoding="utf-8") as f:
        return json.load(f)


def save_checkpoint(state, path):
    path = Path(path)
    ensure_dir(path.parent)
    torch.save(state, path)


def load_checkpoint(path, map_location="cpu"):
    return torch.load(path, map_location=map_location)

