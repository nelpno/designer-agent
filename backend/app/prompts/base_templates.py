# Base quality modifiers that get appended to all prompts
QUALITY_MODIFIERS = "professional quality, high resolution, detailed, sharp focus"

# Negative prompt defaults
DEFAULT_NEGATIVE = "blurry, low quality, distorted, watermark, text artifacts, deformed"

# Templates per art type — {placeholders} get filled by PromptEngineerAgent
PROMPT_TEMPLATES = {
    "logo": {
        "template": "Professional logo design for {brand_name}. {style} style. {description}. Clean vector-like design, {color_guidance}. {QUALITY_MODIFIERS}",
        "negative": "photorealistic, photograph, blurry, complex background, {DEFAULT_NEGATIVE}",
    },
    "ad_creative_with_text": {
        "template": "Advertisement creative for {platform}. {description}. Text overlay: \"{headline}\". {style} aesthetic. {color_guidance}. {composition}. {QUALITY_MODIFIERS}",
        "negative": "cluttered, hard to read text, {DEFAULT_NEGATIVE}",
    },
    "banner_with_cta": {
        "template": "Digital banner advertisement. {description}. Call to action: \"{cta_text}\". {style} design. {color_guidance}. {composition}. {QUALITY_MODIFIERS}",
        "negative": "cluttered layout, illegible text, {DEFAULT_NEGATIVE}",
    },
    "social_post": {
        "template": "Social media post for {platform}. {description}. {style} aesthetic. {color_guidance}. {composition}. Engaging and scroll-stopping. {QUALITY_MODIFIERS}",
        "negative": "boring, generic, {DEFAULT_NEGATIVE}",
    },
    "product_shot": {
        "template": "Professional product photography. {description}. {style} lighting. {color_guidance}. {composition}. Studio quality. {QUALITY_MODIFIERS}",
        "negative": "amateur, poor lighting, {DEFAULT_NEGATIVE}",
    },
    "lifestyle_photo": {
        "template": "Lifestyle photography. {description}. {style} mood. Natural lighting. {color_guidance}. {composition}. {QUALITY_MODIFIERS}",
        "negative": "staged, artificial, {DEFAULT_NEGATIVE}",
    },
    "mockup": {
        "template": "Realistic product mockup. {description}. {style} setting. {color_guidance}. Professional presentation. {QUALITY_MODIFIERS}",
        "negative": "flat, 2D, unrealistic, {DEFAULT_NEGATIVE}",
    },
    "illustration": {
        "template": "Digital illustration. {description}. {style} art style. {color_guidance}. {composition}. {QUALITY_MODIFIERS}",
        "negative": "photorealistic, photograph, {DEFAULT_NEGATIVE}",
    },
    "presentation_slide": {
        "template": "Presentation slide background. {description}. {style} corporate design. {color_guidance}. Clean layout with space for text. {QUALITY_MODIFIERS}",
        "negative": "busy, cluttered, {DEFAULT_NEGATIVE}",
    },
    "brand_material": {
        "template": "Brand marketing material. {description}. {style} aesthetic consistent with {brand_name}. {color_guidance}. {composition}. {QUALITY_MODIFIERS}",
        "negative": "off-brand, inconsistent, {DEFAULT_NEGATIVE}",
    },
}

# Default template for unknown art types
DEFAULT_TEMPLATE = {
    "template": "{description}. {style} style. {color_guidance}. {composition}. {QUALITY_MODIFIERS}",
    "negative": DEFAULT_NEGATIVE,
}
