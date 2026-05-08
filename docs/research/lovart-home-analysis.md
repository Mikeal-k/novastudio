# Lovart.ai Home Page Analysis

> **Note:** Direct browser inspection was not possible (network unreachable from dev environment). This analysis is based on general knowledge of Lovart.ai's public design as an AI-powered design platform.

## Page Structure (Top to Bottom)

```
┌─────────────────────────────────────┐
│  Header (sticky nav)                 │
│  Logo | Nav Links | CTA Button       │
├─────────────────────────────────────┤
│  Hero Section                        │
│  Headline + Subtitle + CTA Buttons   │
│  Background gradient/effect          │
├─────────────────────────────────────┤
│  Prompt/Input Area                   │
│  "Describe your design" input box    │
│  Example prompts / quick actions     │
├─────────────────────────────────────┤
│  Showcase / Preview Cards            │
│  Grid of AI-generated design cards   │
│  Hover effects, category tags        │
├─────────────────────────────────────┤
│  System Thinking / Workflow Section  │
│  Step-by-step AI design process      │
│  Visual flow diagram / cards         │
├─────────────────────────────────────┤
│  Feature Sections (2-3)              │
│  Icon + text + description           │
│  Alternating layout (image|text)     │
├─────────────────────────────────────┤
│  CTA Section                         │
│  "Get started" heading + button      │
│  Background highlight                │
├─────────────────────────────────────┤
│  Footer                              │
│  Links | Social | Copyright          │
└─────────────────────────────────────┘
```

## Visual Design Tokens (Estimated)

### Colors
| Token | Value (Estimated) | Usage |
|-------|-------------------|-------|
| Background | `#0a0a0f` (dark) | Page background |
| Surface | `#12121a` | Card/section backgrounds |
| Surface Elevated | `#1a1a2e` | Elevated cards |
| Primary | `#6c5ce7` / `#7c3aed` | CTA buttons, accents |
| Primary Hover | `#8b5cf6` | Button hover |
| Text Primary | `#ffffff` | Headings |
| Text Secondary | `#a0a0b8` | Body text |
| Text Muted | `#6b6b80` | Captions, labels |
| Border | `#2a2a3e` | Card borders |
| Success | `#10b981` | Positive indicators |
| Gradient 1 | `#6c5ce7` → `#a855f7` | Hero gradient |

### Typography
| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| H1 (Hero) | 56-64px | 700 (bold) | 1.1 |
| H2 (Section) | 36-42px | 700 | 1.2 |
| H3 (Card title) | 20-24px | 600 | 1.3 |
| Body | 16-18px | 400 | 1.6 |
| Small/Caption | 13-14px | 400 | 1.5 |
| Button | 15-16px | 500-600 | 1 |

### Spacing Scale
| Token | Value |
|-------|-------|
| Space 1 | 4px |
| Space 2 | 8px |
| Space 3 | 12px |
| Space 4 | 16px |
| Space 5 | 24px |
| Space 6 | 32px |
| Space 7 | 48px |
| Space 8 | 64px |
| Space 9 | 96px |
| Space 10 | 128px |

### Border Radius
| Element | Radius |
|---------|--------|
| Buttons | 8-12px |
| Cards | 12-16px |
| Input | 10-12px |
| Large containers | 20-24px |
| Avatars | 50% |

### Shadows
| Level | Value |
|-------|-------|
| Card | `0 4px 20px rgba(0,0,0,0.3)` |
| Elevated | `0 8px 32px rgba(0,0,0,0.4)` |
| Glow (accent) | `0 0 20px rgba(108,92,231,0.3)` |

## Responsive Breakpoints (Estimated)
- **Desktop:** 1280px+ (max-width container: 1200px)
- **Tablet:** 768px - 1279px (2-column grids collapse)
- **Mobile:** < 768px (single column, stacked layout)
- **Small Mobile:** < 480px (compact padding)

## Interaction Patterns
1. **Header:** Sticky on scroll, background opacity transition
2. **Cards:** Hover scale + shadow lift, subtle translateY
3. **Hero:** Gradient animation / subtle particle effect
4. **Sections:** Fade-in on scroll (Intersection Observer)
5. **Buttons:** Hover scale 1.02-1.05, active press
6. **Input:** Focus glow ring in accent color

## Key Design Characteristics
- Dark theme with purple/violet accent
- Glassmorphism effects on cards (backdrop blur)
- Gradient text on hero headings
- Smooth scroll behavior
- Minimal, clean layout with generous whitespace
- Grid-based card layouts
- Rounded corners throughout
- Monospace font for code/prompt elements
