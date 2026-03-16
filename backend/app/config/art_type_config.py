"""
Art Type Configuration — single source of truth.

Defines which fields, formats, and behaviors each art type supports.
Frontend mirrors this in artTypeConfig.ts. Backend serves via GET /api/config/art-types.
"""

from __future__ import annotations

from typing import Any

# Field definitions per art type
ART_TYPE_CONFIG: dict[str, dict[str, Any]] = {
    "ad_creative": {
        "label": "Criativo para Ads",
        "textFields": [
            {
                "field": "headline",
                "label": "Título",
                "placeholder": "Texto principal do anúncio",
                "type": "text",
                "maxLength": 60,
            },
            {
                "field": "body_text",
                "label": "Texto",
                "placeholder": "Texto de apoio do anúncio",
                "type": "textarea",
                "maxLength": 200,
            },
            {
                "field": "cta_text",
                "label": "CTA",
                "placeholder": "ex: Compre Agora, Saiba Mais",
                "type": "text",
                "maxLength": 30,
            },
        ],
        "inclusion": "optional",
        "inclusionLabel": "Foto do produto ou pessoa",
        "allowedFormats": ["1:1", "9:16", "16:9", "4:5"],
        "defaultFormats": ["1:1"],
        "maxQuantity": 4,
        "suggestTexts": True,
    },
    "social_post": {
        "label": "Post Social",
        "textFields": [
            {
                "field": "headline",
                "label": "Título",
                "placeholder": "Texto principal do post",
                "type": "text",
                "maxLength": 60,
            },
            {
                "field": "body_text",
                "label": "Texto",
                "placeholder": "Texto de apoio",
                "type": "textarea",
                "maxLength": 200,
            },
        ],
        "inclusion": "optional",
        "inclusionLabel": "Foto do produto ou pessoa",
        "allowedFormats": ["1:1", "9:16", "4:5"],
        "defaultFormats": ["1:1"],
        "maxQuantity": 4,
        "suggestTexts": True,
    },
    "carousel": {
        "label": "Carrossel",
        "textFields": [
            {
                "field": "slides",
                "label": "Slides",
                "placeholder": "",
                "type": "slides",
            },
        ],
        "inclusion": "optional",
        "inclusionLabel": "Foto do produto ou pessoa",
        "allowedFormats": ["1:1"],
        "defaultFormats": ["1:1"],
        "maxQuantity": 2,
        "suggestTexts": True,
        "minSlides": 2,
        "maxSlides": 10,
    },
    "logo": {
        "label": "Logo",
        "textFields": [
            {
                "field": "headline",
                "label": "Texto do Logo",
                "placeholder": "Nome ou texto que aparece no logo",
                "type": "text",
                "maxLength": 40,
            },
        ],
        "inclusion": "none",
        "allowedFormats": ["1:1"],
        "defaultFormats": ["1:1"],
        "maxQuantity": 4,
        "suggestTexts": False,
    },
    "product_shot": {
        "label": "Foto de Produto",
        "textFields": [],
        "inclusion": "required",
        "inclusionLabel": "Foto do produto (obrigatório)",
        "allowedFormats": ["1:1", "4:5"],
        "defaultFormats": ["1:1"],
        "maxQuantity": 4,
        "suggestTexts": False,
    },
    "lifestyle_photo": {
        "label": "Foto Lifestyle",
        "textFields": [],
        "inclusion": "optional",
        "inclusionLabel": "Foto da pessoa ou produto",
        "allowedFormats": ["1:1", "16:9"],
        "defaultFormats": ["1:1"],
        "maxQuantity": 4,
        "suggestTexts": False,
    },
    "mockup": {
        "label": "Mockup",
        "textFields": [],
        "inclusion": "required",
        "inclusionLabel": "Arte para aplicar no mockup (obrigatório)",
        "allowedFormats": ["1:1", "16:9"],
        "defaultFormats": ["1:1"],
        "maxQuantity": 4,
        "suggestTexts": False,
    },
    "illustration": {
        "label": "Ilustração",
        "textFields": [],
        "inclusion": "none",
        "allowedFormats": ["1:1", "16:9"],
        "defaultFormats": ["1:1"],
        "maxQuantity": 4,
        "suggestTexts": False,
    },
    "presentation_slide": {
        "label": "Slide",
        "textFields": [
            {
                "field": "headline",
                "label": "Título",
                "placeholder": "Título do slide",
                "type": "text",
                "maxLength": 60,
            },
            {
                "field": "body_text",
                "label": "Texto",
                "placeholder": "Conteúdo do slide",
                "type": "textarea",
                "maxLength": 300,
            },
        ],
        "inclusion": "none",
        "allowedFormats": ["16:9"],
        "defaultFormats": ["16:9"],
        "maxQuantity": 4,
        "suggestTexts": True,
    },
    "brand_material": {
        "label": "Material de Marca",
        "textFields": [
            {
                "field": "headline",
                "label": "Título",
                "placeholder": "Texto principal",
                "type": "text",
                "maxLength": 60,
            },
            {
                "field": "body_text",
                "label": "Texto",
                "placeholder": "Texto de apoio",
                "type": "textarea",
                "maxLength": 200,
            },
        ],
        "inclusion": "none",
        "allowedFormats": ["1:1", "16:9"],
        "defaultFormats": ["1:1"],
        "maxQuantity": 4,
        "suggestTexts": True,
    },
}

# Validation limits
MAX_SLIDES = 10
MIN_SLIDES = 2
MAX_FORMATS_PER_REQUEST = 4
MAX_QUANTITY_PER_FORMAT = 4
MAX_GENERATIONS_PER_BATCH = 40


def get_art_type_config(art_type: str) -> dict[str, Any] | None:
    """Get config for a specific art type."""
    return ART_TYPE_CONFIG.get(art_type)


def get_all_configs() -> dict[str, dict[str, Any]]:
    """Get all art type configs (for API endpoint)."""
    return ART_TYPE_CONFIG


def get_text_fields(art_type: str) -> list[str]:
    """Get list of text field names for an art type."""
    config = ART_TYPE_CONFIG.get(art_type)
    if not config:
        return []
    return [f["field"] for f in config["textFields"] if f["field"] != "slides"]


def validate_formats(art_type: str, formats: list[str]) -> list[str]:
    """Validate and filter formats against allowed formats for art type.
    Returns valid formats or raises ValueError."""
    config = ART_TYPE_CONFIG.get(art_type)
    if not config:
        raise ValueError(f"Unknown art type: {art_type}")

    allowed = set(config["allowedFormats"])
    invalid = [f for f in formats if f not in allowed]
    if invalid:
        raise ValueError(
            f"Formats {invalid} not allowed for {art_type}. "
            f"Allowed: {config['allowedFormats']}"
        )

    if len(formats) > MAX_FORMATS_PER_REQUEST:
        raise ValueError(f"Max {MAX_FORMATS_PER_REQUEST} formats per request")

    return formats


def validate_slides(slides: list[dict]) -> list[dict]:
    """Validate carousel slides."""
    if len(slides) < MIN_SLIDES:
        raise ValueError(f"Carrossel precisa de no mínimo {MIN_SLIDES} slides")
    if len(slides) > MAX_SLIDES:
        raise ValueError(f"Carrossel aceita no máximo {MAX_SLIDES} slides")
    return slides
