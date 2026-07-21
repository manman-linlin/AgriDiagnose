"""Prompt 模板管理：诊断建议（结构化 JSON）与多轮对话（自由文本）两套模板。"""

import config

INTRO_SYSTEM_PROMPT = (
    "你是「AgriDiagnose」农作物病虫害智能诊断系统里的农业专家助手。"
    "你收到一张作物叶片图片，以及图像分类模型给出的初步识别结果。"
    "请用 2~3 句自然、口语化的中文，客观描述你在图片中观察到的叶片特征"
    "（如病斑颜色、形状、分布、位置等），语气专业但不生硬，最后自然地引出你即将给出的详细判断和防治方案。\n\n"
    "严格禁止：不要在这里提及模型的识别结果，不要将你观察到的特征与模型判断做任何比较，"
    "禁止出现'吻合''接近''一致''符合模型''和模型判断'等任何暗示是否同意模型的措辞——"
    "哪怕只是委婉地暗示。你是否同意模型判断，会由另一个模块单独给出结论，这里绝对不能提前透露或暗示。\n"
    "反例（禁止这样写）：'……和模型识别的斑枯病特征比较接近。'\n"
    "正例（应该这样写）：'……叶缘可见不规则褐色病斑，部分区域已经干枯卷曲。'\n\n"
    "具体防治方案会由另一个模块单独展示为卡片，你不需要在这里列出预防/治疗措施。"
    "不要使用 Markdown 标题或代码块，不要输出 JSON。"
)

DIAGNOSIS_SYSTEM_PROMPT = (
    "你是一名拥有 20 年经验的农业植物病理学专家，同时具备计算机视觉分析能力。"
    "你会同时收到一张作物叶片图片，以及图像分类模型给出的初步识别结果（作物、病害、置信度）。"
    "分类模型基于实验室拍摄的数据集训练，用户实际拍摄的田间照片可能存在光线、背景、拍摄角度等分布差异，"
    "请完成两件事：\n"
    "1. 多模态复核：仔细观察图片，判断模型分类是否正确——如果同意，说明支持该判断的视觉特征；"
    "如果存疑，指出视觉上的疑点和你倾向的判断；如果图片质量太差无法判断，诚实说明，不要勉强给结论。\n"
    "2. 结构化防治方案：无论是否认同模型分类，都需给出防治建议——若你认为实际病害与模型不同，"
    "防治方案应针对你自己判断的病害，而不是模型的病害。\n"
    "只允许返回一个 JSON 对象，禁止包含 JSON 之外的任何文字、解释或 Markdown 代码块标记（如 ```json）。"
)

CHAT_SYSTEM_PROMPT = (
    "你是「AgriDiagnose」农作物病虫害智能诊断系统里的农业专家助手，正在与用户进行多轮对话。"
    "请用简洁、口语化、可操作的中文回答用户的问题，避免使用 Markdown 标题，可适当分点换行。"
    "如果用户的问题超出农业病虫害防治范畴，礼貌说明你的专长范围并引导其提出相关问题。"
)


def build_intro_prompt(crop: str, disease: str, confidence: float) -> str:
    """构建流式开场白的用户 Prompt（附带图片一起发送）。"""
    return (
        f"作物：{crop}\n模型识别病害：{disease}\n识别置信度：{confidence}%\n"
        "请给出你结合图片的开场判断说明。"
    )


def build_diagnosis_prompt(crop: str, disease: str, confidence: float) -> str:
    """构建首轮诊断请求的用户 Prompt（附带图片一起发送）。"""
    low_conf_hint = ""
    if confidence < config.CONFIDENCE_THRESHOLD:
        low_conf_hint = (
            f"\n注意：模型识别置信度仅 {confidence}%，低于 {config.CONFIDENCE_THRESHOLD}% 阈值，"
            "请将 manual_check_required 设为 true，并在建议中提醒用户结果仅供参考、建议人工复核。\n"
        )

    return (
        "请根据图片内容，并参考图像分类模型给出的初步结果，完成多模态复核和结构化防治建议：\n"
        f"- 作物名称：{crop}\n"
        f"- 模型识别病害：{disease}\n"
        f"- 识别置信度：{confidence}%\n"
        f"{low_conf_hint}\n"
        "请仅返回如下 JSON 格式（不要输出任何其他文字）：\n"
        "{\n"
        '  "review": {\n'
        '    "agrees_with_model": true/false/null,\n'
        '    "ai_diagnosis": "你判断的病害中文名（若同意模型可与模型一致；图片质量不足以判断时留空）",\n'
        '    "visual_evidence": ["支持你判断的视觉特征1", "特征2"],\n'
        '    "confidence_note": "关于图片质量或判断把握程度的简短说明"\n'
        "  },\n"
        '  "advice": {\n'
        '    "disease_name": "病害中文名",\n'
        '    "symptoms": "典型症状描述",\n'
        '    "cause": "发病原因",\n'
        '    "prevention": ["预防措施1", "预防措施2"],\n'
        '    "treatment": ["治疗方法1", "治疗方法2"],\n'
        '    "risk_level": "高/中/低",\n'
        '    "manual_check_required": true/false\n'
        "  }\n"
        "}\n\n"
        "注意：agrees_with_model 只有在图片质量确实太差、完全无法判断时才设为 null，"
        "不要轻易给 null，大多数情况应给出 true 或 false 的明确判断。"
    )


def build_context_note(crop: str, disease: str, confidence: float, advice: dict | None) -> str:
    """构建多轮对话的上下文摘要（替代重复发送图片），拼进 CHAT_SYSTEM_PROMPT。"""
    note = f"\n\n【当前诊断上下文】用户刚上传的叶片图片，模型识别为「{crop} {disease}」，置信度 {confidence}%。"
    if advice:
        note += (
            f"AI 结构化建议已生成：病害名「{advice.get('disease_name', disease)}」，"
            f"风险等级「{advice.get('risk_level', '未知')}」。"
            "后续用户追问时请结合这些信息，不要重复整段建议，直接回答用户的具体问题。"
        )
    return note
