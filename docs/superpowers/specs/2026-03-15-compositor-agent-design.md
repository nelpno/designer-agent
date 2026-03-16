# Artisan v2.0 — Compositor Agent: Texto e Logo Programático

## Resumo

Novo agente **Compositor** no pipeline, entre Generator e Reviewer, que sobrepõe texto e logo via Pillow sobre imagens geradas por IA. Elimina os 2 maiores problemas de qualidade: texto ilegível/com artefatos e logo inconsistente.

### Decisões de Design (validadas com usuário)

| Decisão | Escolha |
|---|---|
| Art types com composição | ad_creative, social_post, carousel, presentation_slide, brand_material |
| Art types sem composição | logo, product_shot, lifestyle_photo, mockup, illustration |
| Estratégia de imagem | Zonas reservadas (modelo gera com áreas livres para texto/logo) |
| Fontes | Híbrido: Sora + DM Sans padrão, campo fonts da marca para futuro upload |
| Quem define layout | Creative Director define text_layout + logo_placement |
| Logo programático | Sim, CD define posição e tamanho |
| Pós-processamento | Mínimo: sharpening sutil (antes do texto) |
| Controle opt-in | Duplo gate: config do art type + CD por geração |
| Arquitetura | Agente dedicado CompositorAgent(BaseAgent) |

---

## 1. Pipeline Modificado

```
Creative Director → Prompt Engineer → Generator → [Compositor] → Reviewer → Refiner loop
                                                      ↑ NOVO
```

### Fluxo de dados:

1. **Creative Director** — retorna `CreativeDirection` com novo campo `composition_layout`
2. **Prompt Engineer** — lê `composition_layout.reserved_areas` e instrui modelo a deixar zonas livres
3. **Generator** — gera imagem com zonas reservadas (sem texto, espaço para logo)
4. **Compositor** — sharpen na imagem base + sobrepõe texto + logo. Substitui `image_url` no context
5. **Reviewer** — avalia imagem final (com texto e logo compostos)
6. **Refiner** — se reprovado, pode ajustar prompt OU layout para próxima iteração

### Bypass (quando Compositor não roda):

- `programmaticComposition: false` no art_type_config → Orchestrator pula Compositor
- `composition_layout.use_compositor: false` retornado pelo CD → Orchestrator pula Compositor
- Pipeline funciona exatamente como v1.5

---

## 2. Creative Director — Extensão

### Novo campo em CreativeDirection: `composition_layout`

```python
@dataclass
class CompositionLayout:
    use_compositor: bool                    # gate fino: CD decide se esta geração precisa
    text_zones: list[TextZone]              # posições para cada campo de texto
    logo_placement: LogoPlacement | None    # posição do logo (None se sem marca)
    reserved_areas: list[str]               # instruções em texto para o PE

@dataclass
class TextZone:
    field: str          # "headline" | "body_text" | "cta_text" | "slide_headline" | "slide_body"
    region: str         # "top" | "center" | "bottom" (vertical)
    alignment: str      # "left" | "center" | "right" (horizontal)
    size_hint: str      # "large" | "medium" | "small"
    style: str          # "bold" | "semibold" | "medium" | "regular" | "light"
    color_hint: str     # "light" | "dark" | "auto" — orienta cor do texto vs fundo

@dataclass
class LogoPlacement:
    position: str       # grid 3x3: "top-left", "top-center", ..., "bottom-right"
    size: str           # "small" | "medium" | "large"
    opacity: float      # 0.0-1.0 (1.0 padrão, <1.0 para marca d'água)
```

### Lógica do CD:

1. Recebe brief com campos de texto preenchidos + art type config
2. Se `programmaticComposition: true` no config:
   - Analisa quais campos de texto estão preenchidos
   - Define posicionamento baseado no tipo de arte e composição visual
   - Define `reserved_areas` como descrições textuais para o PE
   - Se nenhum texto preenchido E sem logo → `use_compositor: false`
3. Se `programmaticComposition: false` → não retorna `composition_layout`

### Prompt adicional do CD (condicional):

Adicionado ao system prompt quando `programmaticComposition: true`:

```
## Composição Programática

Textos e logo serão sobrepostos programaticamente sobre a imagem gerada.
Você deve definir um `composition_layout` que especifica:

- Para cada campo de texto preenchido: posição (region + alignment), tamanho,
  estilo e se o texto deve ser claro ou escuro baseado no fundo que você imagina.
- Para o logo da marca (se existir): posição no grid 3x3 e tamanho.
- reserved_areas: lista de descrições textuais das áreas que devem ficar livres
  na imagem (ex: "terço superior para headline grande", "canto inferior direito
  para botão CTA").

Pense na composição visual como um todo: texto, logo e imagem devem formar uma
peça profissional e equilibrada. As reserved_areas são traduzidas em instruções
para o modelo de imagem.
```

---

## 3. Prompt Engineer — Instruções de Zona Reservada

### Mudança:

O PE já recebe `creative_direction` do CD. Quando `composition_layout` está presente:

1. Lê `reserved_areas` do layout
2. Adiciona instruções explícitas ao prompt de imagem:
   - "Generate the image WITHOUT any text, letters, words, or typography"
   - "Leave the [region] area relatively clean/simple for text overlay"
   - "Reserve the [position] corner for a logo placement"
3. Mantém instrução de NÃO gerar texto (evitar artefatos de texto do modelo)

### Exemplo de prompt gerado:

```
Create a vibrant social media post background for a fitness brand.
- Dynamic composition with energetic colors (electric blue, coral)
- DO NOT include any text, words, letters, or typography in the image
- Leave the top third of the image with a darker, less busy area
  suitable for a large headline overlay
- Keep the bottom 20% relatively simple for a call-to-action button
- Reserve the top-left corner (small area) for logo placement
- Focus on visual impact: abstract energy patterns, motion blur,
  athletic silhouettes in the background
```

### Modelo continua sendo selecionado normalmente:

O model_router não muda. Mesmo com composição programática, Nano Banana Pro ainda é melhor para art types de texto (gera melhores composições visuais), e FLUX para foto.

---

## 4. Compositor Agent

### Arquivo: `backend/app/agents/compositor.py`

**BaseAgent client:** O `BaseAgent.__init__` requer `client: OpenRouterClient`. O Compositor não faz
chamadas LLM — é processamento Pillow puro. Solução concreta: alterar `BaseAgent.__init__` para
`client: OpenRouterClient | None = None`. Mudança de uma linha, sem impacto nos agentes existentes
(todos já passam client explicitamente). Isso permite `CompositorAgent()` sem argumentos e satisfaz
type checkers.

```python
class CompositorAgent(BaseAgent):
    name = "compositor"

    async def execute(self, context: PipelineContext) -> PipelineContext:
        layout = context.creative_direction.composition_layout
        if not layout or not layout.use_compositor:
            return context

        # 1. Carregar imagem gerada
        image = self._load_image(context.generated_images[-1].image_url)

        # 2. Aplicar sharpening ANTES do texto (evita ringing em bordas de texto)
        image = self._sharpen(image)

        # 3. Compor texto
        if layout.text_zones:
            image = self._compose_text(image, layout, context)

        # 4. Compor logo
        brand = context.brand
        if layout.logo_placement and brand and brand.logo_url:
            image = self._compose_logo(image, layout.logo_placement, brand)

        # 5. Salvar resultado (substitui imagem original)
        composed_url = self._save_composed(image, context)

        # 6. Atualizar contexto
        context.generated_images[-1].image_url = composed_url

        return context
```

### 4.1. Renderização de Texto (`_compose_text`)

```
Para cada TextZone no composition_layout.text_zones:

1. Resolver fonte:
   - Checar brand.fonts[zone.style_category] (heading→Sora, body→DM Sans)
   - Fallback: Sora Bold para headlines, DM Sans Regular para body/CTA
   - Carregar arquivo TTF de backend/assets/fonts/

2. Calcular tamanho da fonte:
   - Baseado em zone.size_hint + dimensões da imagem
   - large: ~6-8% da altura da imagem
   - medium: ~4-5% da altura
   - small: ~2.5-3.5% da altura
   - Auto-shrink se texto não cabe na região

3. Determinar cor do texto:
   - Se zone.color_hint == "auto": analisar luminosidade média da região alvo
     - Calcular luminância média: L = 0.299*R + 0.587*G + 0.114*B (fórmula ITU-R BT.601)
     - Se L < 128 → texto branco (#FFFFFF)
     - Se L >= 128 → texto preto (#1C1C1E)
   - Se "light" → branco (#FFFFFF)
   - Se "dark" → preto (#1C1C1E)
   - Verificação de contraste: ratio mínimo 4.5:1 (WCAG AA). Se brand.primary_colors[0]
     atinge esse ratio contra o fundo, usar como cor do texto. Senão, usar branco/preto.

4. Calcular posição:
   - region (top/center/bottom) → faixa vertical (0-33%, 33-66%, 66-100%)
   - alignment (left/center/right) → alinhamento horizontal com padding (5% margem)
   - Centralizar texto na faixa

5. Renderizar:
   - PIL ImageDraw.text() com font, posição, cor
   - Opcional: sombra sutil (2px offset, 50% opacity) para legibilidade
   - Word wrap automático para textos longos (body_text)
```

### 4.2. Renderização de Logo (`_compose_logo`)

```
1. Carregar logo:
   - Se data:image/...;base64,... → decodificar
   - Se path no storage → carregar arquivo
   - Converter para RGBA (preservar transparência)

2. Redimensionar:
   - small: 8% da largura da imagem
   - medium: 12% da largura
   - large: 18% da largura
   - Manter aspect ratio do logo

3. Posicionar (grid 3x3):
   - top-left: padding 5% de cada borda
   - top-center: centrado horizontal, 5% do topo
   - bottom-right: 5% de cada borda inferior/direita
   - etc.

4. Compor:
   - PIL Image.paste() com máscara alpha
   - Respeitar opacity do LogoPlacement (Image.putalpha se < 1.0)
```

### 4.3. Sharpening (`_sharpen`)

```
- Aplicado ANTES da composição de texto (evita ringing/halo em bordas de texto nítido)
- PIL ImageFilter.UnsharpMask(radius=1.5, percent=30, threshold=3)
- Valores conservadores para não criar artefatos
- (Futuro: color correction, upscale — não na v2.0)
```

### 4.4. Salvamento

```
1. PNG composto:
   - Salva como gen_iter{N}_composed.png no mesmo diretório
   - Atualiza context.generated_images[-1].image_url

2. Thumbnail:
   - Chama save_thumbnail() do storage_service com a imagem composta
   - Sobrescreve o thumbnail gerado anteriormente pelo Generator
   - Reutiliza a mesma função existente (WebP 400px, qualidade 80)

3. WebP: não na v2.0 (simplifica scope — PNG já é o formato padrão do pipeline)
```

### 4.5. Fail-safe

```
- Todo o execute() em try/except
- Se qualquer etapa falhar → log warning + retorna context inalterado
- Pipeline continua com imagem original (sem composição)
- Nunca quebra o pipeline por falha de composição
```

---

## 5. Orchestrator — Integração

### Mudança em `orchestrator.py`:

```python
# Após Generator, antes do Reviewer:
if self._should_run_compositor(context):
    compositor = CompositorAgent(client=None)  # Compositor não usa LLM
    context = await compositor.run(context)
```

### `_should_run_compositor`:

```python
def _should_run_compositor(self, context: PipelineContext) -> bool:
    # Gate 1: art type config
    art_type = context.brief.art_type
    config = get_art_type_config(art_type) or {}
    if not config.get("programmaticComposition", False):
        return False

    # Gate 2: CD decision (composition_layout vive em creative_direction)
    cd = context.creative_direction
    if not cd or not cd.composition_layout or not cd.composition_layout.use_compositor:
        return False

    return True
```

### Posição no loop de qualidade:

```
Iteração 1: CD → PE → Generator → Compositor → Reviewer
Iteração 2 (se reprovado): Refiner → Generator → Compositor → Reviewer
Iteração 3 (se reprovado): Refiner → Generator → Compositor → Reviewer
```

O Compositor roda em **toda iteração** — se o Refiner ajustar o prompt e gerar nova imagem, o texto/logo é recomposto. O `composition_layout` permanece fixo (output do CD) — só a imagem de fundo muda entre iterações.

### Batch/Carousel — Rehydration de CreativeDirection:

**Bug existente a corrigir:** O orchestrator atual reconstrói `CreativeDirection` via `CreativeDirection(**shared_cd["creative_direction"])` (raw dict unpacking). Com o novo campo `composition_layout` (que é um nested dataclass), isso resultaria em `composition_layout` sendo um dict plain em vez de `CompositionLayout`.

**Correção necessária:** Criar `CreativeDirection.from_dict(data: dict) -> CreativeDirection` class method que reconstrói nested dataclasses corretamente (incluindo `CompositionLayout`, `TextZone`, `LogoPlacement`). Atualizar **todos os pontos** que reconstroem `CreativeDirection` para usar `.from_dict()` em vez de `**dict`:
- `orchestrator.py` (batch rehydration)
- `tasks/` (Celery task rehydration do shared_creative_direction)
- `PipelineContext.from_dict()` (já usa pattern similar para outros dataclasses)

---

## 6. Art Type Config — Novo Campo

### Backend (`art_type_config.py`):

```python
"ad_creative": {
    "label": "Ad Creative",
    "programmaticComposition": True,  # NOVO
    "textFields": [...],
    ...
},
"illustration": {
    "label": "Ilustração",
    "programmaticComposition": False,  # NOVO (default)
    ...
},
```

**Art types com composição:** ad_creative, social_post, carousel, presentation_slide, brand_material
**Art types sem composição:** logo, product_shot, lifestyle_photo, mockup, illustration

### Frontend (`artTypeConfig.ts`) — mirror:

Mesmo campo adicionado. Frontend não precisa agir sobre ele (é decisão do backend), mas mantém paridade.

---

## 7. PipelineContext — Novos Campos

### Onde vive `composition_layout`:

O `composition_layout` é um campo de `CreativeDirection` (não do PipelineContext diretamente).
O CD o produz como parte da direção criativa, e é acessado via `context.creative_direction.composition_layout`.

```python
@dataclass
class CreativeDirection:
    # ... campos existentes (mood, style, composition, color_palette, typography, has_significant_text) ...
    composition_layout: CompositionLayout | None = None  # NOVO — None quando programmaticComposition=false
```

O PipelineContext **não** ganha campo `composition_layout` — acesso sempre via `creative_direction`.

### Serialização (`from_dict` / `to_dict`):

A deserialização de `CompositionLayout` é multi-nível e precisa ser explícita no `from_dict`:

```python
# Em CreativeDirection.from_dict():
if "composition_layout" in data and data["composition_layout"]:
    cl = data["composition_layout"]
    composition_layout = CompositionLayout(
        use_compositor=cl.get("use_compositor", False),
        text_zones=[
            TextZone(**tz) for tz in cl.get("text_zones", [])
        ],
        logo_placement=(
            LogoPlacement(**cl["logo_placement"])
            if cl.get("logo_placement") else None
        ),
        reserved_areas=cl.get("reserved_areas", []),
    )
```

`to_dict()` usa `dataclasses.asdict()` que já serializa recursivamente — sem mudança necessária.

Campos desconhecidos continuam sendo filtrados pelo pattern existente em `from_dict`.

---

## 8. Fonts — Gestão de Arquivos

### Diretório: `backend/assets/fonts/`

```
backend/assets/fonts/
├── Sora-Bold.ttf
├── Sora-SemiBold.ttf
├── Sora-Regular.ttf
├── Sora-Light.ttf
├── DM_Sans-Bold.ttf
├── DM_Sans-Medium.ttf
└── DM_Sans-Regular.ttf
```

### Resolução de fonte:

```python
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
    }
}

def resolve_font(brand_fonts: dict, zone: TextZone) -> str:
    """Retorna path do TTF para a zona."""
    # 1. Checar se brand tem fonte custom para o role
    role = "heading" if zone.field in ("headline", "slide_headline") else "body"
    font_name = brand_fonts.get(role, "Sora" if role == "heading" else "DM Sans")

    # 2. Buscar no FONT_MAP
    family = FONT_MAP.get(font_name, FONT_MAP["Sora"])  # fallback Sora
    style_file = family.get(zone.style, family["regular"])  # fallback regular

    return os.path.join(FONTS_DIR, style_file)
```

### Licenciamento:

Sora e DM Sans são Google Fonts sob SIL Open Font License — livre para bundling em projetos.

### Futuro (upload de fontes):

O campo `brand.fonts` já suporta nomes arbitrários. Quando upload for implementado:
1. Salvar TTF em `storage/{brand_id}/fonts/`
2. Adicionar ao FONT_MAP dinamicamente
3. `resolve_font()` checa storage antes do map estático

---

## 9. Carrossel — Comportamento Especial

Carrossel gera N slides como gerações separadas. Cada slide tem seus próprios campos (`slide_headline`, `slide_body`).

### CD define layout uma vez (shared):

O `composition_layout` é serializado dentro do `shared_creative_direction` do batch, junto com o resto do `CreativeDirection`:

```python
# No router (generations.py), após CD rodar:
shared_creative_direction = {
    "creative_direction": creative_direction.to_dict(),
    # composition_layout já está dentro de creative_direction.to_dict()
}
```

Cada task Celery reconstrói o `CreativeDirection` (incluindo `composition_layout`) via `from_dict()`.
Todos os slides usam o **mesmo layout** para consistência visual — mesmas posições, fontes, tamanhos.

### Per-slide:

- O `text_zones` define posições fixas (ex: headline no topo, body no centro)
- O Compositor resolve o **conteúdo** do texto usando `current_slide_index` para pegar o slide correto do brief
- Ex: slide 0 → `brief.slides[0].headline`, slide 1 → `brief.slides[1].headline`
- Logo aparece no mesmo lugar em todos os slides

---

## 10. Reviewer — Ajuste de Avaliação

### Quando Compositor rodou:

O Reviewer já avalia `text_accuracy_score`. Com texto programático, esse score deve ser praticamente 100 (texto é perfeito por construção).

Ajuste no prompt do Reviewer quando composição programática está ativa:

```
Textos e logo foram sobrepostos programaticamente (não gerados pela IA).
Avalie o text_accuracy_score focando em:
- Legibilidade (contraste texto vs fundo)
- Posicionamento harmonioso na composição
- Hierarquia visual adequada

NÃO penalize por artefatos de texto (não existem com composição programática).
Foque o score em: a imagem de fundo deixou espaço adequado? O conjunto é visualmente profissional?
```

---

## 11. Refiner — Ajuste de Refinamento

### Quando Compositor está ativo e Reviewer reprova:

O Refiner pode identificar problemas como:
- "Fundo muito ocupado atrás do headline — texto pouco legível"
- "Zona reservada insuficiente — texto compete com elementos visuais"

**Estratégias de refinamento:**
1. Ajustar prompt para zonas mais claras/limpas (principal)
2. Re-prompt com composição mais simples

O Refiner NÃO ajusta o `composition_layout` nem parâmetros do Compositor diretamente — isso é output do CD. O Refiner atua exclusivamente no prompt de imagem para melhor acomodar o layout definido. Se o problema é legibilidade por fundo ocupado, o Refiner instrui o modelo a gerar zonas mais limpas/escuras na próxima iteração.

---

## 12. Frontend — Mudanças Mínimas

### Pipeline visual:

Nova etapa "Compositor" aparece automaticamente nos logs do pipeline (já suportado pelo sistema de logging existente).

### Sem mudanças no formulário:

O `programmaticComposition` é transparente para o usuário. Ele preenche campos de texto normalmente. A diferença é que o texto sai perfeito.

### Imagem composta:

A imagem composta substitui a original no mesmo campo `image_url`. O frontend não precisa de lógica condicional — exibe a mesma URL de sempre, que agora aponta para a versão com texto/logo.

---

## 13. Arquivos a Criar/Modificar

### Criar:
- `backend/app/agents/compositor.py` — CompositorAgent
- `backend/assets/fonts/` — 7 arquivos TTF (Sora: Bold, SemiBold, Regular, Light + DM Sans: Bold, Medium, Regular)

### Modificar:
- `backend/app/agents/context.py` — novos dataclasses (CompositionLayout, TextZone, LogoPlacement) + campo `composition_layout` em CreativeDirection + `CreativeDirection.from_dict()` class method
- `backend/app/agents/creative_director.py` — prompt condicional + parsing do novo campo
- `backend/app/agents/prompt_engineer.py` — instruções de zona reservada
- `backend/app/agents/orchestrator.py` — chamada do Compositor entre Generator e Reviewer
- `backend/app/agents/reviewer.py` — prompt ajustado quando composição ativa
- `backend/app/agents/refiner.py` — awareness de composição programática
- `backend/app/config/art_type_config.py` — `programmaticComposition` por art type
- `frontend/src/config/artTypeConfig.ts` — mirror do campo
- `frontend/src/types/index.ts` — tipo CompositionLayout (para tipagem do contexto no pipeline viewer)

### Não modificar:
- `generator.py` — não muda (gera imagem normalmente)
- `model_router.py` — não muda (seleção de modelo inalterada)
- `storage_service.py` — não muda (Compositor usa mesmas funções de save)
- Formulário frontend — não muda (campos de texto já existem)

---

## 14. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Texto sobreposto ilegível (baixo contraste) | color_hint do CD + detecção auto de luminosidade (ITU-R BT.601) + contraste WCAG AA 4.5:1 + sombra sutil |
| Modelo ignora instrução de zona reservada | Sharpening do prompt pelo PE + Reviewer detecta e Refiner corrige |
| Logo com fundo branco (sem transparência) | Documentar que logos devem ser PNG com transparência. Best-effort: se logo tem fundo sólido uniforme (>95% dos pixels de borda = mesma cor ±10), remover via threshold. Não tentar remoção complexa. |
| Font file não encontrado | Fallback chain: brand font → Sora/DM Sans → DejaVuSans (bundled com Pillow) |
| Word wrap ruim em textos longos | Auto-sizing com shrink + break em espaços + limite de linhas |
| Performance (Pillow lento em imagens grandes) | Imagens são 1-2K max, Pillow processa em <500ms |
| Compositor falha | Try/except total, pipeline continua com imagem original |

---

## 15. Fora de Escopo (v2.1+)

- Output WebP otimizado (dual-format PNG + WebP)
- Upload de fontes customizadas por marca
- Color correction baseada em paleta da marca
- Upscale de imagem (super-resolution)
- Efeitos de texto avançados (gradiente, outline, glow)
- Background removal avançado para logo (além do best-effort simples)
- Preview de composição no frontend (antes de gerar)
- Edição manual de posições de texto pós-geração
