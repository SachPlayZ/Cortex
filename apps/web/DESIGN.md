---
name: Cortex
description: A verified settlement desk for AI-underwritten invoice financing.
colors:
  primary: "#D9FF6F"
  signal: "#3EE89E"
  background: "#080B0F"
  surface: "#10151A"
  surface-high: "#161E24"
  foreground: "#F8F4E8"
  muted-foreground: "#A5A196"
  border: "#F8F4E821"
  success: "#8EE66B"
  warning: "#F6C95F"
  destructive: "#FF817B"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(3rem, 7vw, 6rem)"
    fontWeight: 600
    lineHeight: 0.94
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.35
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 18px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 18px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 14px"
---

# Design System: Cortex

## Overview

**Creative North Star: "The Verified Ledger"**

Cortex should feel like a settlement desk condensed into a precise web product: dark, quiet, and highly legible until a verified event earns a bright signal. The atmosphere comes from real financial artifacts—amounts, checks, timelines, hashes, wallet identities, and state changes—not stock imagery or decorative effects.

The system is restrained on working screens and more expressive on the public landing page, but both use the same tokens and interaction grammar. Dense evidence sits beside deliberate breathing room. Motion communicates state changes and handoffs; it never delays access to the task.

**Key Characteristics:**

- Near-black accounting surfaces with warm high-contrast text.
- Acid-lime primary actions reserved for decisive transitions.
- Compact Shadcn primitives composed into clear operational flows.
- Tonal depth, strong rules, and alignment instead of ambient shadows.
- Product evidence as the main visual material.

## Colors

The palette behaves like an instrument panel: neutral until a financial action or verified state needs attention.

### Primary

- **Settlement Lime:** The primary action and current-state signal. It must remain scarce enough to preserve urgency.

### Secondary

- **Proof Mint:** Verification progress, connected systems, and successful technical handoffs where the stronger primary would overstate importance.

### Neutral

- **Ledger Black:** The page canvas and deepest shell.
- **Accounting Slate:** Default Shadcn card, input, and table surfaces.
- **Raised Slate:** Menus, selected rows, and higher tonal layers.
- **Warm Ink:** Primary readable text.
- **Ledger Gray:** Secondary copy and metadata; never reduce it below AA contrast.
- **Hairline Ink:** Low-emphasis boundaries and separators.

### Named Rules

**The Earned Signal Rule.** Lime and mint appear only for actions, current selection, verification, and settled state—not decoration.

**The State Is More Than Color Rule.** Every success, warning, and failure includes an icon or label in addition to hue.

## Typography

**Display Font:** Geist (system sans fallback)  
**Body Font:** Geist (system sans fallback)  
**Label/Mono Font:** Geist for interface labels; system monospace only for hashes and transaction identifiers.

**Character:** A single technical sans keeps the product familiar and calm. Hierarchy comes from weight, measure, and tabular numerals rather than extra font families.

### Hierarchy

- **Display** (600, fluid up to 6rem, 0.94): Landing-page claim only; never used for app labels or data.
- **Headline** (600, 2rem, 1.1): Page and major workflow titles.
- **Title** (500–600, 1rem–1.5rem, 1.2): Shadcn card, panel, and section titles.
- **Body** (400, 1rem, 1.65): Explanations capped near 70 characters.
- **Label** (500, 0.8125rem, 1.35): Field labels, table metadata, and concise state descriptions.

### Named Rules

**The Data Stays Quiet Rule.** Financial values use tabular numerals and weight, never novelty typography.

**The Six-Rem Ceiling Rule.** Display text never exceeds 6rem and tracking never tightens beyond -0.04em.

## Elevation

Cortex is flat by default. Depth comes from tonal layering, dividers, sticky positioning, and stateful background changes. Shadows are structural only: the fixed navigation may use a tight low-blur shadow to separate it from scrolling content; cards do not pair borders with wide ambient shadows.

### Named Rules

**The Tonal Depth Rule.** Move from Ledger Black to Accounting Slate to Raised Slate before introducing a shadow.

**The No Ghost Cards Rule.** Never pair a one-pixel border with a wide decorative drop shadow.

## Components

All reusable controls come from the local Shadcn/Base UI library. Page code composes primitives; it does not recreate buttons, badges, alerts, empty states, tabs, fields, or skeletons with custom markup.

### Buttons

- **Shape:** Controlled curve (10px) with at least 44px height for primary workflow actions.
- **Primary:** Settlement Lime on Ledger Black; reserved for the single decisive action in a region.
- **Hover / Focus:** Tonal shift on hover, one-pixel active press, and a visible semantic ring on keyboard focus.
- **Secondary / Ghost:** Outline for peer actions, ghost for low-risk navigation, destructive only for irreversible operations.

### Chips

- **Style:** Use Shadcn Badge with semantic variants and concise sentence-case labels.
- **State:** Selected states use the primary token sparingly; statuses pair text with meaning, never color alone.

### Cards / Containers

- **Corner Style:** Controlled curve (14px maximum).
- **Background:** Accounting Slate or Raised Slate according to depth.
- **Shadow Strategy:** None at rest.
- **Border:** Hairline only when the boundary improves scanning.
- **Internal Padding:** 16px compact, 24px standard, 32px only for a dominant surface.

### Inputs / Fields

- **Style:** Shadcn Field composition with 44px controls, Accounting Slate fill, and 10px corners.
- **Focus:** Semantic ring plus border shift; no glow.
- **Error / Disabled:** Both visual and semantic states; errors explain recovery.

### Navigation

Use one responsive Shadcn navigation vocabulary. Desktop prioritizes role-aware routes and wallet identity; mobile keeps the same information in a compact disclosure. Active location is explicit and keyboard focus remains visible.

### Lifecycle Timeline

The signature component is an evidence-first sequence of Shadcn badges, separators, alerts, progress, and links. Each transition shows status, timestamp, and transaction proof when available.

## Do's and Don'ts

### Do:

- **Do** lead each page with one clear task and the state required to perform it.
- **Do** use Shadcn components and their built-in variants before custom markup or styling.
- **Do** use real amounts, hashes, checks, events, and transaction links as visual material.
- **Do** keep body copy readable, financial numerals tabular, touch targets at least 44px, and focus rings visible.
- **Do** make motion explain state and provide a reduced-motion alternative.

### Don't:

- **Don't** use generic AI landing-page scaffolds, crypto-casino aesthetics, or fake AI theatre.
- **Don't** use placeholder stock imagery, decorative glow and grain, glassmorphism, or repetitive card grids.
- **Don't** use gradient text, colored side-stripe borders, decorative CSS grids, or repeating stripe backgrounds.
- **Don't** pair one-pixel borders with wide soft shadows or round cards beyond 14px.
- **Don't** turn every section into an eyebrow-plus-heading template or animate every section with the same entrance.
- **Don't** obscure financial state, imply repayment from a redirect, or hide transaction proof.
