from dataclasses import dataclass, field, fields
from datetime import datetime, timezone
from typing import Any


@dataclass
class BriefData:
    """Immutable user brief data."""
    id: str
    art_type: str
    format: str
    platform: str | None = None
    headline: str | None = None
    body_text: str | None = None
    cta_text: str | None = None
    description: str | None = None
    reference_urls: list[str] = field(default_factory=list)
    inclusion_urls: list[str] = field(default_factory=list)
    slides: list[dict] | None = None
    custom_width: int | None = None
    custom_height: int | None = None


@dataclass
class BrandGuidelines:
    """Brand guidelines for consistency."""
    id: str
    name: str
    primary_colors: list[str] = field(default_factory=list)
    secondary_colors: list[str] = field(default_factory=list)
    fonts: dict[str, str] = field(default_factory=dict)
    tone_of_voice: str | None = None
    do_rules: list[str] = field(default_factory=list)
    dont_rules: list[str] = field(default_factory=list)
    logo_url: str | None = None


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


@dataclass
class CreativeDirection:
    """Output of Creative Director Agent."""
    mood: str
    style: str
    composition_notes: str
    color_palette: list[str]
    selected_art_type: str  # refined art type
    typography_direction: str | None = None
    reference_analysis: str | None = None
    has_significant_text: bool = False  # determines model routing
    composition_layout: CompositionLayout | None = None

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


@dataclass
class GenerationPrompt:
    """Output of Prompt Engineer Agent."""
    main_prompt: str
    selected_model: str  # OpenRouter model ID
    negative_prompt: str | None = None
    aspect_ratio: str = "1:1"
    image_size: str = "1K"
    additional_params: dict[str, Any] = field(default_factory=dict)


@dataclass
class GeneratedImage:
    """Output of Generator Agent."""
    image_url: str  # local storage URL
    model_used: str
    prompt_used: str
    generation_params: dict[str, Any] = field(default_factory=dict)


@dataclass
class QualityReview:
    """Output of Reviewer Agent."""
    overall_score: int  # 0-100
    composition_score: int
    text_accuracy_score: int
    brand_alignment_score: int
    technical_score: int
    visual_integrity_score: int = 100
    hard_reject: bool = False
    issues: list[dict[str, str]] = field(default_factory=list)  # [{type, description, severity}]
    approved: bool = False
    summary: str = ""


@dataclass
class RefinementStep:
    """One refinement iteration."""
    iteration: int
    strategy: str  # "re_prompt", "model_switch", "parameter_adjust"
    changes_made: str
    new_prompt: str | None = None
    new_model: str | None = None


@dataclass
class DecisionEntry:
    """Logged decision from an agent."""
    agent_name: str
    timestamp: str  # ISO format
    decision: str
    reasoning: str


@dataclass
class PipelineContext:
    """Shared context object that flows through the entire agent pipeline."""
    # Immutable input
    brief_id: str
    brief: BriefData
    brand: BrandGuidelines | None = None
    generation_id: str | None = None  # unique per generation (used for storage paths)

    # Batch / multi-format fields
    batch_id: str | None = None
    format_label: str | None = None
    shared_creative_direction: dict | None = None  # shared across batch

    # Carousel per-slide fields
    current_slide_index: int | None = None  # which slide this generation is for
    total_slides: int | None = None  # total slides in the carousel

    # Anchor image for batch visual consistency (first-generated image used as reference)
    anchor_image_url: str | None = None

    # Agent outputs (populated as pipeline progresses)
    enhanced_description: str | None = None  # enriched by Creative Director
    creative_direction: CreativeDirection | None = None
    generation_prompt: GenerationPrompt | None = None
    generated_images: list[GeneratedImage] = field(default_factory=list)
    review: QualityReview | None = None
    refinement_history: list[RefinementStep] = field(default_factory=list)

    # Pipeline metadata
    iteration: int = 0
    max_iterations: int = 3
    decision_log: list[DecisionEntry] = field(default_factory=list)
    current_status: str = "pending"
    started_at: str | None = None
    completed_at: str | None = None

    def log_decision(self, agent_name: str, decision: str, reasoning: str):
        self.decision_log.append(DecisionEntry(
            agent_name=agent_name,
            timestamp=datetime.now(timezone.utc).isoformat(),
            decision=decision,
            reasoning=reasoning
        ))

    def to_dict(self) -> dict:
        """Serialize to dict for JSON storage in database."""
        from dataclasses import asdict
        return asdict(self)

    @staticmethod
    def _filter_fields(cls, data: dict) -> dict:
        """Filter dict to only known fields of a dataclass."""
        from dataclasses import fields as dc_fields
        valid = {f.name for f in dc_fields(cls)}
        return {k: v for k, v in data.items() if k in valid}

    @classmethod
    def from_dict(cls, data: dict) -> "PipelineContext":
        """Deserialize from dict."""
        _ff = cls._filter_fields

        # Reconstruct nested dataclasses (filter unknown fields for compatibility)
        data["brief"] = BriefData(**_ff(BriefData, data["brief"]))
        if data.get("brand"):
            data["brand"] = BrandGuidelines(**_ff(BrandGuidelines, data["brand"]))
        if data.get("creative_direction"):
            data["creative_direction"] = CreativeDirection.from_dict(data["creative_direction"])
        if data.get("generation_prompt"):
            data["generation_prompt"] = GenerationPrompt(**_ff(GenerationPrompt, data["generation_prompt"]))
        data["generated_images"] = [GeneratedImage(**_ff(GeneratedImage, img)) for img in data.get("generated_images", [])]
        if data.get("review"):
            data["review"] = QualityReview(**_ff(QualityReview, data["review"]))
        data["refinement_history"] = [RefinementStep(**_ff(RefinementStep, r)) for r in data.get("refinement_history", [])]
        data["decision_log"] = [DecisionEntry(**_ff(DecisionEntry, d)) for d in data.get("decision_log", [])]
        # Filter to only known fields for forward/backward compatibility
        filtered = _ff(cls, data)
        return cls(**filtered)
