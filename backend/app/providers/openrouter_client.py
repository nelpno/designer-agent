import base64
import json

import httpx

from app.config import settings


class OpenRouterClient:
    """Unified client for OpenRouter API — handles both LLM and image generation."""

    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.base_url = settings.OPENROUTER_BASE_URL
        self.http_client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://designer-agent.local",
                "X-Title": "Designer Agent"
            },
            timeout=120.0
        )

    async def chat(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 4096,
        response_format: dict | None = None,
    ) -> str:
        """Send a chat completion request (for LLM agents)."""
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            payload["response_format"] = response_format

        response = await self.http_client.post("/chat/completions", json=payload)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

    async def chat_with_vision(
        self,
        model: str,
        messages: list[dict],
        image_base64: str | None = None,
        image_url: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> str:
        """Send a chat completion with image input (for Reviewer Agent)."""
        if image_base64:
            image_content = {
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{image_base64}"},
            }
        elif image_url:
            image_content = {"type": "image_url", "image_url": {"url": image_url}}
        else:
            raise ValueError("Must provide image_base64 or image_url")

        # Append image to last user message
        last_msg = messages[-1]
        if isinstance(last_msg["content"], str):
            last_msg["content"] = [
                {"type": "text", "text": last_msg["content"]},
                image_content,
            ]

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        response = await self.http_client.post("/chat/completions", json=payload)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

    async def generate_image(
        self,
        model: str,
        prompt: str,
        aspect_ratio: str = "1:1",
        image_size: str = "1K",
        additional_params: dict | None = None,
        reference_images: list[str] | None = None,
    ) -> bytes:
        """Generate an image via OpenRouter's image generation API. Returns raw image bytes.

        Args:
            reference_images: list of base64-encoded image strings to use as references
        """
        # Build message content — text first, then reference images
        if reference_images:
            content = [{"type": "text", "text": prompt}]
            for img_b64 in reference_images:
                prefix = img_b64[:20]
                if not prefix.startswith("data:"):
                    img_b64 = f"data:image/png;base64,{img_b64}"
                content.append({
                    "type": "image_url",
                    "image_url": {"url": img_b64},
                })
            user_message = {"role": "user", "content": content}
        else:
            user_message = {"role": "user", "content": prompt}

        payload = {
            "model": model,
            "messages": [user_message],
            "modalities": ["image"],
            "image_config": {
                "aspect_ratio": aspect_ratio,
                "image_size": image_size,
            },
        }
        if additional_params:
            payload["image_config"].update(additional_params)

        response = await self.http_client.post("/chat/completions", json=payload)
        response.raise_for_status()
        data = response.json()

        # Extract base64 image from response
        message = data["choices"][0]["message"]
        content = message.get("content")

        # Helper to extract base64 from a data URL string
        def _decode_data_url(url: str) -> bytes:
            if "," in url:
                return base64.b64decode(url.split(",", 1)[1])
            return base64.b64decode(url)

        # Format 1: content is a list of items (multimodal response)
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict):
                    # {type: "image_url", image_url: {url: "data:..."}}
                    if item.get("type") == "image_url" and isinstance(item.get("image_url"), dict):
                        return _decode_data_url(item["image_url"]["url"])
                    # {type: "image", url: "data:..."}
                    if item.get("type") == "image" and isinstance(item.get("url"), str):
                        return _decode_data_url(item["url"])
                    # {b64_json: "..."} or {data: "..."}
                    if item.get("b64_json"):
                        return base64.b64decode(item["b64_json"])

        # Format 2: content is a string (data URL)
        elif isinstance(content, str) and "base64" in content:
            return _decode_data_url(content)

        # Format 3: content is a dict with image data
        elif isinstance(content, dict):
            if content.get("url"):
                return _decode_data_url(content["url"])
            if content.get("b64_json"):
                return base64.b64decode(content["b64_json"])

        # Format 4: images field on the message
        if "images" in message:
            img = message["images"][0]
            if isinstance(img, str):
                return _decode_data_url(img)
            elif isinstance(img, dict):
                # {type: "image_url", image_url: {url: "data:..."}}
                if isinstance(img.get("image_url"), dict) and img["image_url"].get("url"):
                    return _decode_data_url(img["image_url"]["url"])
                # {url: "data:..."}
                if img.get("url"):
                    return _decode_data_url(img["url"])
                # {b64_json: "..."}
                if img.get("b64_json"):
                    return base64.b64decode(img["b64_json"])

        raise ValueError(f"Could not extract image from response: {json.dumps(data)[:500]}")

    async def close(self):
        await self.http_client.aclose()
