from dataclasses import dataclass, field
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

    # Agent outputs (populated as pipeline progresses)
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

    @classmethod
    def from_dict(cls, data: dict) -> "PipelineContext":
        """Deserialize from dict."""
        # Reconstruct nested dataclasses
        data["brief"] = BriefData(**data["brief"])
        if data.get("brand"):
            data["brand"] = BrandGuidelines(**data["brand"])
        if data.get("creative_direction"):
            data["creative_direction"] = CreativeDirection(**data["creative_direction"])
        if data.get("generation_prompt"):
            data["generation_prompt"] = GenerationPrompt(**data["generation_prompt"])
        data["generated_images"] = [GeneratedImage(**img) for img in data.get("generated_images", [])]
        if data.get("review"):
            data["review"] = QualityReview(**data["review"])
        data["refinement_history"] = [RefinementStep(**r) for r in data.get("refinement_history", [])]
        data["decision_log"] = [DecisionEntry(**d) for d in data.get("decision_log", [])]
        return cls(**data)
