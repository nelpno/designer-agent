# Artisan v1.4 — Formulário Dinâmico, Multi-formato, Carrossel & Inclusões

**Data:** 2026-03-15
**Status:** Aprovado

## Resumo

Três mudanças estruturais no Artisan:

1. **Formulário dinâmico por art type** — campos de texto mudam conforme tipo selecionado (config-driven)
2. **Multi-formato** — gerar a mesma arte em múltiplos aspect ratios (1:1 + 9:16 + 16:9)
3. **Carrossel** — novo art type com editor de slides e coerência visual
4. **Inclusões** — upload de assets que devem aparecer NA arte (diferente de referências visuais)

## Art Type Config (contrato compartilhado)

Arquivo único que define campos, formatos e comportamentos por art type.
Frontend importa diretamente. Backend expõe via `GET /api/config/art-types`.

```typescript
type FieldConfig = {
  field: string          // 'headline' | 'body_text' | 'cta_text' | 'logo_text' | 'slides'
  label: string          // Label em PT-BR
  placeholder: string
  type: 'text' | 'textarea' | 'slides'
  required?: boolean
  maxLength?: number
}

type ArtTypeConfig = {
  key: string
  label: string
  icon: string           // icon name (frontend resolve SVG)
  textFields: FieldConfig[]
  inclusion: 'none' | 'optional' | 'required'
  inclusionLabel?: string  // Label customizado ("Foto do produto", "Arte para aplicar")
  allowedFormats: string[] // ['1:1', '9:16', '16:9']
  defaultFormats: string[]
  maxQuantity: number
  suggestTexts: boolean    // se suporta sugestão de textos
}
```

### Mapeamento

| Tipo | textFields | inclusion | allowedFormats | suggestTexts |
|---|---|---|---|---|
| ad_creative | headline, body_text, cta_text | optional | 1:1, 9:16, 16:9, 4:5 | sim |
| social_post | headline, body_text | optional | 1:1, 9:16, 4:5 | sim |
| carousel | slides (headline+body_text ×N) | optional | 1:1 | sim (por slide) |
| logo | logo_text (text) | none | 1:1 | nao |
| product_shot | — | **required** | 1:1, 4:5 | nao |
| lifestyle_photo | — | optional | 1:1, 16:9 | nao |
| mockup | — | **required** | 1:1, 16:9 | nao |
| illustration | — | none | 1:1, 16:9 | nao |
| presentation_slide | headline, body_text | none | 16:9 | sim |
| brand_material | headline, body_text | none | 1:1, 16:9 | sim |

## Modelo de Dados

### Brief (alterações)
```sql
ALTER TABLE briefs ADD COLUMN slides JSONB;           -- [{headline, body_text}, ...]
ALTER TABLE briefs ADD COLUMN inclusion_urls TEXT[];    -- URLs de assets para incluir na arte
```

### Generation (alterações)
```sql
ALTER TABLE generations ADD COLUMN batch_id UUID;      -- agrupa gerações do mesmo pedido
ALTER TABLE generations ADD COLUMN format_label VARCHAR(20); -- '1:1', '9:16', etc.
CREATE INDEX idx_generations_batch_id ON generations(batch_id);
```

## Fluxo de Geração (Multi-formato)

1. Frontend cria Brief (com slides/inclusions se aplicável)
2. Frontend chama `POST /api/generations/from-brief/{id}` com body: `{ formats: ["1:1", "9:16"], quantity: 1 }`
3. Backend cria N registros Generation (um por formato × quantidade), todos com mesmo `batch_id`
4. Creative Director roda **1 vez** (resultado cacheado no primeiro contexto)
5. Cada Generation recebe sua própria Celery task com o creative_direction compartilhado
6. Frontend rastreia batch_id para progresso agregado

## Carrossel

- Art type: `carousel`
- Min 2 slides, max 10
- Cada slide tem `headline` + `body_text` (opcionais)
- Pipeline: Prompt Engineer gera prompts com instrução de coerência (mesma paleta, estilo)
- Cada slide é uma geração independente, mas com batch_id compartilhado
- Reviewer avalia coerência do conjunto
- Gallery mostra carrossel swipeable

## Inclusão vs Referência

- **Referência** (já existe): `reference_urls` — "inspire-se neste estilo"
- **Inclusão** (novo): `inclusion_urls` — "esta pessoa/produto DEVE aparecer na imagem"
- Mesmo upload endpoint com mesma validação (magic bytes, 10MB)
- Generator envia inclusões com contexto explícito ao modelo
- Prompt Engineer inclui instrução: "The following person/product MUST appear prominently"

## Suggest-texts (atualização)

- Para tipos normais: retorna `{headline, body_text, cta_text}` como hoje
- Para carousel: aceita `slide_count`, retorna `{slides: [{headline, body_text}, ...]}`
- Campos retornados seguem o config do art type (não retorna CTA para social_post)

## Endpoints Novos

- `GET /api/config/art-types` — retorna config completo (para API futura do planejador)
- `POST /api/briefs/upload-inclusion` — upload de asset para inclusão
- `POST /api/generations/from-brief/{id}` — atualizado para aceitar `formats[]` e `quantity`
- `GET /api/generations/batch/{batch_id}` — lista gerações de um batch

## Frontend — Componentização

- `artTypeConfig.ts` — config data importado pelo frontend
- `TextFieldsSection.tsx` — renderiza campos dinâmicos baseado no config
- `CarouselEditor.tsx` — editor de slides (add/remove/reorder)
- `InclusionUpload.tsx` — upload de inclusões (separado de referências)
- `FormatSelector.tsx` — checkboxes de formato + quantidade
- `BatchProgress.tsx` — progresso de batch (N/M completas)

## Limites de Segurança

- Carrossel: max 10 slides
- Multi-formato: max 4 formatos por request
- Quantidade: max 4 por formato
- Total máximo: 40 gerações por batch (10 slides × 4 formatos)
- Inclusão: mesma validação de referência (magic bytes, 10MB, extensão forçada)

## Backward Compatibility

- Todos os novos campos são nullable
- Sem `formats`/`quantity`: funciona como hoje (1 geração, formato do brief)
- Briefs antigos continuam funcionando
- API existente inalterada
