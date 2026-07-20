"""
将 PlantVillage color 数据集按类别分层划分为 train/val (8:2)。

划分策略：
- 每类 80% 归入 train，20% 归入 val
- 固定种子 seed=42，保证可复现
- 文件采用 move（而非 copy），不额外占用磁盘空间

输出结构：
    color/
      train/
        Apple___Apple_scab/
        Apple___Black_rot/
        ...
      val/
        Apple___Apple_scab/
        Apple___Black_rot/
        ...
"""

import random
import shutil
from pathlib import Path

# ── 配置 ──────────────────────────────────────────────
DATA_ROOT = Path(__file__).resolve().parent / "Data" / "data" / "raw" / "color"
VAL_RATIO = 0.2
SEED = 42

# ── 主流程 ────────────────────────────────────────────
def main():
    random.seed(SEED)

    train_root = DATA_ROOT / "train"
    val_root = DATA_ROOT / "val"

    # 如果已经划分过，跳过
    if train_root.is_dir() and val_root.is_dir():
        print("[跳过] train/ 和 val/ 已存在，如需重新划分请先手动删除这两个目录。")
        return

    classes = sorted(
        d.name for d in DATA_ROOT.iterdir() if d.is_dir() and d.name not in ("train", "val")
    )
    print(f"发现 {len(classes)} 个类别")

    total_train = 0
    total_val = 0

    for cls in classes:
        cls_dir = DATA_ROOT / cls
        files = sorted(cls_dir.iterdir())  # 排序保证可复现
        # 仅保留图片文件
        files = [f for f in files if f.suffix.lower() in (".jpg", ".jpeg", ".png")]
        random.shuffle(files)

        n_val = max(1, int(len(files) * VAL_RATIO))
        val_files = files[:n_val]
        train_files = files[n_val:]

        # 创建目标目录
        (train_root / cls).mkdir(parents=True, exist_ok=True)
        (val_root / cls).mkdir(parents=True, exist_ok=True)

        # 移动文件
        for f in train_files:
            shutil.move(str(f), str(train_root / cls / f.name))
        for f in val_files:
            shutil.move(str(f), str(val_root / cls / f.name))

        total_train += len(train_files)
        total_val += len(val_files)
        print(f"  {cls}: train={len(train_files)}, val={len(val_files)}")

    print(f"\n[完成] 划分完成: train={total_train}, val={total_val}")
    print(f"   训练集比例: {total_train / (total_train + total_val):.1%}")


if __name__ == "__main__":
    main()
