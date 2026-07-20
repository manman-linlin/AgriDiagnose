import argparse
from pathlib import Path

import torch
from PIL import Image
from torchvision import transforms

from config import InferConfig
from data import IMAGENET_MEAN, IMAGENET_STD
from model import build_model
from utils import load_checkpoint


def build_infer_transform(image_size: int):
    return transforms.Compose(
        [
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )


def predict(image_path, checkpoint_path, topk=3):
    checkpoint = load_checkpoint(checkpoint_path, map_location="cpu")
    classes = checkpoint["classes"]
    image_size = checkpoint.get("image_size", InferConfig.image_size)
    model_name = checkpoint.get("model_name", "convnext_tiny")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_model(
        model_name=model_name,
        num_classes=len(classes),
        pretrained=False,
    )
    model.load_state_dict(checkpoint["state_dict"])
    model.to(device)
    model.eval()

    image = Image.open(image_path).convert("RGB")
    tensor = build_infer_transform(image_size)(image).unsqueeze(0).to(device)

    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1)[0]
        scores, indices = torch.topk(probs, k=min(topk, len(classes)))

    return [
        {"label": classes[idx.item()], "score": round(score.item(), 6)}
        for score, idx in zip(scores, indices)
    ]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, help="Path to image file.")
    parser.add_argument(
        "--checkpoint",
        default="./2.Model/Weights/convnext_tiny_best.pth",
        help="Path to trained checkpoint.",
    )
    parser.add_argument("--topk", type=int, default=3)
    args = parser.parse_args()

    results = predict(
        image_path=Path(args.image),
        checkpoint_path=Path(args.checkpoint),
        topk=args.topk,
    )
    for item in results:
        print(f"{item['label']}: {item['score']:.4f}")


if __name__ == "__main__":
    main()

