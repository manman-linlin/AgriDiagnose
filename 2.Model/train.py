from pathlib import Path

import torch
import torch.nn as nn
from torch.cuda.amp import GradScaler, autocast
from tqdm import tqdm

from config import TrainConfig
from data import build_dataloaders
from model import build_model
from utils import (
    accuracy_top1,
    ensure_dir,
    load_class_names,
    per_class_accuracy,
    save_checkpoint,
    save_json,
    set_seed,
)


def freeze_backbone(model: nn.Module):
    for name, param in model.named_parameters():
        if "head" not in name and "classifier" not in name:
            param.requires_grad = False


def unfreeze_all(model: nn.Module):
    for param in model.parameters():
        param.requires_grad = True


def evaluate(model, loader, criterion, device, num_classes):
    model.eval()
    total_loss = 0.0
    steps = 0
    all_preds = []
    all_targets = []
    with torch.no_grad():
        for images, targets in loader:
            images = images.to(device)
            targets = targets.to(device)
            logits = model(images)
            loss = criterion(logits, targets)
            total_loss += loss.item()
            all_preds.append(torch.argmax(logits, dim=1).cpu())
            all_targets.append(targets.cpu())
            steps += 1
    all_preds = torch.cat(all_preds)
    all_targets = torch.cat(all_targets)
    avg_loss = total_loss / max(1, steps)
    overall_acc = (all_preds == all_targets).float().mean().item()
    per_cls = per_class_accuracy(all_preds, all_targets, num_classes)
    return avg_loss, overall_acc, per_cls


def train():
    cfg = TrainConfig()
    set_seed(cfg.seed)
    ensure_dir(cfg.output_dir)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_loader, val_loader, classes = build_dataloaders(
        data_root=cfg.data_root,
        image_size=cfg.image_size,
        batch_size=cfg.batch_size,
        val_ratio=cfg.val_ratio,
        num_workers=cfg.num_workers,
        seed=cfg.seed,
    )

    # 加载中英文对照
    labels_json = Path(cfg.data_root).parent.parent.parent / "class_labels.json"
    cn_map = load_class_names(str(labels_json))

    model = build_model(
        model_name=cfg.model_name,
        num_classes=len(classes),
        pretrained=cfg.pretrained,
        drop_rate=cfg.dropout,
        drop_path_rate=cfg.drop_path_rate,
    ).to(device)

    if cfg.freeze_backbone:
        freeze_backbone(model)

    criterion = nn.CrossEntropyLoss(label_smoothing=cfg.label_smoothing)
    optimizer = torch.optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=cfg.learning_rate,
        weight_decay=cfg.weight_decay,
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=cfg.epochs)
    scaler = GradScaler(enabled=cfg.amp and device.type == "cuda")

    best_acc = 0.0
    history = []

    for epoch in range(cfg.epochs):
        if cfg.freeze_backbone and epoch == cfg.freeze_epochs:
            unfreeze_all(model)
            optimizer = torch.optim.AdamW(
                model.parameters(),
                lr=cfg.learning_rate * 0.1,
                weight_decay=cfg.weight_decay,
            )
            scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=cfg.epochs - epoch)

        model.train()
        running_loss = 0.0
        running_acc = 0.0
        steps = 0

        loop = tqdm(train_loader, desc=f"Epoch {epoch + 1}/{cfg.epochs}")
        for images, targets in loop:
            images = images.to(device)
            targets = targets.to(device)
            optimizer.zero_grad(set_to_none=True)

            with autocast(enabled=scaler.is_enabled()):
                logits = model(images)
                loss = criterion(logits, targets)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            running_loss += loss.item()
            running_acc += accuracy_top1(logits.detach(), targets)
            steps += 1
            loop.set_postfix(
                loss=running_loss / steps,
                acc=running_acc / steps,
            )

        val_loss, val_acc, per_cls = evaluate(model, val_loader, criterion, device, len(classes))
        scheduler.step()

        # 逐类准确率（仅打印低于 95% 或最佳/最差的 5 类）
        cls_lines = []
        for idx, acc in per_cls:
            en = classes[idx]
            cn = cn_map.get(en, en)
            cls_lines.append((acc, f"  {cn} ({en}): {acc:.1%}"))
        cls_lines.sort(key=lambda x: x[0])

        record = {
            "epoch": epoch + 1,
            "train_loss": running_loss / max(1, steps),
            "train_acc": running_acc / max(1, steps),
            "val_loss": val_loss,
            "val_acc": val_acc,
            "per_class_acc": {classes[i]: round(acc, 4) for i, acc in per_cls},
        }
        history.append(record)

        if val_acc > best_acc:
            best_acc = val_acc
            save_checkpoint(
                {
                    "model_name": cfg.model_name,
                    "state_dict": model.state_dict(),
                    "classes": classes,
                    "image_size": cfg.image_size,
                    "best_acc": best_acc,
                },
                Path(cfg.output_dir) / cfg.checkpoint_name,
            )

        print(record)
        print(f"  ---- 逐类准确率 (最差5 / 最佳5) ----")
        for _, line in cls_lines[:5]:
            print(line)
        if len(cls_lines) > 10:
            print(f"  ... (省略中间 {len(cls_lines) - 10} 类) ...")
        for _, line in cls_lines[-5:]:
            print(line)
        print()

    save_json(history, Path(cfg.output_dir) / "history.json")
    save_json({"classes": classes, "best_acc": best_acc}, Path(cfg.output_dir) / "meta.json")


if __name__ == "__main__":
    train()

