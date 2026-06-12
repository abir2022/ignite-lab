---
name: Synthetic Lab
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3c494c'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6c797d'
  outline-variant: '#bbc9cd'
  surface-tint: '#006877'
  primary: '#006877'
  on-primary: '#ffffff'
  primary-container: '#22d3ee'
  on-primary-container: '#005763'
  inverse-primary: '#2fd9f4'
  secondary: '#9d4300'
  on-secondary: '#ffffff'
  secondary-container: '#fd761a'
  on-secondary-container: '#5c2400'
  tertiary: '#835400'
  on-tertiary: '#ffffff'
  tertiary-container: '#ffb13b'
  on-tertiary-container: '#6e4600'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a2eeff'
  primary-fixed-dim: '#2fd9f4'
  on-primary-fixed: '#001f25'
  on-primary-fixed-variant: '#004e5a'
  secondary-fixed: '#ffdbca'
  secondary-fixed-dim: '#ffb690'
  on-secondary-fixed: '#341100'
  on-secondary-fixed-variant: '#783200'
  tertiary-fixed: '#ffddb5'
  tertiary-fixed-dim: '#ffb957'
  on-tertiary-fixed: '#2a1800'
  on-tertiary-fixed-variant: '#643f00'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
  surface-base: '#FFFFFF'
  surface-muted: '#F1F5F9'
  glass-border: rgba(255, 255, 255, 0.4)
  glass-fill: rgba(255, 255, 255, 0.7)
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 16px
---

## Brand & Style

The design system is engineered for a high-tech e-learning environment that bridges the gap between theoretical knowledge and practical virtual simulation. The brand personality is **innovative, energetic, and precise**, aimed at students and researchers who require a focused yet stimulating digital workspace. 

The visual style is **Glassmorphism mixed with Modern Corporate** aesthetics. It utilizes frosted glass surfaces to provide a sense of depth and modernity, while maintaining a rigorous underlying grid that ensures the interface feels like a professional educational tool rather than a consumer app. The atmosphere is light and airy, punctuated by high-energy "ignition" colors that draw attention to progress, interactive simulations, and calls to action.

## Colors

The palette leverages a high-contrast relationship between **Vibrant Cyan** and **Energetic Orange**. 

- **Primary (Cyan):** Used for primary actions, progress indicators, and active states. It represents the "tech" side of the virtual lab.
- **Secondary (Orange):** Reserved for "Ignition" moments—starting a lab, critical alerts, or highlighting essential learning outcomes.
- **Neutral (Slate):** A deep, professional slate used for typography and iconography to maintain readability against light backgrounds.
- **Backgrounds:** The primary workspace uses a clean, near-white base with soft gray segments to delineate different functional zones without heavy borders.

## Typography

This design system utilizes a trio of sans-serif typefaces to balance character and utility. **Hanken Grotesk** is used for headlines to provide a sharp, contemporary "tech" feel. **Inter** handles the bulk of the educational content, chosen for its exceptional legibility in long-form reading and data-heavy environments. **Geist** is reserved for labels, code snippets, and technical data points within the virtual lab interface, reinforcing the developer-centric, precise nature of the platform.

Typography scales are generous to ensure accessibility. Display styles use tight tracking and heavy weights, while body text maintains open leading to reduce cognitive load during complex lessons.

## Layout & Spacing

The layout utilizes a **12-column fluid grid** for desktop and a **4-column grid** for mobile. The system follows an 8px base unit for all spacing increments.

- **Virtual Lab Layout:** Uses a "Cockpit" model where the central workspace is flanked by collapsible sidebars for tools and documentation.
- **Content Flow:** Standard e-learning modules use a centered, fixed-width container (max 1280px) to prevent line lengths from becoming unreadable on ultra-wide monitors.
- **Gaps:** Gutters are set at 24px to provide significant "breathing room," reinforcing the minimal and clean aesthetic.

## Elevation & Depth

Depth is achieved through **Glassmorphism and Ambient Shadows**. 

1.  **Level 0 (Base):** The primary background color.
2.  **Level 1 (Subtle):** Elements like sidebar navigations or input fields use a slight tonal shift (light gray) with no shadow.
3.  **Level 2 (Glass Cards):** The primary container for lab modules. These feature a semi-transparent white background (`rgba(255, 255, 255, 0.7)`), a 1px white border with 40% opacity, and a background blur (12px to 20px). 
4.  **Level 3 (Interactive):** Hover states or active modals utilize a multi-layered ambient shadow. These shadows are tinted with a hint of the primary cyan (`rgba(34, 211, 238, 0.15)`) to create a "glowing" effect that feels high-tech.

## Shapes

The shape language is **Rounded**, striking a balance between the organic feel of modern software and the structural rigidity of a laboratory. 

- **Standard Elements:** Buttons, inputs, and cards use a 0.5rem (8px) corner radius.
- **Large Containers:** Progress modules and glass panels use `rounded-xl` (1.5rem) to soften the large surface areas.
- **Status Indicators:** Micro-elements like tags and notification pips are fully rounded (pill-shaped) to distinguish them from structural UI components.

## Components

- **Buttons:** Primary buttons use a solid Cyan fill with white text. "Ignition" buttons (e.g., "Start Lab") use the Orange gradient. Secondary buttons use the Glassmorphism style with a Cyan border.
- **Lab Cards:** These are the centerpiece. They must feature `backdrop-filter: blur(12px)` and a subtle internal stroke to catch the light. They house lab titles, progress bars, and estimated completion times.
- **Progress Bars:** Use a dual-track system. The background is a very light Cyan, while the active progress is a vibrant Cyan-to-Deep-Blue gradient.
- **Inputs:** Fields are flat with a light gray background, transitioning to a Cyan border on focus. Icons within inputs should use the Neutral Slate color at 50% opacity.
- **Chips/Badges:** Used for "Topic Tags" or "Difficulty Levels." These should be pill-shaped with low-saturation backgrounds and high-saturation text for readability.
- **Data Visualizations:** Charts and graphs within the virtual lab should use the primary and secondary colors as the main data points, set against the glass surfaces for a "HUD" (Heads-Up Display) effect.