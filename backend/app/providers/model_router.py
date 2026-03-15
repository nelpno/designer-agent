from app.config import get_settings

# Model routing rules
MODEL_ROUTING = {
    # Text-heavy → Nano Banana Pro (best text rendering)
    "logo": {"primary": "IMAGE_MODEL_TEXT", "fallback": "IMAGE_MODEL_FAST"},
    "ad_creative_with_text": {"primary": "IMAGE_MODEL_TEXT", "fallback": "IMAGE_MODEL_PHOTO"},
    "banner_with_cta": {"primary": "IMAGE_MODEL_TEXT", "fallback": "IMAGE_MODEL_PHOTO"},
    "presentation_slide": {"primary": "IMAGE_MODEL_TEXT", "fallback": "IMAGE_MODEL_FAST"},

    # Photography → FLUX.2 Pro
    "product_shot": {"primary": "IMAGE_MODEL_PHOTO", "fallback": "IMAGE_MODEL_TEXT"},
    "lifestyle_photo": {"primary": "IMAGE_MODEL_PHOTO", "fallback": "IMAGE_MODEL_FLEX"},
    "mockup": {"primary": "IMAGE_MODEL_PHOTO", "fallback": "IMAGE_MODEL_TEXT"},

    # General → Nano Banana 2 (fast, good cost)
    "social_post": {"primary": "IMAGE_MODEL_FAST", "fallback": "IMAGE_MODEL_FLEX"},
    "illustration": {"primary": "IMAGE_MODEL_TEXT", "fallback": "IMAGE_MODEL_FLEX"},
    "brand_material": {"primary": "IMAGE_MODEL_TEXT", "fallback": "IMAGE_MODEL_PHOTO"},

    # Carousel → text-capable model (slides typically have text)
    "carousel": {"primary": "IMAGE_MODEL_TEXT", "fallback": "IMAGE_MODEL_FAST"},
}

# Format presets (width x height → aspect ratio)
FORMAT_PRESETS = {
    "1080x1080": {"aspect_ratio": "1:1", "image_size": "1K"},
    "1200x628": {"aspect_ratio": "16:9", "image_size": "1K"},  # closest standard
    "1080x1920": {"aspect_ratio": "9:16", "image_size": "1K"},
    "1200x1200": {"aspect_ratio": "1:1", "image_size": "2K"},
    "1920x1080": {"aspect_ratio": "16:9", "image_size": "2K"},
    "2160x3840": {"aspect_ratio": "9:16", "image_size": "4K"},
    "3840x2160": {"aspect_ratio": "16:9", "image_size": "4K"},
}


def select_model(art_type: str, has_significant_text: bool) -> str:
    """Select the best model for the given art type."""
    settings = get_settings()

    # Text-heavy content always goes to Nano Banana Pro
    if has_significant_text:
        return settings.IMAGE_MODEL_TEXT

    rule = MODEL_ROUTING.get(art_type, {"primary": "IMAGE_MODEL_FAST", "fallback": "IMAGE_MODEL_FLEX"})
    model_attr = rule["primary"]
    return getattr(settings, model_attr)


def get_fallback_model(art_type: str) -> str:
    """Get fallback model for the given art type."""
    settings = get_settings()
    rule = MODEL_ROUTING.get(art_type, {"primary": "IMAGE_MODEL_FAST", "fallback": "IMAGE_MODEL_FLEX"})
    model_attr = rule["fallback"]
    return getattr(settings, model_attr)


# Aspect ratio label → default config (used when format is a ratio like "1:1", "9:16")
ASPECT_RATIO_DEFAULTS = {
    "1:1": {"aspect_ratio": "1:1", "image_size": "1K"},
    "9:16": {"aspect_ratio": "9:16", "image_size": "1K"},
    "16:9": {"aspect_ratio": "16:9", "image_size": "1K"},
    "4:5": {"aspect_ratio": "4:5", "image_size": "1K"},
    "4:3": {"aspect_ratio": "4:3", "image_size": "1K"},
    "3:4": {"aspect_ratio": "3:4", "image_size": "1K"},
}


def get_format_config(format_str: str, custom_width: int | None = None, custom_height: int | None = None) -> dict:
    """Get aspect ratio and image size from format string or custom dimensions."""
    if format_str in FORMAT_PRESETS:
        return FORMAT_PRESETS[format_str]

    # Support aspect ratio labels directly (e.g. "1:1", "9:16")
    if format_str in ASPECT_RATIO_DEFAULTS:
        return ASPECT_RATIO_DEFAULTS[format_str]

    if custom_width and custom_height:
        # Determine closest aspect ratio
        ratio = custom_width / custom_height
        if abs(ratio - 1.0) < 0.1:
            ar = "1:1"
        elif ratio > 1.5:
            ar = "16:9"
        elif ratio < 0.67:
            ar = "9:16"
        elif ratio > 1.2:
            ar = "4:3"
        elif ratio < 0.83:
            ar = "3:4"
        else:
            ar = "1:1"

        # Determine image size
        max_dim = max(custom_width, custom_height)
        if max_dim <= 512:
            size = "0.5K"
        elif max_dim <= 1024:
            size = "1K"
        elif max_dim <= 2048:
            size = "2K"
        else:
            size = "4K"

        return {"aspect_ratio": ar, "image_size": size}

    return {"aspect_ratio": "1:1", "image_size": "1K"}
