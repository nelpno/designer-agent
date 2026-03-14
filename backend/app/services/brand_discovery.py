from __future__ import annotations

import base64
import ipaddress
import json
import logging
import re
import socket
from urllib.parse import urlparse, urljoin

import httpx

from app.config import settings
from app.providers.openrouter_client import OpenRouterClient

logger = logging.getLogger(__name__)

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

_ABOUT_PATHS = ["/sobre", "/about", "/about-us", "/quem-somos", "/empresa", "/institucional"]

_SOCIAL_PATTERNS = {
    "instagram": re.compile(r'https?://(?:www\.)?instagram\.com/([a-zA-Z0-9_.]+)', re.IGNORECASE),
    "facebook": re.compile(r'https?://(?:www\.)?facebook\.com/([a-zA-Z0-9_.]+)', re.IGNORECASE),
    "linkedin": re.compile(r'https?://(?:www\.)?linkedin\.com/(?:company|in)/([a-zA-Z0-9_-]+)', re.IGNORECASE),
}


def _validate_url(url: str) -> None:
    """Raise ValueError if the URL is unsafe (non-http/https or pointing at private IPs)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"URL scheme '{parsed.scheme}' is not allowed.")

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
    if len(hex_part) == 3 and all(c in "0123456789abcdefABCDEF" for c in hex_part):
        hex_part = "".join(c * 2 for c in hex_part)
    if len(hex_part) == 6 and all(c in "0123456789abcdefABCDEF" for c in hex_part):
        return f"#{hex_part.upper()}"
    return None


def _extract_social_links(html: str) -> dict[str, str]:
    """Extract social media handles from HTML."""
    socials = {}
    for platform, pattern in _SOCIAL_PATTERNS.items():
        match = pattern.search(html)
        if match:
            handle = match.group(1).rstrip("/")
            if handle not in ("share", "sharer", "dialog", "intent"):
                socials[platform] = handle
    return socials


def _clean_html(html: str) -> str:
    """Remove scripts, styles, and HTML tags, keep visible text."""
    text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


async def _fetch_page(http: httpx.AsyncClient, url: str) -> str | None:
    """Fetch a page, return text or None on failure."""
    try:
        resp = await http.get(url, timeout=10.0)
        if resp.status_code == 200:
            return resp.text
    except Exception:
        pass
    return None


async def _gather_extra_context(http: httpx.AsyncClient, website_url: str, html_content: str) -> str:
    """Gather additional context from about pages, Instagram, etc."""
    parsed = urlparse(website_url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    extra_parts = []

    # 1. Try about/sobre pages
    for path in _ABOUT_PATHS:
        about_html = await _fetch_page(http, urljoin(base_url, path))
        if about_html and len(about_html) > 500:
            about_text = _clean_html(about_html)[:3000]
            extra_parts.append(f"## Página {path}\n{about_text}")
            logger.info(f"Found about page: {path}")
            break  # Only use the first one found

    # 2. Extract and fetch social media
    socials = _extract_social_links(html_content)

    if "instagram" in socials:
        handle = socials["instagram"]
        ig_html = await _fetch_page(http, f"https://www.instagram.com/{handle}/")
        if ig_html:
            # Extract meta description (Instagram puts bio there)
            bio_match = re.search(
                r'<meta\s+(?:property="og:description"|name="description")\s+content="([^"]*)"',
                ig_html, re.IGNORECASE,
            )
            bio = bio_match.group(1) if bio_match else ""
            # Extract follower count from meta
            followers_match = re.search(r'([\d,.]+[KMkm]?)\s*(?:Followers|seguidores)', ig_html, re.IGNORECASE)
            followers = followers_match.group(1) if followers_match else "N/A"
            extra_parts.append(
                f"## Instagram @{handle}\n"
                f"Bio: {bio}\n"
                f"Seguidores: {followers}"
            )
            logger.info(f"Found Instagram: @{handle}")

    if "facebook" in socials:
        extra_parts.append(f"## Facebook: /{socials['facebook']}")

    if "linkedin" in socials:
        extra_parts.append(f"## LinkedIn: /{socials['linkedin']}")

    # Add social handles summary
    if socials:
        extra_parts.append(f"## Redes Sociais encontradas: {', '.join(f'{k}: @{v}' for k, v in socials.items())}")

    return "\n\n".join(extra_parts)


async def discover_brand_from_url(website_url: str, logo_base64: str | None = None) -> dict:
    """
    Fetch a website, about pages, and social media profiles to extract brand guidelines.
    Optionally analyzes the brand logo for accurate color extraction.
    """
    if not website_url.startswith(("http://", "https://")):
        website_url = f"https://{website_url}"

    _validate_url(website_url)

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=30.0,
        headers={"User-Agent": "Mozilla/5.0 (compatible; DesignerAgent/1.0)"},
    ) as http:
        # Step 1: Fetch main page
        response = await http.get(website_url)
        response.raise_for_status()
        html_content = response.text

        # Step 2: Gather extra context (about pages, Instagram, etc.)
        extra_context = await _gather_extra_context(http, website_url, html_content)

    # Step 3: Extract structured data from HTML
    cleaned = _clean_html(html_content)[:8000]

    css_colors = re.findall(r'#[0-9a-fA-F]{6}', html_content)
    css_colors = list(set(css_colors))[:20]

    style_blocks = re.findall(r'<style[^>]*>(.*?)</style>', html_content, re.DOTALL)
    style_text = "\n".join(style_blocks)[:5000]

    meta_description = ""
    meta_match = re.search(
        r'<meta[^>]*name=["\']description["\'][^>]*content=["\'](.*?)["\']',
        html_content, re.IGNORECASE,
    )
    if meta_match:
        meta_description = meta_match.group(1)

    title = ""
    title_match = re.search(r'<title>(.*?)</title>', html_content, re.IGNORECASE)
    if title_match:
        title = title_match.group(1)

    font_links = re.findall(r'fonts\.googleapis\.com/css2?\?family=([^"&]+)', html_content)
    font_families = re.findall(r'font-family:\s*["\']?([^"\';\}]+)', style_text)

    socials = _extract_social_links(html_content)

    # Step 4: Use LLM to analyze
    client = OpenRouterClient()
    try:
        system_prompt = """Você é um Analista de Marca especialista. Analise TODAS as informações fornecidas (site, redes sociais, páginas sobre) para extrair diretrizes visuais da marca.

IMPORTANTE — Foco na IDENTIDADE VISUAL da marca:
- As cores primárias são as cores do LOGO e elementos principais da marca (cabeçalhos, botões de CTA, links), NÃO cores decorativas.
- Se uma imagem de logo foi fornecida, analise-a para extrair as cores REAIS da marca.
- Cores de fundo (#FFFFFF, #000000, #F5F5F5) geralmente são secundárias, não primárias.
- Use informações do Instagram e página sobre para entender melhor o tom de voz e posicionamento.

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
Redes Sociais: {', '.join(f'{k}: @{v}' for k, v in socials.items()) if socials else 'nenhuma encontrada'}
Cores CSS encontradas: {', '.join(css_colors[:15])}
Fontes Google: {', '.join(font_links[:5]) if font_links else 'nenhuma'}
Fontes CSS: {', '.join(list(set(font_families))[:5]) if font_families else 'nenhuma'}

Conteúdo do site:
{cleaned[:6000]}"""

        if extra_context:
            user_prompt += f"\n\n## Informações Adicionais (páginas sobre, redes sociais)\n{extra_context[:3000]}"

        if logo_base64:
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
