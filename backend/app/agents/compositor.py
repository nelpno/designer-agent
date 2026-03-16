"""
Compositor Agent — Programmatic text and logo overlay via Pillow.
Inserted between Generator and Reviewer in the pipeline.
"""

import asyncio
import base64
import io
import logging
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from app.agents.base_agent import BaseAgent
from app.agents.context import (
    CompositionLayout,
    LogoPlacement,
    PipelineContext,
    TextZone,
)
from app.config import get_settings
from app.services.storage_service import save_image, save_thumbnail

logger = logging.getLogger(__name__)

# Font configuration
FONTS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "assets",
    "fonts",
)

FONT_MAP = {
    "Sora": {
        "bold": "Sora-Bold.ttf",
        "semibold": "Sora-SemiBold.ttf",
        "regular": "Sora-Regular.ttf",
        "light": "Sora-Light.ttf",
    },
    "DM Sans": {
        "bold": "DM_Sans-Bold.ttf",
        "medium": "DM_Sans-Medium.ttf",
        "regular": "DM_Sans-Regular.ttf",
    },
}

SIZE_HINT_FACTORS = {"large": 0.07, "medium": 0.045, "small": 0.03}
LOGO_SIZE_FACTORS = {"small": 0.08, "medium": 0.12, "large": 0.18}
REGION_RANGES = {"top": (0.05, 0.35), "center": (0.30, 0.70), "bottom": (0.65, 0.95)}
PADDING_FRACTION = 0.05


def _resolve_font_path(brand_fonts: dict | None, zone: TextZone) -> str:
    """Resolve the font file path based on brand fonts and zone style."""
    role = "heading" if zone.field in ("headline", "slide_headline") else "body"
    default_family = "Sora" if role == "heading" else "DM Sans"
    font_name = (brand_fonts or {}).get(role, default_family)
    family = FONT_MAP.get(font_name, FONT_MAP.get(default_family, FONT_MAP["Sora"]))
    style_file = family.get(zone.style, family.get("regular", list(family.values())[0]))
    path = os.path.join(FONTS_DIR, style_file)
    if not os.path.isfile(path):
        path = os.path.join(FONTS_DIR, "Sora-Regular.ttf")
    return path


def _calculate_luminance(image: Image.Image, region_box: tuple[int, int, int, int]) -> float:
    """Calculate average luminance of a region in the image."""
    from PIL import ImageStat

    region = image.crop(region_box).convert("RGB")
    stat = ImageStat.Stat(region)
    r, g, b = stat.mean
    return 0.299 * r + 0.587 * g + 0.114 * b


def _contrast_ratio(l1: float, l2: float) -> float:
    """Calculate contrast ratio between two luminance values."""
    rl1 = (l1 / 255.0) ** 2.2
    rl2 = (l2 / 255.0) ** 2.2
    lighter = max(rl1, rl2)
    darker = min(rl1, rl2)
    return (lighter + 0.05) / (darker + 0.05)


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert hex color string to RGB tuple."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 6:
        return (int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16))
    return (255, 255, 255)


def _resolve_text_color(
    zone: TextZone,
    image: Image.Image,
    region_box: tuple[int, int, int, int],
    brand_colors: list[str] | None,
) -> tuple[int, int, int]:
    """Determine the best text color for contrast against the background."""
    bg_luminance = _calculate_luminance(image, region_box)

    if zone.color_hint == "light":
        base_color = (255, 255, 255)
    elif zone.color_hint == "dark":
        base_color = (28, 28, 30)
    else:
        base_color = (255, 255, 255) if bg_luminance < 128 else (28, 28, 30)

    if brand_colors:
        for hex_color in brand_colors[:2]:
            try:
                brand_rgb = _hex_to_rgb(hex_color)
                brand_lum = 0.299 * brand_rgb[0] + 0.587 * brand_rgb[1] + 0.114 * brand_rgb[2]
                ratio = _contrast_ratio(brand_lum, bg_luminance)
                if ratio >= 4.5:
                    return brand_rgb
            except (ValueError, IndexError):
                continue

    return base_color


def _wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """Word-wrap text to fit within max_width using the given font."""
    words = text.split()
    lines: list[str] = []
    current_line = ""

    for word in words:
        test_line = f"{current_line} {word}".strip()
        bbox = font.getbbox(test_line)
        if bbox[2] <= max_width:
            current_line = test_line
        else:
            if current_line:
                lines.append(current_line)
            current_line = word

    if current_line:
        lines.append(current_line)

    return lines or [text]


class CompositorAgent(BaseAgent):
    """Overlays programmatic text and logo onto generated images."""

    name = "compositor"

    async def execute(self, context: PipelineContext) -> PipelineContext:
        layout = getattr(context.creative_direction, "composition_layout", None)
        if not layout or not layout.use_compositor:
            return context

        if not context.generated_images:
            logger.warning("Compositor: no generated images to compose on")
            return context

        try:
            image = await self._load_image(context)
            if image is None:
                return context

            image = self._sharpen(image)

            if layout.text_zones:
                image = self._compose_text(image, layout, context)

            brand = context.brand
            if layout.logo_placement and brand and getattr(brand, "logo_url", None):
                image = self._compose_logo(image, layout.logo_placement, brand)

            composed_url = await self._save_composed(image, context)
            if composed_url:
                context.generated_images[-1].image_url = composed_url

        except Exception as e:
            logger.warning(f"Compositor failed (pipeline continues with original): {e}")

        return context

    async def _load_image(self, context: PipelineContext) -> Image.Image | None:
        """Load the last generated image from storage."""
        settings = get_settings()
        last_image = context.generated_images[-1]
        image_url = last_image.image_url

        clean_path = image_url.lstrip("/")
        if clean_path.startswith("storage/"):
            clean_path = clean_path[len("storage/"):]

        storage_root = os.path.realpath(settings.STORAGE_PATH)
        file_path = os.path.realpath(os.path.join(storage_root, clean_path))

        if not file_path.startswith(storage_root):
            logger.warning(f"Compositor: path traversal blocked: {image_url}")
            return None

        if not os.path.isfile(file_path):
            logger.warning(f"Compositor: image not found: {file_path}")
            return None

        def _open(path: str) -> Image.Image:
            return Image.open(path).convert("RGBA")

        return await asyncio.to_thread(_open, file_path)

    def _sharpen(self, image: Image.Image) -> Image.Image:
        """Apply a light sharpen to crisp up the base image before overlay."""
        return image.filter(ImageFilter.UnsharpMask(radius=1.5, percent=30, threshold=3))

    def _compose_text(
        self,
        image: Image.Image,
        layout: CompositionLayout,
        context: PipelineContext,
    ) -> Image.Image:
        """Draw all text zones onto the image."""
        draw = ImageDraw.Draw(image)
        w, h = image.size
        pad = int(w * PADDING_FRACTION)

        brand_fonts = context.brand.fonts if context.brand else None
        brand_colors = (
            (context.brand.primary_colors + context.brand.secondary_colors)
            if context.brand
            else None
        )

        for zone in layout.text_zones:
            text = self._resolve_text_content(zone, context)
            if not text:
                continue

            # Font
            font_path = _resolve_font_path(brand_fonts, zone)
            factor = SIZE_HINT_FACTORS.get(zone.size_hint, 0.045)
            font_size = max(int(h * factor), 12)
            font = ImageFont.truetype(font_path, font_size)

            # Region
            region_top_frac, region_bot_frac = REGION_RANGES.get(zone.region, (0.30, 0.70))
            region_top = int(h * region_top_frac)
            region_bot = int(h * region_bot_frac)
            max_width = w - 2 * pad

            # Wrap text
            lines = _wrap_text(text, font, max_width)

            # Calculate total text height
            line_heights = []
            for line in lines:
                bbox = font.getbbox(line)
                line_heights.append(bbox[3] - bbox[1])
            line_spacing = int(font_size * 0.3)
            total_text_h = sum(line_heights) + line_spacing * (len(lines) - 1) if lines else 0

            # Vertical position (center within region)
            y_start = region_top + (region_bot - region_top - total_text_h) // 2
            y_start = max(y_start, region_top)

            # Color
            region_box = (pad, region_top, w - pad, region_bot)
            color = _resolve_text_color(zone, image, region_box, brand_colors)

            # Draw each line
            y = y_start
            for i, line in enumerate(lines):
                bbox = font.getbbox(line)
                line_w = bbox[2] - bbox[0]

                if zone.alignment == "center":
                    x = (w - line_w) // 2
                elif zone.alignment == "right":
                    x = w - pad - line_w
                else:
                    x = pad

                # Drop shadow for readability
                shadow_offset = max(1, font_size // 30)
                shadow_color = (0, 0, 0, 100)
                draw.text((x + shadow_offset, y + shadow_offset), line, font=font, fill=shadow_color)
                draw.text((x, y), line, font=font, fill=color)

                y += line_heights[i] + line_spacing

        return image

    def _resolve_text_content(self, zone: TextZone, context: PipelineContext) -> str | None:
        """Get the actual text content for a text zone from the brief."""
        brief = context.brief
        field_name = zone.field

        # Direct brief fields
        if field_name == "headline":
            return brief.headline
        if field_name == "body_text":
            return brief.body_text
        if field_name == "cta_text":
            return brief.cta_text

        # Carousel slide fields
        if field_name in ("slide_headline", "slide_body") and brief.slides:
            slide_idx = context.current_slide_index
            if slide_idx is not None and 0 <= slide_idx < len(brief.slides):
                slide = brief.slides[slide_idx]
                if field_name == "slide_headline":
                    return slide.get("headline")
                if field_name == "slide_body":
                    return slide.get("body_text")

        return None

    def _compose_logo(
        self,
        image: Image.Image,
        placement: LogoPlacement,
        brand: object,
    ) -> Image.Image:
        """Overlay the brand logo onto the image."""
        logo = self._load_logo(brand)
        if logo is None:
            return image

        w, h = image.size
        size_factor = LOGO_SIZE_FACTORS.get(placement.size, 0.12)
        logo_max = int(min(w, h) * size_factor)

        # Resize logo preserving aspect ratio
        logo_w, logo_h = logo.size
        ratio = min(logo_max / logo_w, logo_max / logo_h)
        new_w = int(logo_w * ratio)
        new_h = int(logo_h * ratio)
        logo = logo.resize((new_w, new_h), Image.LANCZOS)

        # Apply opacity
        if placement.opacity < 1.0:
            alpha = logo.getchannel("A")
            alpha = alpha.point(lambda p: int(p * placement.opacity))
            logo.putalpha(alpha)

        # Calculate position
        pad = int(w * PADDING_FRACTION)
        pos = placement.position
        parts = pos.split("-")
        v_part = parts[0] if parts else "top"
        h_part = parts[1] if len(parts) > 1 else "left"

        if v_part == "top":
            y = pad
        elif v_part == "bottom":
            y = h - new_h - pad
        else:
            y = (h - new_h) // 2

        if h_part == "left":
            x = pad
        elif h_part == "right":
            x = w - new_w - pad
        else:
            x = (w - new_w) // 2

        image.paste(logo, (x, y), logo)
        return image

    def _load_logo(self, brand: object) -> Image.Image | None:
        """Load the brand logo as a PIL Image."""
        logo_url = getattr(brand, "logo_url", None)
        if not logo_url:
            return None

        try:
            if logo_url.startswith("data:"):
                comma_idx = logo_url.find(",")
                if comma_idx > 0:
                    b64_data = logo_url[comma_idx + 1:]
                    img_bytes = base64.b64decode(b64_data)
                    return Image.open(io.BytesIO(img_bytes)).convert("RGBA")
                return None

            settings = get_settings()
            clean_path = logo_url.lstrip("/")
            if clean_path.startswith("storage/"):
                clean_path = clean_path[len("storage/"):]

            storage_root = os.path.realpath(settings.STORAGE_PATH)
            file_path = os.path.realpath(os.path.join(storage_root, clean_path))

            if not file_path.startswith(storage_root):
                logger.warning(f"Compositor: logo path traversal blocked: {logo_url}")
                return None

            if not os.path.isfile(file_path):
                logger.warning(f"Compositor: logo not found: {file_path}")
                return None

            return Image.open(file_path).convert("RGBA")

        except Exception as e:
            logger.warning(f"Compositor: failed to load logo: {e}")
            return None

    async def _save_composed(self, image: Image.Image, context: PipelineContext) -> str | None:
        """Save the composed image to storage, returning the relative URL."""
        try:
            buf = io.BytesIO()
            # Convert RGBA -> RGB for PNG without alpha issues
            rgb_image = image.convert("RGB")
            rgb_image.save(buf, format="PNG", optimize=True)
            image_bytes = buf.getvalue()

            brand_id = context.brand.id if context.brand else None
            storage_id = context.generation_id or context.brief_id

            composed_url = await save_image(
                image_data=image_bytes,
                generation_id=storage_id,
                filename=f"composed_iter{context.iteration}.png",
                brand_id=brand_id,
            )

            # After saving composed image, regenerate thumbnail
            try:
                await save_thumbnail(
                    image_data=image_bytes,
                    generation_id=storage_id,
                    brand_id=brand_id,
                )
            except Exception:
                pass  # Thumbnail update is non-critical

            return composed_url

        except Exception as e:
            logger.warning(f"Compositor: failed to save composed image: {e}")
            return None

    def _get_completion_reasoning(self, context: PipelineContext) -> str:
        layout = getattr(context.creative_direction, "composition_layout", None)
        if not layout:
            return "Compositor skipped (no layout)"
        parts = []
        if layout.text_zones:
            parts.append(f"{len(layout.text_zones)} text zone(s)")
        if layout.logo_placement:
            parts.append("logo overlay")
        return f"Composed: {', '.join(parts)}" if parts else "Compositor executed"
