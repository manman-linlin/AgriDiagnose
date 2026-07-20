# Model Module

## Files

| 文件 | 说明 |
|------|------|
| `config.py` | 训练和推理配置 |
| `data.py` | 数据集加载、增强、train/val 划分 |
| `model.py` | ConvNeXt-Tiny 模型构建（timm，预训练权重） |
| `train.py` | 训练入口，每轮输出整体 + 逐类验证准确率 |
| `infer.py` | 单张图片推理 |
| `utils.py` | 工具函数（种子、指标、checkpoint 读写、中英文映射） |
| `requirements.txt` | Python 依赖 |
| `scripts/` | 工具脚本（数据划分、数据集下载） |

## Data Layout

```text
2.Model/Data/data/raw/color/
  train/
    class_1/
      xxx.JPG
    class_2/
      yyy.JPG
  val/
    class_1/
    class_2/
```

训练时自动检测 `train/` 和 `val/` 子目录。若不存在则随机划分（seed=42, 8:2）。

## Train

```bash
cd 2.Model
python train.py
```

每轮训练后输出：

```
{'epoch': 1, 'train_loss': 0.85, 'train_acc': 0.72, 'val_loss': 0.62, 'val_acc': 0.78, ...}
  ---- 逐类准确率 (最差5 / 最佳5) ----
  番茄黄化曲叶病毒病 (...): 62.3%
  柑橘黄龙病 (...): 71.5%
  ...
  苹果健康 (...): 98.2%
  草莓健康 (...): 99.1%
```

完整记录（含逐类准确率）保存到 `Weights/history.json`。

## Infer

```bash
python infer.py --image path_to_image.jpg
```

## Training Results

| 指标 | 数值 |
|------|------|
| 模型 | ConvNeXt-Tiny (timm) |
| 预训练 | ImageNet (imagenet1k-v1) |
| 训练集 | 43,456 张 |
| 验证集 | 10,849 张 |
| 类别数 | 38 |
| Epochs | 20 |
| 优化器 | AdamW (lr=3e-4, wd=1e-4) |
| 调度器 | CosineAnnealingLR |
| 混合精度 | AMP (GradScaler) |
| 最佳轮次 | Epoch 19 |
| **最佳验证准确率** | **99.80%** |
| 最终验证损失 | 0.0093 |

### 训练曲线

| Epoch | Train Loss | Train Acc | Val Loss | Val Acc |
|-------|-----------|-----------|---------|---------|
| 1 | 1.3215 | 62.52% | 0.3408 | 89.10% |
| 5 | 0.0912 | 97.03% | 0.0845 | 97.20% |
| 10 | 0.0277 | 99.12% | 0.0479 | 98.63% |
| 15 | 0.0052 | 99.83% | 0.0232 | 99.32% |
| **19** | **0.0009** | **99.98%** | **0.0095** | **99.80%** |
| 20 | 0.0007 | 99.99% | 0.0093 | 99.79% |

### 逐类准确率（Epoch 19 验证集，共 38 类）

#### 苹果 Apple

| 英文名 | 中文名 | 准确率 |
|--------|--------|--------|
| Apple___Apple_scab | 苹果黑星病 | 100% |
| Apple___Black_rot | 苹果黑腐病 | 100% |
| Apple___Cedar_apple_rust | 苹果锈病 | 100% |
| Apple___healthy | 苹果健康 | 100% |

#### 蓝莓 Blueberry

| 英文名 | 中文名 | 准确率 |
|--------|--------|--------|
| Blueberry___healthy | 蓝莓健康 | 100% |

#### 樱桃 Cherry

| 英文名 | 中文名 | 准确率 |
|--------|--------|--------|
| Cherry_(including_sour)___Powdery_mildew | 樱桃白粉病 | 100% |
| Cherry_(including_sour)___healthy | 樱桃健康 | 99.41% |

#### 玉米 Corn

| 英文名 | 中文名 | 准确率 |
|--------|--------|--------|
| Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot | 玉米灰斑病 | 92.16% |
| Corn_(maize)___Common_rust_ | 玉米锈病 | 99.58% |
| Corn_(maize)___Northern_Leaf_Blight | 玉米北方叶枯病 | 97.97% |
| Corn_(maize)___healthy | 玉米健康 | 100% |

#### 葡萄 Grape

| 英文名 | 中文名 | 准确率 |
|--------|--------|--------|
| Grape___Black_rot | 葡萄黑腐病 | 100% |
| Grape___Esca_(Black_Measles) | 葡萄黑麻疹病 | 100% |
| Grape___Leaf_blight_(Isariopsis_Leaf_Spot) | 葡萄叶枯病 | 100% |
| Grape___healthy | 葡萄健康 | 100% |

#### 柑橘 Orange

| 英文名 | 中文名 | 准确率 |
|--------|--------|--------|
| Orange___Haunglongbing_(Citrus_greening) | 柑橘黄龙病 | 100% |

#### 桃 Peach

| 英文名 | 中文名 | 准确率 |
|--------|--------|--------|
| Peach___Bacterial_spot | 桃细菌性斑点病 | 100% |
| Peach___healthy | 桃健康 | 100% |

#### 甜椒 Pepper

| 英文名 | 中文名 | 准确率 |
|--------|--------|--------|
| Pepper,_bell___Bacterial_spot | 甜椒细菌性斑点病 | 100% |
| Pepper,_bell___healthy | 甜椒健康 | 100% |

#### 马铃薯 Potato

| 英文名 | 中文名 | 准确率 |
|--------|--------|--------|
| Potato___Early_blight | 马铃薯早疫病 | 100% |
| Potato___Late_blight | 马铃薯晚疫病 | 100% |
| Potato___healthy | 马铃薯健康 | 96.67% |

#### 覆盆子 Raspberry

| 英文名 | 中文名 | 准确率 |
|--------|--------|--------|
| Raspberry___healthy | 覆盆子健康 | 100% |

#### 大豆 Soybean

| 英文名 | 中文名 | 准确率 |
|--------|--------|--------|
| Soybean___healthy | 大豆健康 | 100% |

#### 南瓜 Squash

| 英文名 | 中文名 | 准确率 |
|--------|--------|--------|
| Squash___Powdery_mildew | 南瓜白粉病 | 100% |

#### 草莓 Strawberry

| 英文名 | 中文名 | 准确率 |
|--------|--------|--------|
| Strawberry___Leaf_scorch | 草莓叶枯病 | 100% |
| Strawberry___healthy | 草莓健康 | 100% |

#### 番茄 Tomato

| 英文名 | 中文名 | 准确率 |
|--------|--------|--------|
| Tomato___Bacterial_spot | 番茄细菌性斑点病 | 99.76% |
| Tomato___Early_blight | 番茄早疫病 | 99.00% |
| Tomato___Late_blight | 番茄晚疫病 | 99.48% |
| Tomato___Leaf_Mold | 番茄叶霉病 | 100% |
| Tomato___Septoria_leaf_spot | 番茄斑枯病 | 100% |
| Tomato___Spider_mites Two-spotted_spider_mite | 番茄红蜘蛛 | 100% |
| Tomato___Target_Spot | 番茄靶斑病 | 100% |
| Tomato___Tomato_Yellow_Leaf_Curl_Virus | 番茄黄化曲叶病毒病 | 99.91% |
| Tomato___Tomato_mosaic_virus | 番茄花叶病毒病 | 100% |
| Tomato___healthy | 番茄健康 | 99.69% |

> 权重文件 `convnext_tiny_best.pth`（111.5 MB）已保存至 `Weights/` 目录，
> 训练历史见 `Weights/history.json`。

## Notes

- 模型使用 `timm` 的 `ConvNeXt-Tiny`，默认加载 ImageNet 预训练权重
- 首次运行自动下载预训练权重到 timm 缓存目录
- 训练配置在 `config.py` 中统一管理
- 离线环境下需设置 `HF_ENDPOINT=https://hf-mirror.com` 或关闭预训练

