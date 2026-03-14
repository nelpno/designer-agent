# Artisan — Redesign Spec

## Identidade

- **Nome**: Artisan
- **Tagline**: Arte + artesão digital
- **Logo**: Ícone ❖ com gradiente verde→ciano (#30D158 → #5AC8FA), border-radius 14px
- **Fontes**: Sora (headings), DM Sans (body)

## Design System

### Cores — Dark Mode (padrão)
| Token | Valor | Uso |
|---|---|---|
| `--bg-primary` | `#1C1C1E` | Background principal |
| `--bg-secondary` | `#2C2C2E` | Cards, surfaces |
| `--bg-tertiary` | `#3A3A3C` | Inputs, hover states |
| `--border` | `#3A3A3C` | Bordas padrão |
| `--border-hover` | `#48484A` | Bordas ao hover |
| `--text-primary` | `#F5F5F7` | Texto principal |
| `--text-secondary` | `#86868B` | Texto muted |
| `--text-tertiary` | `#48484A` | Texto desabilitado |

### Cores — Light Mode
| Token | Valor | Uso |
|---|---|---|
| `--bg-primary` | `#F5F5F7` | Background principal |
| `--bg-secondary` | `#FFFFFF` | Cards, surfaces |
| `--bg-tertiary` | `#E5E5EA` | Inputs, hover states |
| `--border` | `#E5E5EA` | Bordas padrão |
| `--border-hover` | `#D1D1D6` | Bordas ao hover |
| `--text-primary` | `#1C1C1E` | Texto principal |
| `--text-secondary` | `#86868B` | Texto muted |
| `--text-tertiary` | `#AEAEB2` | Texto desabilitado |

### Accent Colors (iguais nos dois modos)
| Token | Valor | Uso |
|---|---|---|
| `--accent-primary` | `#30D158` | Primary accent, CTAs |
| `--accent-secondary` | `#5AC8FA` | Secondary accent, links |
| `--accent-gradient` | `linear-gradient(135deg, #30D158, #5AC8FA)` | Logo, botões primários |
| `--color-success` | `#30D158` | Concluído |
| `--color-warning` | `#FFD60A` | Pendente, scores médios |
| `--color-error` | `#FF453A` | Falhou |
| `--color-info` | `#5AC8FA` | Processando |
| `--color-violet` | `#5E5CE6` | Accent alternativo |

### Espaçamento
- Cards: `p-5` (20px)
- Gaps entre cards: `gap-4` (16px)
- Sections: `mb-8` (32px)
- Border-radius cards: `rounded-xl` (12px)
- Border-radius buttons: `rounded-lg` (8px)
- Border-radius logo icon: `rounded-[14px]`

### Tipografia
- H1 (page title): Sora 24px/700, letter-spacing -0.5px
- H2 (section): Sora 16px/600
- Body: DM Sans 14px/400
- Small/caption: DM Sans 12px/400
- Label: DM Sans 11px/600, uppercase, letter-spacing 0.5px

## Tema — Implementação

### CSS Variables
```css
:root {
  /* Dark mode padrão */
  --bg-primary: #1C1C1E;
  --bg-secondary: #2C2C2E;
  --bg-tertiary: #3A3A3C;
  --border: #3A3A3C;
  --border-hover: #48484A;
  --text-primary: #F5F5F7;
  --text-secondary: #86868B;
  --text-tertiary: #48484A;
}

[data-theme="light"] {
  --bg-primary: #F5F5F7;
  --bg-secondary: #FFFFFF;
  --bg-tertiary: #E5E5EA;
  --border: #E5E5EA;
  --border-hover: #D1D1D6;
  --text-primary: #1C1C1E;
  --text-secondary: #86868B;
  --text-tertiary: #AEAEB2;
}
```

### JS Logic
```
1. No mount: ler localStorage("theme")
2. Se null → ler prefers-color-scheme do OS
3. Aplicar data-theme no <html>
4. Toggle: alternar e salvar no localStorage
```

### ThemeProvider (React Context)
- `theme: "dark" | "light" | "system"`
- `resolvedTheme: "dark" | "light"` (o que está ativo)
- `toggleTheme()` — cicla dark → light → system

## UX — Fluxo Tudo-em-Um Progressivo

### Página principal: "Nova Arte" (substitui NewBrief)

Layout: coluna principal (max-w-2xl) + sidebar preview (w-64)

**Seções progressivas:**

1. **Marca** (sempre aberta)
   - Grid de cards das marcas cadastradas
   - Card "+" para criar nova marca rápida
   - Ao selecionar, colapsa mostrando nome + logo inline

2. **Tipo & Formato** (abre após selecionar marca)
   - Grid 3x3 de tipos de arte com ícone + label
   - Row de formatos (1:1, 9:16, 16:9, 4:5, Custom)
   - Ao selecionar ambos, colapsa

3. **Textos** (abre após tipo)
   - Headline, body_text, cta_text
   - Botão "Sugerir com IA" que preenche baseado na descrição
   - Pode pular (campos opcionais dependendo do tipo)

4. **Descrição & Referências** (abre após textos)
   - Textarea para descrição detalhada
   - Upload drag-and-drop de referências
   - Botão "Sugerir com IA" para enriquecer descrição

5. **Resumo & Gerar** (seção final)
   - Resumo visual de todas as escolhas
   - Botão grande "Gerar Arte" com gradiente accent

**Sidebar Preview (fixa à direita):**
- Mostra resumo das escolhas em tempo real
- Thumbnail da marca selecionada
- Badges de tipo/formato
- Modelo que será usado (auto-detectado)
- Botão "Gerar" (habilitado quando tiver mínimo: marca + tipo)

### Dashboard

- Saudação contextual ("Bom dia!", "Boa tarde!")
- Hero CTA: "Crie sua primeira arte →" (se poucas gerações) ou "Nova Arte" (se já tem)
- Stats em row (3-4 cards compactos)
- Recentes em list-style (thumbnail + info inline, não grid de cards grandes)
- Link "Ver todas →" para galeria

### Sidebar/Navegação

- Logo Artisan (❖ + "Artisan") no topo
- 4 itens: Painel, Nova Arte, Galeria, Marcas
- Ícones simples (não emoji, usar SVG/Lucide)
- Active state: background sutil + accent color no texto
- Theme toggle (sol/lua) no rodapé da sidebar
- Versão no rodapé: "v1.1"

### Galeria

- Filter bar com pills (status, modelo, score mínimo)
- Grid responsiva 1-4 colunas
- Cards com thumbnail + overlay mínimo (score + status dot)
- Hover: scale sutil + info aparece

### Generation Detail

- Imagem principal grande
- Sidebar com detalhes (status, modelo, score, iterações, duração)
- Botões: Download, Gerar Variação, Re-gerar (se failed)
- Pipeline trace com timeline vertical

### Brand Management

- Grid de brand cards
- Modal para criar/editar
- Brand discovery mantém funcionalidade atual

## Componentes Reutilizáveis

| Componente | Descrição |
|---|---|
| `ThemeProvider` | Context + toggle + persistence |
| `Card` | Surface com bg-secondary, border, rounded-xl, hover |
| `Badge` | Status, score, modelo (usando accent colors) |
| `Button` | Variants: primary (gradient), secondary (outline), ghost, danger |
| `Input` | bg-tertiary, border, rounded-lg, focus ring accent |
| `ProgressSection` | Seção colapsável do fluxo progressivo |
| `SidePreview` | Sidebar de preview em tempo real |
| `ThemeToggle` | Botão sol/lua animado |

## Animações

- Seções abrindo: slide-down 300ms ease-out
- Cards hover: translateY(-2px) 200ms
- Page transitions: fade-in 200ms
- Theme toggle: rotate 180deg no ícone
- Stagger em grids: 50ms delay por item

## Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `index.css` | Reescrever com novo design system |
| `tailwind.config.js` | Extend com tokens do Artisan |
| `App.tsx` | Wrap com ThemeProvider |
| `components/Layout.tsx` | Nova sidebar + theme toggle |
| `pages/Dashboard.tsx` | Redesign completo |
| `pages/NewBrief.tsx` | Fluxo progressivo |
| `pages/Gallery.tsx` | Novo grid + filters |
| `pages/GenerationDetail.tsx` | Layout refinado |
| `pages/BrandManagement.tsx` | Visual atualizado |
| `components/StatusBadge.tsx` | Novas cores |
| `components/ScoreBadge.tsx` | Novas cores |
| `components/ModelBadge.tsx` | Novas cores |

## Fora de Escopo

- Mudanças no backend
- Novas funcionalidades (apenas redesign visual + UX)
- i18n / multi-idioma
- Testes automatizados de UI
