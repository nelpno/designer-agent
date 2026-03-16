from abc import ABC, abstractmethod
import time

from app.agents.context import PipelineContext
from app.providers.openrouter_client import OpenRouterClient


class BaseAgent(ABC):
    """Abstract base class for all pipeline agents."""

    name: str = "base_agent"

    def __init__(self, client: OpenRouterClient | None = None):
        self.client = client

    async def run(self, context: PipelineContext) -> PipelineContext:
        """Execute the agent and return updated context."""
        start_time = time.time()
        context.current_status = f"running_{self.name}"

        try:
            context = await self.execute(context)
            duration_ms = int((time.time() - start_time) * 1000)
            context.log_decision(
                agent_name=self.name,
                decision=f"{self.name} completed in {duration_ms}ms",
                reasoning=self._get_completion_reasoning(context)
            )
        except Exception as e:
            context.log_decision(
                agent_name=self.name,
                decision=f"{self.name} failed: {str(e)}",
                reasoning=f"Error during execution: {type(e).__name__}"
            )
            raise

        return context

    @abstractmethod
    async def execute(self, context: PipelineContext) -> PipelineContext:
        """Implement agent-specific logic. Must return updated context."""
        ...

    def _get_completion_reasoning(self, context: PipelineContext) -> str:
        """Override to provide custom completion reasoning."""
        return f"{self.name} executed successfully"
