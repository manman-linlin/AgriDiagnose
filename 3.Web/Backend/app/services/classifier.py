"""
病虫害分类服务：加载模型权重，提供单张图片预测。
模型常驻内存，避免每次请求重新加载。
"""

import json
from pathlib import Path

import torch
from PIL import Image
from torchvision import transforms

# ── 定位 2.Model 目录 ──────────────────────────────
MODEL_DIR = Path(__file__).resolve().parents[4] / "2.Model"
CHECKPOINT_PATH = MODEL_DIR / "Weights" / "convnext_tiny_best.pth"
LABELS_PATH = MODEL_DIR / "Data" / "class_labels.json"

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


class ClassifierService:
    """病虫害分类器，封装模型加载与推理。"""

    def __init__(self):
        self._model = None
        self._classes = []
        self._cn_map = {}
        self._image_size = 224
        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    @property
    def is_ready(self) -> bool:
        return self._model is not None

    def load(self):
        """加载模型权重和中英文映射。"""
        if not CHECKPOINT_PATH.exists():
            raise FileNotFoundError(
                f"模型权重未找到: {CHECKPOINT_PATH}\n请先运行 2.Model/train.py 训练模型。"
            )

        checkpoint = torch.load(CHECKPOINT_PATH, map_location=self._device)
        self._classes = checkpoint["classes"]
        self._image_size = checkpoint.get("image_size", 224)
        model_name = checkpoint.get("model_name", "convnext_tiny")

        # 动态导入 model 模块
        import sys
        sys.path.insert(0, str(MODEL_DIR))
        from model import build_model
        self._model = build_model(
            model_name=model_name,
            num_classes=len(self._classes),
            pretrained=False,
        )
        self._model.load_state_dict(checkpoint["state_dict"])
        self._model.to(self._device)
        self._model.eval()

        # 加载中文映射
        if LABELS_PATH.exists():
            with LABELS_PATH.open("r", encoding="utf-8") as f:
                data = json.load(f)
            self._cn_map = {item["en"]: item for item in data}

        print(f"[OK] 模型已加载: {model_name}, {len(self._classes)} 类, device={self._device}")

    def predict(self, image: Image.Image, topk: int = 3) -> list[dict]:
        """对 PIL Image 进行预测，返回 top-k 结果。"""
        if not self.is_ready:
            raise RuntimeError("模型未加载，请先调用 load()")

        # 预处理
        tf = transforms.Compose([
            transforms.Resize((self._image_size, self._image_size)),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ])
        tensor = tf(image.convert("RGB")).unsqueeze(0).to(self._device)

        # 推理
        with torch.no_grad():
            logits = self._model(tensor)
            probs = torch.softmax(logits, dim=1)[0]
            scores, indices = torch.topk(probs, k=min(topk, len(self._classes)))

        results = []
        for score, idx in zip(scores, indices):
            en = self._classes[idx.item()]
            info = self._cn_map.get(en, {"cn": en, "crop": "", "disease": ""})
            results.append({
                "label_en": en,
                "label_cn": info["cn"],
                "crop": info.get("crop", ""),
                "disease": info.get("disease", ""),
                "confidence": round(score.item() * 100, 2),
            })
        return results


# 全局单例
classifier = ClassifierService()
