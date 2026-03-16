# Compositor Agent Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Compositor agent that overlays text and logo programmatically via Pillow on AI-generated images, inserted between Generator and Reviewer in the pipeline.

**Architecture:** New `CompositorAgent(BaseAgent)` receives the generated image + brand data + `composition_layout` (defined by Creative Director). It applies sharpening to the background, renders text with proper fonts/contrast, composites the brand logo, and saves the result. The Reviewer then evaluates the final composed image.

**Tech Stack:** Python 3.12, Pillow/PIL, existing FastAPI + Celery pipeline, dataclasses

**Spec:** `docs/superpowers/specs/2026-03-15-compositor-agent-design.md`

---

## Chunk 1: Foundation — Dataclasses, BaseAgent, Config

### Task 1: Add Composition Dataclasses to context.py

**Files:**
- Modify: `backend/app/agents/context.py:38-48` (CreativeDirection) and `:105-182` (PipelineContext)

- [ ] **Step 1: Add CompositionLayout, TextZone, LogoPlacement dataclasses**

Add these dataclasses BEFORE the `CreativeDirection` dataclass (around line 37):

```python
@dataclass
class TextZone:
    field: str          # "headline" | "body_text" | "cta_text" | "slide_headline" | "slide_body"
    region: str         # "top" | "center" | "bottom"
    alignment: str      # "left" | "center" | "right"
    size_hint: str      # "large" | "medium" | "small"
    style: str          # "bold" | "semibold" | "medium" | "regular" | "light"
    color_hint: str     # "light" | "dark" | "auto"


@dataclass
class LogoPlacement:
    position: str       # "top-left", "top-center", "top-right", "center-left", etc.
    size: str           # "small" | "medium" | "large"
    opacity: float = 1.0


@dataclass
class CompositionLayout:
    use_compositor: bool
    text_zones: list[TextZone]
    logo_placement: LogoPlacement | None
    reserved_areas: list[str]
```

- [ ] **Step 2: Add `composition_layout` field to CreativeDirection**

At `context.py:48`, add to the `CreativeDirection` dataclass:

```python
    composition_layout: CompositionLayout | None = None
```

- [ ] **Step 3: Add `CreativeDirection.from_dict()` classmethod**

Add after the `CreativeDirection` dataclass definition:

```python
    @classmethod
    def from_dict(cls, data: dict) -> "CreativeDirection":
        """Reconstruct CreativeDirection from dict, handling nested dataclasses."""
        filtered = {}
        valid_fields = {f.name for f in fields(cls)}
        for k, v in data.items():
            if k in valid_fields:
                filtered[k] = v

        # Reconstruct nested CompositionLayout
        cl_data = filtered.pop("composition_layout", None)
        composition_layout = None
        if cl_data and isinstance(cl_data, dict):
            text_zones = [TextZone(**tz) for tz in cl_data.get("text_zones", [])]
            lp_data = cl_data.get("logo_placement")
            logo_placement = LogoPlacement(**lp_data) if lp_data else None
            composition_layout = CompositionLayout(
                use_compositor=cl_data.get("use_compositor", False),
                text_zones=text_zones,
                logo_placement=logo_placement,
                reserved_areas=cl_data.get("reserved_areas", []),
            )
        elif isinstance(cl_data, CompositionLayout):
            composition_layout = cl_data

        return cls(**filtered, composition_layout=composition_layout)
```

**Important:** At the top of `context.py`, change the import from:
```python
from dataclasses import dataclass, field
```
to:
```python
from dataclasses import dataclass, field, fields
```
(`fields` plural is needed for introspection in `from_dict`.)

- [ ] **Step 4: Update PipelineContext.from_dict() to use CreativeDirection.from_dict()**

In `PipelineContext.from_dict()` (around line 172), find the exact line:

```python
# FROM (exact):
data["creative_direction"] = CreativeDirection(**_ff(CreativeDirection, data["creative_direction"]))

# TO:
data["creative_direction"] = CreativeDirection.from_dict(data["creative_direction"])
```

This replaces the `_filter_fields` + `**dict` pattern with the new `from_dict()` which handles nested dataclass reconstruction internally.

- [ ] **Step 5: Verify Python syntax**

Run: `python -c "import ast; ast.parse(open('backend/app/agents/context.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/agents/context.py
git commit -m "feat: add CompositionLayout dataclasses and CreativeDirection.from_dict()"
```

---

### Task 2: Make BaseAgent client optional

**Files:**
- Modify: `backend/app/agents/base_agent.py:13-14`

- [ ] **Step 1: Change `__init__` signature**

At `base_agent.py:13`, change:

```python
# FROM:
def __init__(self, client: OpenRouterClient):
# TO:
def __init__(self, client: OpenRouterClient | None = None):
```

- [ ] **Step 2: Verify no existing agent breaks**

Run: `python -c "import ast; ast.parse(open('backend/app/agents/base_agent.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/agents/base_agent.py
git commit -m "refactor: make BaseAgent client optional for non-LLM agents"
```

---

### Task 3: Add `programmaticComposition` to art type configs

**Files:**
- Modify: `backend/app/config/art_type_config.py:13-194`
- Modify: `frontend/src/config/artTypeConfig.ts:34-225`

- [ ] **Step 1: Add field to backend config**

In `art_type_config.py`, add `"programmaticComposition": True` to these art types (add it right after the `"label"` field in each):
- `ad_creative` (around line 14)
- `social_post` (around line 38)
- `carousel` (around line 60)
- `presentation_slide` (around line 139)
- `brand_material` (around line 160)

Add `"programmaticComposition": False` to these:
- `logo` (around line 79)
- `product_shot` (around line 90)
- `lifestyle_photo` (around line 106)
- `mockup` (around line 120)
- `illustration` (around line 132)

- [ ] **Step 2: Add field to frontend config (mirror)**

In `artTypeConfig.ts`, add `programmaticComposition: true` or `false` to each art type config object, matching the backend values. Also add the field to the `ArtTypeConfig` interface (around line 20-32):

```typescript
programmaticComposition: boolean;
```

- [ ] **Step 3: Verify backend syntax**

Run: `python -c "import ast; ast.parse(open('backend/app/config/art_type_config.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/config/art_type_config.py frontend/src/config/artTypeConfig.ts
git commit -m "feat: add programmaticComposition flag to art type configs"
```

---

### Task 4: Add font files

**Files:**
- Create: `backend/assets/fonts/` directory with 7 TTF files

- [ ] **Step 1: Create fonts directory**

```bash
mkdir -p backend/assets/fonts
```

- [ ] **Step 2: Download font files**

Download from Google Fonts (SIL Open Font License):

```bash
# Sora fonts
curl -L "https://github.com/nicholasbillal/sora-font/raw/main/fonts/ttf/Sora-Bold.ttf" -o backend/assets/fonts/Sora-Bold.ttf
curl -L "https://github.com/nicholasbillal/sora-font/raw/main/fonts/ttf/Sora-SemiBold.ttf" -o backend/assets/fonts/Sora-SemiBold.ttf
curl -L "https://github.com/nicholasbillal/sora-font/raw/main/fonts/ttf/Sora-Regular.ttf" -o backend/assets/fonts/Sora-Regular.ttf
curl -L "https://github.com/nicholasbillal/sora-font/raw/main/fonts/ttf/Sora-Light.ttf" -o backend/assets/fonts/Sora-Light.ttf

# DM Sans fonts
curl -L "https://github.com/googlefonts/dm-fonts/raw/main/Sans/TTF/DMSans-Bold.ttf" -o backend/assets/fonts/DM_Sans-Bold.ttf
curl -L "https://github.com/googlefonts/dm-fonts/raw/main/Sans/TTF/DMSans-Medium.ttf" -o backend/assets/fonts/DM_Sans-Medium.ttf
curl -L "https://github.com/googlefonts/dm-fonts/raw/main/Sans/TTF/DMSans-Regular.ttf" -o backend/assets/fonts/DM_Sans-Regular.ttf
```

If the above URLs fail (GitHub raw links can change), download from Google Fonts API:
```bash
# Alternative: download via fonts.google.com API
# Search "Sora" and "DM Sans", download TTF package, extract needed weights
```

- [ ] **Step 3: Verify fonts are valid TTF**

```python
python -c "
from PIL import ImageFont
import os
fonts_dir = 'backend/assets/fonts'
for f in os.listdir(fonts_dir):
    if f.endswith('.ttf'):
        font = ImageFont.truetype(os.path.join(fonts_dir, f), 24)
        print(f'OK: {f} ({font.getname()})')
"
```

Expected: 7 lines of OK with font names.

- [ ] **Step 4: Commit**

```bash
git add backend/assets/fonts/
git commit -m "feat: add Sora and DM Sans TTF fonts for programmatic text composition"
```

---

## Chunk 2: Creative Director Extension

### Task 5: Update Creative Director to output composition_layout

**Files:**
- Modify: `backend/app/agents/creative_director.py:16-41` (system prompt), `:52-79` (execute)
- Modify: `backend/app/config/art_type_config.py` (import helper)

- [ ] **Step 1: Add composition prompt section to system prompt**

In `creative_director.py`, the system prompt is built around lines 16-41. Add a conditional section that is appended ONLY when `programmaticComposition` is true.

After the existing system prompt string (around line 41), add a function to build the composition addendum:

```python
COMPOSITION_PROMPT_ADDENDUM = """

## Programmatic Composition

Text and logo will be overlaid programmatically on the generated image (NOT by the AI model).
You MUST define a `composition_layout` object in your JSON response with this structure:

```json
"composition_layout": {
    "use_compositor": true,
    "text_zones": [
        {
            "field": "headline",
            "region": "top",
            "alignment": "center",
            "size_hint": "large",
            "style": "bold",
            "color_hint": "light"
        }
    ],
    "logo_placement": {
        "position": "top-left",
        "size": "small",
        "opacity": 1.0
    },
    "reserved_areas": [
        "top third for large headline text",
        "top-left corner for brand logo"
    ]
}
```

Rules for composition_layout:
- Only include text_zones for fields that have non-empty text in the brief
- `region`: "top" | "center" | "bottom" — vertical area of the image
- `alignment`: "left" | "center" | "right" — horizontal alignment
- `size_hint`: "large" (headlines) | "medium" (body) | "small" (fine print)
- `style`: "bold" | "semibold" | "medium" | "regular" | "light"
- `color_hint`: "light" (white text for dark backgrounds) | "dark" (dark text for light backgrounds) | "auto" (detect from image)
- `logo_placement.position`: grid 3x3 — "top-left", "top-center", "top-right", "center-left", "center-center", "center-right", "bottom-left", "bottom-center", "bottom-right"
- `logo_placement.size`: "small" (8% width) | "medium" (12%) | "large" (18%)
- `reserved_areas`: text descriptions of areas the image should keep clean/simple for text and logo overlay
- Think of the full composition: image background + text + logo must form a professional, balanced piece
"""
```

- [ ] **Step 2: Conditionally append composition prompt in execute()**

In the `execute()` method, before the LLM call (around line 52), check if this art type supports composition:

```python
from app.config.art_type_config import get_art_type_config

# In execute(), before building the prompt:
art_type_config = get_art_type_config(context.brief.art_type)
use_composition = art_type_config and art_type_config.get("programmaticComposition", False)

# Build system prompt
system_prompt = SYSTEM_PROMPT  # existing prompt
if use_composition:
    system_prompt += COMPOSITION_PROMPT_ADDENDUM
```

- [ ] **Step 3: Parse composition_layout from LLM response**

After the JSON parsing (around lines 59-75), add parsing of `composition_layout`:

```python
# After existing CreativeDirection construction:
# Parse composition_layout if present
composition_layout = None
if use_composition and "composition_layout" in direction_data:
    from app.agents.context import CompositionLayout, TextZone, LogoPlacement
    cl = direction_data["composition_layout"]
    text_zones = [TextZone(**tz) for tz in cl.get("text_zones", [])]
    lp = cl.get("logo_placement")
    logo_placement = LogoPlacement(**lp) if lp else None
    composition_layout = CompositionLayout(
        use_compositor=cl.get("use_compositor", False),
        text_zones=text_zones,
        logo_placement=logo_placement,
        reserved_areas=cl.get("reserved_areas", []),
    )

# Set on creative direction
context.creative_direction.composition_layout = composition_layout
```

- [ ] **Step 4: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/app/agents/creative_director.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/agents/creative_director.py
git commit -m "feat: Creative Director outputs composition_layout for programmatic text/logo"
```

---

## Chunk 3: Prompt Engineer + Reviewer + Refiner Adjustments

### Task 6: Update Prompt Engineer to add reserved zone instructions

**Files:**
- Modify: `backend/app/agents/prompt_engineer.py:24-95` (execute method)

- [ ] **Step 1: Add reserved zone instructions to prompt building**

In the `execute()` method, after reading `creative_direction` (around line 27), build the reserved zone instructions:

```python
# After getting creative_direction, before building prompt:
composition_layout = getattr(context.creative_direction, "composition_layout", None)
use_compositor = composition_layout and composition_layout.use_compositor
reserved_zone_instructions = ""
if use_compositor:
    zone_lines = [
        "\n\nCRITICAL COMPOSITION RULES:",
        "- DO NOT include any text, words, letters, numbers, or typography in the image",
        "- The image must be a pure visual/background — all text will be added programmatically after generation",
    ]
    for area in composition_layout.reserved_areas:
        zone_lines.append(f"- Leave space: {area}")
    if composition_layout.logo_placement:
        zone_lines.append(f"- Reserve the {composition_layout.logo_placement.position} area for a small logo placement")
    reserved_zone_instructions = "\n".join(zone_lines)
```

**Precise insertion point:** At line 50, `self._build_user_prompt(context, selected_model)` returns the user prompt string. Append the instructions right after:

```python
user_prompt = self._build_user_prompt(context, selected_model)
user_prompt += reserved_zone_instructions  # empty string if compositor not active
```

**Also critical:** When `use_compositor` is true, the existing `_build_user_prompt` includes "MUST appear in image exactly as" instructions for text fields. These CONTRADICT the "DO NOT include any text" rule. In `_build_user_prompt()`, wrap the text field inclusion in a condition:

```python
# In _build_user_prompt(), around lines 177-181 where text fields are added:
# Only include "MUST appear" text instructions when NOT using compositor
if not use_compositor:
    # existing text field instructions (headline MUST appear, etc.)
    ...
```

Pass `use_compositor` as a parameter to `_build_user_prompt()`, or access it from context inside the method.

- [ ] **Step 2: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/app/agents/prompt_engineer.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/agents/prompt_engineer.py
git commit -m "feat: Prompt Engineer injects reserved zone instructions for compositor"
```

---

### Task 7: Update Reviewer prompt for composed images

**Files:**
- Modify: `backend/app/agents/reviewer.py:13-58` (system prompt section)

- [ ] **Step 1: Add conditional section to reviewer system prompt**

In `reviewer.py`, add a composition-aware note to the system prompt. The Reviewer needs to know that text was added programmatically so it evaluates legibility/placement instead of text generation quality.

Define the addendum:

```python
COMPOSITION_REVIEW_ADDENDUM = """

IMPORTANT: Text and logo in this image were overlaid PROGRAMMATICALLY (not AI-generated).
For text_accuracy_score, evaluate:
- Legibility (contrast between text and background)
- Harmonious positioning within the composition
- Adequate visual hierarchy
Do NOT penalize for text rendering artifacts (there are none with programmatic composition).
Focus on: did the background image leave adequate space? Is the overall piece visually professional?
"""
```

In the `execute()` method, `SYSTEM_PROMPT` is a module-level constant used directly in the messages dict (line 81). Create a local variable and conditionally append:

```python
# At the start of execute(), create a local copy:
system_prompt = SYSTEM_PROMPT

# Then conditionally append:
composition_layout = getattr(context.creative_direction, "composition_layout", None)
if composition_layout and composition_layout.use_compositor:
    system_prompt += COMPOSITION_REVIEW_ADDENDUM

# Then use `system_prompt` (local) instead of `SYSTEM_PROMPT` (module-level) in the messages dict:
# Change: {"role": "system", "content": SYSTEM_PROMPT}
# To:     {"role": "system", "content": system_prompt}
```

- [ ] **Step 2: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/app/agents/reviewer.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/agents/reviewer.py
git commit -m "feat: Reviewer adjusts text scoring criteria for composed images"
```

---

### Task 8: Update Refiner awareness of composition

**Files:**
- Modify: `backend/app/agents/refiner.py:14-46` (system prompt)

- [ ] **Step 1: Add composition context to refiner prompt**

Define the addendum:

```python
COMPOSITION_REFINER_ADDENDUM = """

IMPORTANT: Text and logo are overlaid PROGRAMMATICALLY after image generation.
If the review indicates legibility problems (text hard to read, busy background behind text):
- Your strategy should focus on adjusting the IMAGE prompt to create cleaner, simpler areas
  where text will be placed
- Request more negative space, calmer backgrounds, or darker/lighter zones as needed
- You CANNOT adjust text positioning or style — only the background image prompt
"""
```

Same pattern as Reviewer: `SYSTEM_PROMPT` is a module-level constant (line 14), used directly at line 64. Create a local variable:

```python
# At the start of execute(), create a local copy:
system_prompt = SYSTEM_PROMPT

# Conditionally append:
composition_layout = getattr(context.creative_direction, "composition_layout", None)
if composition_layout and composition_layout.use_compositor:
    system_prompt += COMPOSITION_REFINER_ADDENDUM

# Use `system_prompt` (local) instead of `SYSTEM_PROMPT` (module-level) in the messages dict:
# Change: {"role": "system", "content": SYSTEM_PROMPT}
# To:     {"role": "system", "content": system_prompt}
```

- [ ] **Step 2: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/app/agents/refiner.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/agents/refiner.py
git commit -m "feat: Refiner understands programmatic composition for better refinement"
```

---

## Chunk 4: Compositor Agent

### Task 9: Create CompositorAgent

**Files:**
- Create: `backend/app/agents/compositor.py`

This is the main new file. It handles: loading the generated image, sharpening, text rendering, logo composition, and saving.

- [ ] **Step 1: Create compositor.py with font resolution and helpers**

```python
"""
Compositor Agent — Programmatic text and logo overlay via Pillow.
Inserted between Generator and Reviewer in the pipeline.
"""

import base64
import io
import logging
import os
from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from app.agents.base_agent import BaseAgent
from app.agents.context import (
    CompositionLayout,
    LogoPlacement,
    PipelineContext,
    TextZone,
)
from app.config import settings
from app.services.storage_service import save_image, save_thumbnail

logger = logging.getLogger(__name__)

# Storage path from settings
STORAGE_PATH = None  # resolved lazily to avoid import-time issues

def _get_storage_path():
    global STORAGE_PATH
    if STORAGE_PATH is None:
        STORAGE_PATH = settings.STORAGE_PATH
    return STORAGE_PATH

# Font configuration
FONTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "assets", "fonts")

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

# Size hints as percentage of image height
SIZE_HINT_FACTORS = {
    "large": 0.07,
    "medium": 0.045,
    "small": 0.03,
}

# Logo size as percentage of image width
LOGO_SIZE_FACTORS = {
    "small": 0.08,
    "medium": 0.12,
    "large": 0.18,
}

# Region vertical ranges (fraction of image height)
REGION_RANGES = {
    "top": (0.05, 0.35),
    "center": (0.30, 0.70),
    "bottom": (0.65, 0.95),
}

PADDING_FRACTION = 0.05  # 5% margin from edges


def _resolve_font_path(brand_fonts: dict | None, zone: TextZone) -> str:
    """Resolve TTF file path for a text zone."""
    role = "heading" if zone.field in ("headline", "slide_headline") else "body"
    default_family = "Sora" if role == "heading" else "DM Sans"
    font_name = (brand_fonts or {}).get(role, default_family)
    family = FONT_MAP.get(font_name, FONT_MAP.get(default_family, FONT_MAP["Sora"]))
    style_file = family.get(zone.style, family.get("regular", list(family.values())[0]))
    path = os.path.join(FONTS_DIR, style_file)
    if not os.path.isfile(path):
        # Fallback to Sora-Regular
        path = os.path.join(FONTS_DIR, "Sora-Regular.ttf")
    return path


def _calculate_luminance(image: Image.Image, region_box: tuple[int, int, int, int]) -> float:
    """Calculate average luminance of a region using ITU-R BT.601."""
    region = image.crop(region_box)
    region = region.convert("RGB")
    pixels = list(region.getdata())
    if not pixels:
        return 128.0
    total = sum(0.299 * r + 0.587 * g + 0.114 * b for r, g, b in pixels)
    return total / len(pixels)


def _contrast_ratio(l1: float, l2: float) -> float:
    """WCAG contrast ratio between two relative luminances (0-255 scale)."""
    # Convert to 0-1 relative luminance
    rl1 = (l1 / 255.0) ** 2.2  # approximate sRGB linearization
    rl2 = (l2 / 255.0) ** 2.2
    lighter = max(rl1, rl2)
    darker = min(rl1, rl2)
    return (lighter + 0.05) / (darker + 0.05)


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert '#RRGGBB' to (R, G, B)."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 6:
        return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))
    return (255, 255, 255)


def _resolve_text_color(
    zone: TextZone,
    image: Image.Image,
    region_box: tuple[int, int, int, int],
    brand_colors: list[str] | None,
) -> tuple[int, int, int]:
    """Determine text color based on color_hint, background luminance, and brand colors."""
    bg_luminance = _calculate_luminance(image, region_box)

    if zone.color_hint == "light":
        base_color = (255, 255, 255)
    elif zone.color_hint == "dark":
        base_color = (28, 28, 30)  # #1C1C1E
    else:  # "auto"
        base_color = (255, 255, 255) if bg_luminance < 128 else (28, 28, 30)

    # Try brand primary color if contrast is sufficient (WCAG AA 4.5:1)
    if brand_colors:
        for hex_color in brand_colors[:2]:  # check first 2 brand colors
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
    """Word-wrap text to fit within max_width pixels."""
    words = text.split()
    lines = []
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
```

- [ ] **Step 2: Add the CompositorAgent class**

Append to the same file:

```python
class CompositorAgent(BaseAgent):
    name = "compositor"

    async def execute(self, context: PipelineContext) -> PipelineContext:
        """Compose text and logo over the generated image."""
        layout = getattr(context.creative_direction, "composition_layout", None)
        if not layout or not layout.use_compositor:
            return context

        if not context.generated_images:
            logger.warning("Compositor: no generated images to compose on")
            return context

        try:
            image = self._load_image(context)
            if image is None:
                return context

            # 1. Sharpen BEFORE text (avoids ringing on text edges)
            image = self._sharpen(image)

            # 2. Compose text
            if layout.text_zones:
                image = self._compose_text(image, layout, context)

            # 3. Compose logo
            brand = context.brand
            if layout.logo_placement and brand and getattr(brand, "logo_url", None):
                image = self._compose_logo(image, layout.logo_placement, brand)

            # 4. Save composed image (async — storage functions are async)
            composed_url = await self._save_composed(image, context)
            if composed_url:
                context.generated_images[-1].image_url = composed_url

        except Exception as e:
            logger.warning(f"Compositor failed (pipeline continues with original): {e}")

        return context

    def _load_image(self, context: PipelineContext) -> Image.Image | None:
        """Load the most recent generated image from storage."""
        storage_path = _get_storage_path()

        image_url = context.generated_images[-1].image_url
        image_path = os.path.join(storage_path, image_url)
        real_path = os.path.realpath(image_path)
        if not real_path.startswith(os.path.realpath(storage_path)):
            logger.warning("Compositor: path traversal detected")
            return None

        if not os.path.isfile(real_path):
            logger.warning(f"Compositor: image not found at {real_path}")
            return None

        return Image.open(real_path).convert("RGBA")

    def _sharpen(self, image: Image.Image) -> Image.Image:
        """Apply subtle sharpening to the background image."""
        return image.filter(ImageFilter.UnsharpMask(radius=1.5, percent=30, threshold=3))

    def _compose_text(
        self, image: Image.Image, layout: CompositionLayout, context: PipelineContext
    ) -> Image.Image:
        """Render all text zones onto the image."""
        draw = ImageDraw.Draw(image)
        img_width, img_height = image.size
        brand_fonts = getattr(context.brand, "fonts", None) if context.brand else None
        brand_colors = getattr(context.brand, "primary_colors", None) if context.brand else None

        for zone in layout.text_zones:
            text = self._resolve_text_content(zone.field, context)
            if not text:
                continue

            # Resolve font and size
            font_path = _resolve_font_path(brand_fonts, zone)
            base_size = int(img_height * SIZE_HINT_FACTORS.get(zone.size_hint, 0.045))
            font = ImageFont.truetype(font_path, base_size)

            # Calculate available region
            v_start, v_end = REGION_RANGES.get(zone.region, (0.05, 0.95))
            padding = int(img_width * PADDING_FRACTION)
            max_text_width = img_width - 2 * padding
            region_top = int(img_height * v_start)
            region_bottom = int(img_height * v_end)
            region_height = region_bottom - region_top

            # Word wrap
            lines = _wrap_text(text, font, max_text_width)

            # Auto-shrink if text doesn't fit vertically
            line_height = font.getbbox("Ay")[3] + 4
            total_text_height = line_height * len(lines)
            while total_text_height > region_height and base_size > 12:
                base_size -= 2
                font = ImageFont.truetype(font_path, base_size)
                lines = _wrap_text(text, font, max_text_width)
                line_height = font.getbbox("Ay")[3] + 4
                total_text_height = line_height * len(lines)

            # Resolve color
            region_box = (padding, region_top, img_width - padding, region_bottom)
            text_color = _resolve_text_color(zone, image, region_box, brand_colors)

            # Calculate vertical start (center text block in region)
            y = region_top + (region_height - total_text_height) // 2

            for line in lines:
                bbox = font.getbbox(line)
                text_width = bbox[2] - bbox[0]

                # Horizontal alignment
                if zone.alignment == "left":
                    x = padding
                elif zone.alignment == "right":
                    x = img_width - padding - text_width
                else:  # center
                    x = (img_width - text_width) // 2

                # Drop shadow for legibility (subtle)
                shadow_offset = max(1, base_size // 20)
                shadow_color = (0, 0, 0, 80) if text_color[0] > 128 else (255, 255, 255, 60)
                draw.text((x + shadow_offset, y + shadow_offset), line, font=font, fill=shadow_color)

                # Main text
                draw.text((x, y), line, font=font, fill=(*text_color, 255))
                y += line_height

        return image

    def _resolve_text_content(self, field: str, context: PipelineContext) -> str | None:
        """Get text content for a field from the brief.

        BriefData has individual fields (headline, body_text, cta_text) as direct attributes.
        Carousel slides are in brief.slides[N] as dicts with headline/body keys.
        """
        brief = context.brief
        if not brief:
            return None

        # Carousel slide fields (slide_headline → slides[N]["headline"])
        if field.startswith("slide_") and hasattr(brief, "slides"):
            slide_idx = context.current_slide_index
            if slide_idx is not None and brief.slides and slide_idx < len(brief.slides):
                slide = brief.slides[slide_idx]
                base_field = field.replace("slide_", "")
                if isinstance(slide, dict):
                    return slide.get(base_field) or slide.get(field)
                return getattr(slide, base_field, None) or getattr(slide, field, None)

        # Direct attribute on BriefData (headline, body_text, cta_text)
        value = getattr(brief, field, None)
        return value if value else None

    def _compose_logo(
        self, image: Image.Image, placement: LogoPlacement, brand
    ) -> Image.Image:
        """Overlay brand logo onto the image."""
        try:
            logo = self._load_logo(brand.logo_url)
            if logo is None:
                return image

            img_width, img_height = image.size

            # Resize logo
            target_width = int(img_width * LOGO_SIZE_FACTORS.get(placement.size, 0.08))
            aspect = logo.height / logo.width if logo.width > 0 else 1
            target_height = int(target_width * aspect)
            logo = logo.resize((target_width, target_height), Image.Resampling.LANCZOS)

            # Apply opacity
            if placement.opacity < 1.0:
                alpha = logo.getchannel("A")
                alpha = alpha.point(lambda p: int(p * placement.opacity))
                logo.putalpha(alpha)

            # Position (grid 3x3)
            padding = int(img_width * PADDING_FRACTION)
            pos = placement.position.split("-") if "-" in placement.position else ["top", "left"]
            v_pos = pos[0] if len(pos) > 0 else "top"
            h_pos = pos[1] if len(pos) > 1 else "left"

            if v_pos == "top":
                y = padding
            elif v_pos == "bottom":
                y = img_height - target_height - padding
            else:  # center
                y = (img_height - target_height) // 2

            if h_pos == "left":
                x = padding
            elif h_pos == "right":
                x = img_width - target_width - padding
            else:  # center
                x = (img_width - target_width) // 2

            image.paste(logo, (x, y), logo)

        except Exception as e:
            logger.warning(f"Compositor: logo composition failed: {e}")

        return image

    def _load_logo(self, logo_url: str) -> Image.Image | None:
        """Load logo from data URL or storage path."""
        try:
            if logo_url.startswith("data:image"):
                # data:image/png;base64,...
                b64_data = logo_url.split(",", 1)[1]
                img_bytes = base64.b64decode(b64_data)
                return Image.open(io.BytesIO(img_bytes)).convert("RGBA")
            else:
                storage_path = _get_storage_path()
                path = os.path.join(storage_path, logo_url)
                real_path = os.path.realpath(path)
                if not real_path.startswith(os.path.realpath(storage_path)):
                    return None
                if os.path.isfile(real_path):
                    return Image.open(real_path).convert("RGBA")
        except Exception as e:
            logger.warning(f"Compositor: failed to load logo: {e}")
        return None

    async def _save_composed(self, image: Image.Image, context: PipelineContext) -> str | None:
        """Save composed image to storage, return relative URL."""
        try:
            # Convert RGBA to RGB for PNG saving (avoid issues)
            if image.mode == "RGBA":
                bg = Image.new("RGB", image.size, (255, 255, 255))
                bg.paste(image, mask=image.split()[3])
                image = bg

            buf = io.BytesIO()
            image.save(buf, format="PNG", optimize=True)
            image_bytes = buf.getvalue()

            iteration = context.iteration or 0
            filename = f"gen_iter{iteration}_composed.png"
            brand_id = getattr(context.brand, "id", None) if context.brand else None

            composed_url = await save_image(
                image_data=image_bytes,
                generation_id=context.generation_id,
                filename=filename,
                brand_id=str(brand_id) if brand_id else None,
            )

            # Update thumbnail with composed image
            try:
                await save_thumbnail(
                    image_data=image_bytes,
                    generation_id=context.generation_id,
                    brand_id=str(brand_id) if brand_id else None,
                )
            except Exception:
                pass  # Thumbnail update is non-critical

            return composed_url

        except Exception as e:
            logger.warning(f"Compositor: failed to save composed image: {e}")
            return None
```

- [ ] **Step 3: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/app/agents/compositor.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/agents/compositor.py
git commit -m "feat: add CompositorAgent for programmatic text and logo overlay"
```

---

## Chunk 5: Orchestrator Integration

### Task 10: Integrate Compositor into Orchestrator pipeline

**Files:**
- Modify: `backend/app/agents/orchestrator.py:113-132` (between Generator and Reviewer)

- [ ] **Step 1: Add imports at top of orchestrator.py**

Add to imports section:

```python
from app.agents.compositor import CompositorAgent
from app.config.art_type_config import get_art_type_config
```

- [ ] **Step 2: Add `_should_run_compositor` method**

Add this method to the Orchestrator class:

```python
def _should_run_compositor(self, context: PipelineContext) -> bool:
    """Check both gates: art type config + CD decision."""
    # Gate 1: art type config
    art_type_config = get_art_type_config(context.brief.art_type)
    if not art_type_config or not art_type_config.get("programmaticComposition", False):
        return False

    # Gate 2: CD decision
    cd = context.creative_direction
    if not cd or not getattr(cd, "composition_layout", None):
        return False
    if not cd.composition_layout.use_compositor:
        return False

    return True
```

- [ ] **Step 3: Insert Compositor call between Generator and Reviewer**

After the Generator call (around line 115) and BEFORE the Reviewer call (around line 125), insert:

```python
            # --- Compositor (programmatic text + logo overlay) ---
            if self._should_run_compositor(context):
                compositor = CompositorAgent()
                context = await compositor.run(context)
```

This must be inside the iteration loop, so it runs on every iteration (including after Refiner).

- [ ] **Step 4: Fix batch rehydration to use CreativeDirection.from_dict()**

At lines 67-72 in the orchestrator, where `shared_creative_direction` is reconstructed, replace:

```python
# FROM (approximately):
context.creative_direction = CreativeDirection(**context.shared_creative_direction["creative_direction"])

# TO:
context.creative_direction = CreativeDirection.from_dict(
    context.shared_creative_direction["creative_direction"]
)
```

- [ ] **Step 5: Verify syntax**

Run: `python -c "import ast; ast.parse(open('backend/app/agents/orchestrator.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/agents/orchestrator.py
git commit -m "feat: integrate Compositor into pipeline between Generator and Reviewer"
```

---

### Task 11: Update agents __init__.py exports

**Files:**
- Modify: `backend/app/agents/__init__.py`

The `__init__.py` exports all agents and context dataclasses. Add the new exports.

- [ ] **Step 1: Add CompositorAgent and new dataclass exports**

Add to the imports in `__init__.py`:

```python
from app.agents.compositor import CompositorAgent
from app.agents.context import CompositionLayout, TextZone, LogoPlacement
```

And add them to `__all__` if the file uses `__all__`.

- [ ] **Step 2: Commit**

```bash
git add backend/app/agents/__init__.py
git commit -m "feat: export CompositorAgent and composition dataclasses from agents package"
```

---

## Chunk 6: Frontend Types + Final Verification

### Task 12: Update frontend types

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Add CompositionLayout types**

Add to the types file (these mirror the backend dataclasses for pipeline viewer display):

```typescript
export interface TextZone {
  field: string;
  region: 'top' | 'center' | 'bottom';
  alignment: 'left' | 'center' | 'right';
  size_hint: 'large' | 'medium' | 'small';
  style: 'bold' | 'semibold' | 'medium' | 'regular' | 'light';
  color_hint: 'light' | 'dark' | 'auto';
}

export interface LogoPlacement {
  position: string;
  size: 'small' | 'medium' | 'large';
  opacity: number;
}

export interface CompositionLayout {
  use_compositor: boolean;
  text_zones: TextZone[];
  logo_placement: LogoPlacement | null;
  reserved_areas: string[];
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: add CompositionLayout TypeScript types"
```

---

### Task 13: End-to-end verification

- [ ] **Step 1: Verify all modified Python files parse**

```bash
python -c "
import ast, os
files = [
    'backend/app/agents/context.py',
    'backend/app/agents/base_agent.py',
    'backend/app/agents/compositor.py',
    'backend/app/agents/orchestrator.py',
    'backend/app/agents/creative_director.py',
    'backend/app/agents/prompt_engineer.py',
    'backend/app/agents/reviewer.py',
    'backend/app/agents/refiner.py',
    'backend/app/config/art_type_config.py',
]
for f in files:
    try:
        ast.parse(open(f).read())
        print(f'OK: {f}')
    except SyntaxError as e:
        print(f'FAIL: {f} — {e}')
"
```

Expected: all OK

- [ ] **Step 2: Verify font files exist**

```bash
ls -la backend/assets/fonts/*.ttf | wc -l
```

Expected: `7`

- [ ] **Step 3: Verify imports work**

```bash
cd backend && python -c "
from app.agents.context import CompositionLayout, TextZone, LogoPlacement, CreativeDirection
from app.agents.compositor import CompositorAgent
print('All imports OK')
" && cd ..
```

Expected: `All imports OK`

- [ ] **Step 4: Final commit with version bump**

Update the frontend version display (per project convention — `feedback_version_updates.md`):

Find the version string in the frontend and update from v1.5 to v2.0. Common location: a header component or config file.

Find the file with the version string (search for "v1.5" in frontend/src/), update to "v2.0", then:

```bash
git add <version-file>
git commit -m "feat: Artisan v2.0 — bump version for Compositor Agent release"
```

---

## Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Composition dataclasses + from_dict | context.py |
| 2 | BaseAgent client optional | base_agent.py |
| 3 | programmaticComposition config flag | art_type_config.py, artTypeConfig.ts |
| 4 | Font TTF files | backend/assets/fonts/ |
| 5 | Creative Director composition_layout output | creative_director.py |
| 6 | Prompt Engineer reserved zones | prompt_engineer.py |
| 7 | Reviewer composition awareness | reviewer.py |
| 8 | Refiner composition awareness | refiner.py |
| 9 | CompositorAgent (main new file) | compositor.py |
| 10 | Orchestrator integration + batch fix | orchestrator.py |
| 11 | Package exports (if needed) | __init__.py |
| 12 | Frontend TypeScript types | types/index.ts |
| 13 | End-to-end verification + version bump | multiple |
