---
name: Wealth Management System
colors:
  surface: '#10131a'
  surface-dim: '#10131a'
  surface-bright: '#363941'
  surface-container-lowest: '#0b0e15'
  surface-container-low: '#191b23'
  surface-container: '#1d2027'
  surface-container-high: '#272a31'
  surface-container-highest: '#32353c'
  on-surface: '#e1e2ec'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#e1e2ec'
  inverse-on-surface: '#2e3038'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#b9c8de'
  on-secondary: '#233143'
  secondary-container: '#39485a'
  on-secondary-container: '#a7b6cc'
  tertiary: '#ffb786'
  on-tertiary: '#502400'
  tertiary-container: '#df7412'
  on-tertiary-container: '#461f00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#d4e4fa'
  secondary-fixed-dim: '#b9c8de'
  on-secondary-fixed: '#0d1c2d'
  on-secondary-fixed-variant: '#39485a'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#10131a'
  on-background: '#e1e2ec'
  surface-variant: '#32353c'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: -0.01em
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  body-sm:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: '0'
  label-caps:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  container-margin: 16px
  gutter: 12px
---

## Brand & Style
This design system is engineered for high-stakes financial environments where clarity, precision, and trust are paramount. The aesthetic follows a **Corporate Modern** philosophy, leaning into a data-centric execution that prioritizes legibility over decoration. 

The visual language communicates stability and analytical depth. By utilizing a deep, monochromatic foundation punctuated by high-signal functional colors, the UI directs focus toward performance metrics and portfolio health. The emotional response is one of calm control—transforming complex financial data into actionable insights through a disciplined, minimal interface.

## Colors
The palette is built on a "Deep-Sea" dark mode architecture to reduce eye strain during long-form data analysis. 

- **Foundation:** The background (#0B111B) provides a high-contrast base for the elevated surface (#1A222F), which houses all interactive cards and modules.
- **Accents:** A technical Blue is used for primary actions and selection states.
- **Conditional Formatting:** 
    - **Positive Trend:** Use `#10B981` for percentage gains, "saved" amounts, and upward trajectories. 
    - **Critical Alert:** Use `#F59E0B` for over-budget alerts, pending transactions, or high-risk exposure. In critical states, use black text on the amber background for maximum contrast.
- **Neutral Scales:** Slate grays are used to create a hierarchy between labels (secondary) and values (primary).

## Typography
We use **Geist** for its exceptional balance between a clean sans-serif and the precision of a monospaced font. This is critical for financial tables where numerical alignment is non-negotiable.

- **Tabular Figures:** All financial values must use the `data-mono` role, ensuring digits line up vertically in tables (font-feature-settings: 'tnum').
- **Information Density:** The type scale is intentionally compact. Body text at 14px allows for more data points per screen without sacrificing legibility.
- **Hierarchy:** Use `label-caps` for table headers and section descriptors to provide clear visual separation from the data itself.

## Layout & Spacing
The layout employs a **high-density fluid grid** optimized for mobile financial dashboards. 

- **Grid:** A 12-column system for desktop, collapsing to a single column on mobile with 16px side margins.
- **Rhythm:** A strict 4px baseline grid ensures tight vertical rhythm. Components like list items and input fields use a 12px (`md`) internal padding to maximize vertical space.
- **Data Density:** Gutters are narrowed to 12px on mobile to allow for multi-column data tables (e.g., Symbol, Price, % Change) to fit within the viewport without horizontal scrolling.

## Elevation & Depth
In this design system, depth is achieved through **Tonal Layers** rather than heavy shadows to maintain a sleek, professional aesthetic.

- **Level 0 (Background):** #0B111B. The canvas.
- **Level 1 (Cards/Surfaces):** #1A222F. Used for grouped content and interactive modules. No shadow, but a 1px subtle stroke (#2D3748) is used to define boundaries.
- **Level 2 (Modals/Popovers):** #242F3F. Slightly lighter than Level 1, featuring a soft 16px blur shadow with 40% opacity to indicate temporary focus.
- **Interaction:** Hover and press states use opacity shifts (e.g., 80% opacity on press) rather than physical lifts.

## Shapes
A **Soft** (0.25rem) corner radius is used across the system. This subtle rounding maintains the professional "serious" tone of a financial institution while feeling modern and accessible. 

- Small components (buttons, inputs): 4px radius.
- Large components (cards, modals): 8px radius.
- Progress bars and tags: 4px radius to match the primary component language.

## Components
Consistent implementation of components ensures a reliable user experience.

- **Buttons:** Primary buttons are solid Blue (#3B82F6) with white text. Secondary buttons use a ghost style with a subtle gray border.
- **Data Tables:** Every row has a 1px bottom border (#2D3748). Use "zebra striping" only for extremely large datasets.
- **Conditional Chips:** 
    - *Success:* Green text on 10% opacity green background.
    - *Critical:* Black text on solid Yellow/Amber (#F59E0B) background for extreme urgency.
- **Input Fields:** Darker background than the card surface, using a 1px Blue border on focus. Labels are always persistent (not floating) to maintain clarity.
- **i18n Implementation:** All UI labels must follow the pattern `namespace.context.action` (e.g., `portfolio.summary.total_balance`). Avoid concatenating strings; use variables for dynamic data within labels (e.g., `savings.goal.reached_message` = "You have reached {percentage}% of your goal").