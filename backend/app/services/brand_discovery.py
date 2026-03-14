from __future__ import annotations

import ipaddress
import json
import re
import socket
from urllib.parse import urlparse

import httpx

from app.config import settings
from app.providers.openrouter_client import OpenRouterClient

_PRIVATE_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def _validate_url(url: str) -> None:
    """Raise ValueError if the URL is unsafe (non-http/https or pointing at private IPs)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"URL scheme '{parsed.scheme}' is not allowed. Only http and https are permitted.")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL has no hostname.")

    try:
        resolved_ip = socket.getaddrinfo(hostname, None)[0][4][0]
    except socket.gaierror as exc:
        raise ValueError(f"Could not resolve hostname '{hostname}': {exc}") from exc

    ip_obj = ipaddress.ip_address(resolved_ip)
    for network in _PRIVATE_NETWORKS:
        if ip_obj in network:
            raise ValueError(f"Requests to private/internal IP addresses are not allowed (resolved: {resolved_ip}).")


async def discover_brand_from_url(website_url: str) -> dict:
    """
    Fetch a website and use AI to extract brand guidelines.
    Returns a dict with brand data that can be used to create/update a Brand.
    """
    # Validate URL to prevent SSRF
    _validate_url(website_url)

    # Step 1: Fetch the website HTML
    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as http:
        response = await http.get(website_url)
        response.raise_for_status()
        html_content = response.text

    # Step 2: Clean HTML — remove script and style tags but keep visible content
    cleaned = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL)
    cleaned = re.sub(r'<style[^>]*>.*?</style>', '', cleaned, flags=re.DOTALL)
    # Keep only first 15000 chars to fit in context
    cleaned = cleaned[:15000]

    # Extract CSS hex colors from raw HTML for context
    css_colors = re.findall(r'#[0-9a-fA-F]{3,8}', html_content)
    css_colors = list(set(css_colors))[:20]  # deduplicate, limit

    # Extract meta description
    meta_description = ""
    meta_match = re.search(
        r'<meta[^>]*name=["\']description["\'][^>]*content=["\'](.*?)["\']',
        html_content,
        re.IGNORECASE,
    )
    if meta_match:
        meta_description = meta_match.group(1)

    # Extract page title
    title = ""
    title_match = re.search(r'<title>(.*?)</title>', html_content, re.IGNORECASE)
    if title_match:
        title = title_match.group(1)

    # Step 3: Use LLM to analyze
    client = OpenRouterClient()
    try:
        system_prompt = """You are a Brand Analyst. Given a website's HTML content, extract brand guidelines.

Analyze the visual identity, tone of voice, and overall brand positioning.

Output JSON:
{
    "name": "Brand name extracted from the site",
    "primary_colors": ["#hex1", "#hex2", "#hex3"],
    "secondary_colors": ["#hex1", "#hex2"],
    "fonts": {"heading": "font name", "body": "font name"},
    "tone_of_voice": "Description of the brand's communication style",
    "do_rules": ["design principles to follow"],
    "dont_rules": ["things to avoid"],
    "style_summary": "Brief description of visual style (e.g., minimalist, bold, corporate)",
    "industry": "What industry/sector the brand is in",
    "target_audience": "Who the brand targets"
}

Look for:
- Colors: CSS colors, brand colors in the design
- Fonts: Google Fonts links, font-family CSS declarations
- Tone: The language used, formal vs casual, etc.
- Style: Minimalist, corporate, playful, luxurious, etc.

Output valid JSON only."""

        user_prompt = f"""Analyze this website and extract brand guidelines.

URL: {website_url}
Title: {title}
Meta Description: {meta_description}
CSS Colors Found: {', '.join(css_colors[:10])}

HTML Content (cleaned):
{cleaned[:10000]}"""

        response_text = await client.chat(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
        )

        # Extract JSON from response (may be wrapped in markdown code blocks)
        text = response_text.strip()
        if text.startswith("```"):
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)

        brand_data = json.loads(text)
        return brand_data
    finally:
        await client.close()
