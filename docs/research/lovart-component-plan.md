# Lovart Home Page — Component Plan

## Brand Identity
- **Fictional Brand Name:** Nova Studio
- **Tagline:** AI-powered design, reimagined
- **Color Theme:** Dark mode with violet/purple accent

## Component Tree

```
src/app/page.tsx
└── src/components/lovart-clone/
    ├── Header.tsx            — Sticky nav bar
    ├── HeroSection.tsx       — Hero with headline + CTA
    ├── PromptBox.tsx         — AI prompt input area
    ├── ShowcaseGrid.tsx      — Design showcase cards
    ├── SystemThinking.tsx    — Workflow/process section
    ├── FeatureSection.tsx    — Feature highlights
    ├── CTASection.tsx        — Call-to-action banner
    └── Footer.tsx            — Site footer
```

## Component Details

### 1. Header (`Header.tsx`)
- **Type:** Client component (`"use client"`)
- **Props:** None
- **State:** `scrolled` (boolean) — tracks scroll position for background opacity
- **Structure:**
  - Fixed/sticky top bar
  - Left: Logo (SVG placeholder — "Nova Studio" text)
  - Center: Nav links (Features, Showcase, Pricing, About)
  - Right: CTA button ("Get Started")
- **Responsive:** Mobile hamburger menu (simplified)
- **Interactions:** Background becomes opaque on scroll

### 2. HeroSection (`HeroSection.tsx`)
- **Type:** Server component
- **Props:** None
- **Structure:**
  - Full-viewport-height section
  - Gradient background (dark → violet accent)
  - Large headline with gradient text
  - Subtitle paragraph
  - Two CTA buttons (primary "Start Creating" / secondary "See Showcase")
  - Decorative gradient blobs / abstract shapes (CSS-only)
- **Responsive:** Stack buttons on mobile, smaller text

### 3. PromptBox (`PromptBox.tsx`)
- **Type:** Client component
- **Props:** None
- **Structure:**
  - Centered container with max-width
  - Large text input/textarea with placeholder
  - Example prompt chips below (clickable, fill input)
  - "Generate" button
  - Decorative glow behind the input
- **Interactions:** Focus ring animation, chip click fills input
- **Note:** No actual API call — just UI demo

### 4. ShowcaseGrid (`ShowcaseGrid.tsx`)
- **Type:** Server component
- **Props:** None
- **Structure:**
  - Section heading "Design Showcase"
  - 2×2 or 3-column grid of cards
  - Each card:
    - Gradient/placeholder image (CSS gradient mock)
    - Category tag
    - Title
    - Description
  - Hover: subtle lift + shadow
- **Responsive:** 2-col tablet, 1-col mobile

### 5. SystemThinking (`SystemThinking.tsx`)
- **Type:** Server component
- **Props:** None
- **Structure:**
  - Section heading "How It Works"
  - 3-4 step cards in a row or timeline
  - Each step: Icon (Lucide), Step number, Title, Description
  - Connecting line/arrow between steps (CSS)
- **Responsive:** Stack vertically on mobile

### 6. FeatureSection (`FeatureSection.tsx`)
- **Type:** Server component
- **Props:** None
- **Structure:**
  - Alternating layout sections (2-3 features)
  - Each feature: Icon + Heading + Description
  - Left/right layout with placeholder visual
  - "AI-Powered Design", "Smart Templates", "Real-time Collaboration"
- **Responsive:** Stack on mobile

### 7. CTASection (`CTASection.tsx`)
- **Type:** Server component
- **Props:** None
- **Structure:**
  - Full-width section with gradient background
  - Large heading "Ready to Create?"
  - Subtitle
  - Primary CTA button
  - Background decorative elements

### 8. Footer (`Footer.tsx`)
- **Type:** Server component
- **Props:** None
- **Structure:**
  - Multi-column layout
  - Brand column (logo + description)
  - Link columns (Product, Resources, Company)
  - Social icons row
  - Copyright bar
- **Responsive:** Stack columns on mobile

## Data Flow
- All components are **presentational** — no API calls
- Showcase data defined as static arrays in component files
- No state management needed beyond scroll tracking in Header

## File Structure
```
src/components/lovart-clone/
  Header.tsx
  HeroSection.tsx
  PromptBox.tsx
  ShowcaseGrid.tsx
  SystemThinking.tsx
  FeatureSection.tsx
  CTASection.tsx
  Footer.tsx
```

## Implementation Order
1. `Header.tsx` — Foundation for all pages
2. `HeroSection.tsx` — First impression
3. `PromptBox.tsx` — Core interaction point
4. `ShowcaseGrid.tsx` — Visual proof
5. `SystemThinking.tsx` — Process explanation
6. `FeatureSection.tsx` — Value props
7. `CTASection.tsx` — Conversion
8. `Footer.tsx` — Closing
9. Wire up in `page.tsx`
