from __future__ import annotations

import base64
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


def _normalize_hex(color: str) -> str | None:
    """Normalize a hex color to #RRGGBB format. Returns None if invalid."""
    color = color.strip()
    if not color.startswith("#"):
        color = f"#{color}"
    hex_part = color[1:]
    # Expand 3-char shorthand (#RGB → #RRGGBB)
    if len(hex_part) == 3 and all(c in "0123456789abcdefABCDEF" for c in hex_part):
        hex_part = "".join(c * 2 for c in hex_part)
    # Validate 6-char hex
    if len(hex_part) == 6 and all(c in "0123456789abcdefABCDEF" for c in hex_part):
        return f"#{hex_part.upper()}"
    return None


async def discover_brand_from_url(website_url: str, logo_base64: str | None = None) -> dict:
    """
    Fetch a website and use AI to extract brand guidelines.
    Optionally analyzes the brand logo for accurate color extraction.
    Returns a dict with brand data that can be used to create/update a Brand.
    """
    # Auto-add https:// if no scheme provided
    if not website_url.startswith(("http://", "https://")):
        website_url = f"https://{website_url}"

    # Validate URL to prevent SSRF
    _validate_url(website_url)

    # Step 1: Fetch the website HTML
    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0, verify=False) as http:
        response = await http.get(website_url)
        response.raise_for_status()
        html_content = response.text

    # Step 2: Clean HTML — remove script and style tags but keep visible content
    cleaned = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL)
    cleaned = re.sub(r'<style[^>]*>.*?</style>', '', cleaned, flags=re.DOTALL)
    cleaned = cleaned[:15000]

    # Extract CSS hex colors from raw HTML for context
    css_colors = re.findall(r'#[0-9a-fA-F]{6}', html_content)
    css_colors = list(set(css_colors))[:20]

    # Extract inline styles for better color context
    style_blocks = re.findall(r'<style[^>]*>(.*?)</style>', html_content, re.DOTALL)
    style_text = "\n".join(style_blocks)[:5000]

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

    # Extract Google Fonts
    font_links = re.findall(r'fonts\.googleapis\.com/css2?\?family=([^"&]+)', html_content)
    font_families = re.findall(r'font-family:\s*["\']?([^"\';\}]+)', style_text)

    # Step 3: Use LLM to analyze (with vision if logo provided)
    client = OpenRouterClient()
    try:
        system_prompt = """Você é um Analista de Marca especialista. Dado o conteúdo de um website, extraia as diretrizes visuais da marca.

IMPORTANTE — Foco na IDENTIDADE VISUAL da marca:
- As cores primárias são as cores do LOGO e elementos principais da marca (cabeçalhos, botões de CTA, links principais), NÃO cores decorativas do site.
- Se uma imagem de logo foi fornecida, analise-a para extrair as cores REAIS da marca.
- Cores de fundo (#FFFFFF, #000000, #F5F5F5) geralmente são secundárias, não primárias.
- Ignore cores de ícones genéricos, redes sociais, ou elementos não relacionados à marca.

Output JSON (TODOS os textos em Português Brasileiro):
{
    "name": "Nome da marca",
    "primary_colors": ["#RRGGBB", "#RRGGBB"],
    "secondary_colors": ["#RRGGBB"],
    "fonts": {"heading": "nome da fonte", "body": "nome da fonte"},
    "tone_of_voice": "Descrição do tom de comunicação da marca EM PORTUGUÊS",
    "do_rules": ["regras de design a seguir EM PORTUGUÊS"],
    "dont_rules": ["coisas a evitar EM PORTUGUÊS"],
    "style_summary": "Descrição breve do estilo visual EM PORTUGUÊS",
    "industry": "Setor/indústria da marca",
    "target_audience": "Público-alvo da marca"
}

REGRAS CRÍTICAS:
- TODAS as cores devem ser HEX de 6 dígitos (#RRGGBB), nunca 3 dígitos ou incompletos
- Se o logo foi fornecido como imagem, as cores do logo TÊM PRIORIDADE sobre as cores CSS
- Tom de voz e regras DEVEM ser em Português Brasileiro
- Output válido JSON apenas, sem markdown."""

        user_prompt = f"""Analise este website e extraia as diretrizes de marca.

URL: {website_url}
Título: {title}
Meta Description: {meta_description}
Cores CSS encontradas no site: {', '.join(css_colors[:15])}
Fontes Google encontradas: {', '.join(font_links[:5]) if font_links else 'nenhuma'}
Fontes CSS encontradas: {', '.join(list(set(font_families))[:5]) if font_families else 'nenhuma'}

HTML (limpo):
{cleaned[:8000]}"""

        if logo_base64:
            # Use vision to analyze the logo
            response_text = await client.chat_with_vision(
                model=settings.LLM_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt + "\n\nA imagem abaixo é o LOGO da marca. Analise as cores e elementos visuais do logo para determinar as cores primárias da marca."},
                ],
                image_base64=logo_base64,
                temperature=0.3,
            )
        else:
            response_text = await client.chat(
                model=settings.LLM_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
            )

        # Extract JSON from response
        text = response_text.strip()
        if text.startswith("```"):
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)

        brand_data = json.loads(text)

        # Validate and normalize hex colors
        for field in ("primary_colors", "secondary_colors"):
            if field in brand_data and isinstance(brand_data[field], list):
                brand_data[field] = [
                    normalized
                    for c in brand_data[field]
                    if (normalized := _normalize_hex(c)) is not None
                ]

        return brand_data
    finally:
        await client.close()
