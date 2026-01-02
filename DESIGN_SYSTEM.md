# Youth Coach Hub Design System
## Version 1.0

This document defines the visual design language for Youth Coach Hub. Use this as a reference when building new pages or components to ensure consistency across the application.

**Scope:** This design system currently applies to **marketing pages** (homepage, pricing, signup, login, about, etc.). Dashboard and app pages will be migrated gradually.

---

## 1. Color Palette

### Primary Colors

| Name | Hex | Tailwind Class | Usage |
|------|-----|----------------|-------|
| **Background Dark** | `#0d1117` | `bg-brand-dark` | Main page backgrounds, app shell |
| **Surface** | `#161b22` | `bg-brand-surface` | Cards, modals, elevated surfaces |
| **Surface Elevated** | `#1e2a3a` | `bg-brand-elevated` | Hover states, active tabs, tertiary surfaces |
| **Border** | `#374151` | `border-gray-700` | Default borders, dividers |
| **Border Subtle** | `#1f2937` | `border-gray-800` | Subtle borders, card outlines |

### Accent Colors

| Name | Hex | Tailwind Class | Usage |
|------|-----|----------------|-------|
| **Brand Green** | `#a3e635` | `text-brand-green` / `bg-brand-green` | Primary CTAs, highlights, success states, brand accents |
| **Brand Green Light** | `#bef264` | `bg-brand-green-light` | Hover state for green buttons |
| **Brand Green Muted** | `#a3e635` @ 10-20% | `bg-brand-green/10` | Icon backgrounds, badges, subtle highlights |

### Text Colors

| Name | Hex | Tailwind Class | Usage |
|------|-----|----------------|-------|
| **Text Primary** | `#ffffff` | `text-white` | Headlines, important text, primary content |
| **Text Secondary** | `#d1d5db` | `text-gray-300` | Body text, descriptions |
| **Text Muted** | `#9ca3af` | `text-gray-400` | Secondary descriptions, helper text |
| **Text Subtle** | `#6b7280` | `text-gray-500` | Placeholders, timestamps, tertiary info |

### Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Success** | `#a3e635` (Brand Green) | Success messages, confirmations |
| **Error** | `#ef4444` | Error states, destructive actions |
| **Warning** | `#f59e0b` | Warnings, caution states |
| **Info** | `#3b82f6` | Informational messages |

### Color Usage Guidelines

1. **Dark backgrounds are the default** - Use `#0d1117` for page backgrounds
2. **Use Brand Green sparingly** - Reserve for CTAs, active states, and key highlights
3. **Never use green for body text** - Only for accents and interactive elements
4. **Maintain contrast ratios** - White text on dark backgrounds, dark text on green buttons
5. **Layer surfaces for hierarchy** - Background → Surface → Surface Elevated

---

## 2. Typography

### Font Family

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

**Tailwind:** Use default sans-serif or configure Inter in tailwind.config.js

### Type Scale

| Name | Size | Weight | Line Height | Tailwind Classes | Usage |
|------|------|--------|-------------|------------------|-------|
| **Display** | 48-72px | 700 | 1.1 | `text-5xl md:text-7xl font-bold` | Hero headlines only |
| **H1** | 36-48px | 700 | 1.2 | `text-4xl md:text-5xl font-bold` | Page titles |
| **H2** | 30-36px | 700 | 1.2 | `text-3xl md:text-4xl font-bold` | Section headers |
| **H3** | 24px | 600 | 1.3 | `text-2xl font-semibold` | Card headers, subsections |
| **H4** | 20px | 600 | 1.4 | `text-xl font-semibold` | Component headers |
| **H5** | 18px | 600 | 1.4 | `text-lg font-semibold` | Small headers |
| **Body Large** | 18-20px | 400 | 1.6 | `text-xl` | Lead paragraphs |
| **Body** | 16px | 400 | 1.6 | `text-base` | Default body text |
| **Body Small** | 14px | 400 | 1.5 | `text-sm` | Secondary content, descriptions |
| **Caption** | 12px | 400-500 | 1.4 | `text-xs` | Labels, timestamps, helper text |

### Typography Guidelines

1. **Headlines are white** (`text-white`)
2. **Body text is gray-300 or gray-400** for comfortable reading
3. **Use font-semibold (600) for emphasis**, not bold (700) in body text
4. **Limit line length** to ~65-75 characters for readability
5. **Use tracking-tight** on large headlines for polish

---

## 3. Spacing System

### Base Unit
8px base unit. All spacing should be multiples of 8.

### Spacing Scale

| Name | Size | Tailwind | Usage |
|------|------|----------|-------|
| **2xs** | 4px | `p-1`, `gap-1` | Tight icon spacing |
| **xs** | 8px | `p-2`, `gap-2` | Inline element spacing |
| **sm** | 12px | `p-3`, `gap-3` | Compact component padding |
| **md** | 16px | `p-4`, `gap-4` | Default component padding |
| **lg** | 24px | `p-6`, `gap-6` | Card padding, section gaps |
| **xl** | 32px | `p-8`, `gap-8` | Large section padding |
| **2xl** | 48px | `py-12` | Section vertical spacing |
| **3xl** | 64px | `py-16` | Major section breaks |
| **4xl** | 96px | `py-24` | Hero/marketing sections |

### Layout Containers

```html
<!-- Max width container -->
<div class="max-w-6xl mx-auto px-8">

<!-- Narrow content container (forms, text) -->
<div class="max-w-3xl mx-auto px-8">

<!-- Wide container (dashboards, tables) -->
<div class="max-w-7xl mx-auto px-8">
```

### Spacing Guidelines

1. **Consistent horizontal padding**: Use `px-8` for main containers
2. **Generous vertical spacing** on marketing pages (`py-16` to `py-24`)
3. **Tighter spacing** in app/dashboard pages (`py-6` to `py-12`)
4. **Use gap instead of margins** for flex/grid layouts

---

## 4. Component Patterns

### Buttons

#### Primary Button (CTA)
```html
<button class="px-8 py-4 bg-brand-green text-brand-dark font-semibold rounded-xl hover:bg-brand-green-light transition-all">
  Start Free Trial
</button>
```
- Use for main calls-to-action
- One per section maximum
- Add glow effect for hero CTAs: `shadow-lg shadow-brand-green/20`

#### Secondary Button
```html
<button class="px-8 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20">
  Learn More
</button>
```
- Use for secondary actions
- Pairs with primary button

#### Tertiary/Ghost Button
```html
<button class="px-6 py-3 text-gray-400 hover:text-white font-medium transition-colors">
  Cancel
</button>
```
- Use for cancel, back, or low-priority actions

#### Outline Button
```html
<button class="w-full py-4 rounded-xl border border-gray-700 text-white font-semibold hover:bg-brand-elevated transition-all">
  Get Started
</button>
```
- Use for card CTAs, non-primary actions

#### Button Sizes

| Size | Classes | Usage |
|------|---------|-------|
| Small | `px-4 py-2 text-sm` | Inline actions, table rows |
| Medium | `px-6 py-3 text-base` | Default, forms |
| Large | `px-8 py-4 text-lg` | Hero CTAs, marketing |

### Cards

#### Default Card
```html
<div class="rounded-2xl bg-brand-surface border border-gray-800 p-6">
  <!-- Content -->
</div>
```

#### Interactive Card (Hover Effect)
```html
<div class="rounded-2xl bg-brand-surface border border-gray-800 p-6 hover:border-brand-green/30 transition-all">
  <!-- Content -->
</div>
```

#### Highlighted Card
```html
<div class="rounded-2xl bg-brand-surface border-2 border-brand-green/50 p-6 shadow-lg shadow-brand-green/10">
  <!-- Content -->
</div>
```

### Form Inputs

#### Text Input
```html
<input
  type="text"
  class="w-full px-4 py-3 bg-brand-dark border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green focus:outline-none transition-colors"
  placeholder="Enter text..."
/>
```

#### Input with Label
```html
<div>
  <label class="block text-sm font-medium text-gray-300 mb-2">
    Email Address
  </label>
  <input
    type="email"
    class="w-full px-4 py-3 bg-brand-dark border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green focus:outline-none transition-colors"
    placeholder="coach@team.com"
  />
</div>
```

#### Select Dropdown
```html
<select class="w-full px-4 py-3 bg-brand-dark border border-gray-700 rounded-lg text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green focus:outline-none transition-colors">
  <option>Select option...</option>
</select>
```

### Badges & Tags

#### Status Badge
```html
<span class="px-3 py-1 bg-brand-green/10 text-brand-green text-sm font-medium rounded-full border border-brand-green/20">
  Active
</span>
```

#### Neutral Badge
```html
<span class="px-3 py-1 bg-gray-800 text-gray-300 text-sm font-medium rounded-full">
  Draft
</span>
```

### Icons

- Use **Lucide React** icons (already in project)
- Default size: `w-5 h-5` for inline, `w-6 h-6` for standalone
- Color: `text-gray-400` default, `text-brand-green` for active/accent
- Feature icons: Use `w-6 h-6` in a `w-12 h-12` rounded container

```html
<!-- Icon in container -->
<div class="w-12 h-12 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center">
  <svg class="w-6 h-6">...</svg>
</div>
```

### Navigation

#### Nav Link (Inactive)
```html
<a href="#" class="text-gray-400 hover:text-white transition-colors text-sm">
  Features
</a>
```

#### Nav Link (Active)
```html
<a href="#" class="text-white font-medium text-sm">
  Dashboard
</a>
```

#### Nav CTA Button
```html
<a href="/signup" class="px-5 py-2.5 bg-brand-green text-brand-dark font-semibold rounded-lg hover:bg-brand-green-light transition-colors text-sm">
  Start Free
</a>
```

---

## 5. Effects & Animations

### Shadows

| Name | CSS | Usage |
|------|-----|-------|
| **Card Shadow** | `shadow-lg` | Elevated cards, modals |
| **Glow (Green)** | `shadow-lg shadow-brand-green/20` | Primary CTAs, highlighted elements |
| **Glow Hover** | `shadow-xl shadow-brand-green/30` | CTA hover state |

### Transitions

```css
/* Default transition */
transition-all

/* Color transitions only */
transition-colors

/* Recommended duration */
duration-200 (default)
duration-300 (for larger elements)
```

### Hover States

1. **Buttons**: Background color change + optional scale
2. **Cards**: Border color change (`border-brand-green/30`)
3. **Links**: Text color from gray-400 to white
4. **Icons**: Color change or opacity

### Animation Keyframes (defined in globals.css)

```css
/* Fade in up (for page load) */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Subtle pulse (for accents) */
@keyframes pulse-slow {
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.3; }
}
```

---

## 6. Page Templates

### Marketing Page Structure
```html
<main class="bg-brand-dark min-h-screen">
  <nav><!-- Marketing nav with logo, links, CTA --></nav>

  <section class="py-24 px-8"><!-- Hero --></section>
  <section class="py-16 px-8 bg-brand-surface"><!-- Features --></section>
  <section class="py-16 px-8"><!-- Content --></section>
  <section class="py-16 px-8"><!-- CTA --></section>

  <footer class="py-12 px-8 bg-brand-surface border-t border-gray-800">
</main>
```

### App Page Structure (Future - not yet implemented)
```html
<main class="bg-brand-dark min-h-screen">
  <nav class="border-b border-gray-800"><!-- App nav --></nav>

  <div class="py-8 px-8">
    <div class="max-w-6xl mx-auto">
      <header class="mb-8"><!-- Page title --></header>
      <div><!-- Page content --></div>
    </div>
  </div>
</main>
```

---

## 7. Responsive Breakpoints

Use Tailwind's default breakpoints:

| Breakpoint | Min Width | Usage |
|------------|-----------|-------|
| `sm` | 640px | Landscape phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large screens |

### Common Responsive Patterns

```html
<!-- Responsive grid -->
<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

<!-- Responsive text size -->
<h1 class="text-4xl md:text-5xl lg:text-6xl">

<!-- Responsive padding -->
<section class="py-12 md:py-16 lg:py-24 px-4 md:px-8">

<!-- Hide on mobile -->
<div class="hidden md:block">

<!-- Stack on mobile, row on desktop -->
<div class="flex flex-col md:flex-row gap-4">
```

---

## 8. Do's and Don'ts

### Do ✅
- Use the dark color palette consistently
- Reserve Brand Green for CTAs and accents
- Maintain generous whitespace
- Use rounded corners (`rounded-lg`, `rounded-xl`, `rounded-2xl`)
- Add hover/focus states to interactive elements
- Use subtle borders (`border-gray-800`) for structure

### Don't ❌
- Use pure black (`#000000`) - use `#0d1117` instead
- Overuse Brand Green - it should pop, not overwhelm
- Mix border radius styles on the same page
- Use borders heavier than 2px
- Forget focus states for accessibility
- Use light backgrounds on marketing pages

---

## 9. Reference: Template Page (Homepage)

The homepage (`src/components/home/HomePage.tsx`) serves as the reference implementation for this design system. When converting other marketing pages, use it as a template for:

- Navigation structure
- Section spacing
- Color usage
- Button styles
- Card patterns
- Footer design

---

## 10. Quick Reference

### Most Used Classes

```
Backgrounds:    bg-brand-dark  bg-brand-surface  bg-brand-elevated
Borders:        border-gray-800  border-gray-700  border-brand-green/30
Text:           text-white  text-gray-300  text-gray-400  text-brand-green
Buttons:        bg-brand-green text-brand-dark hover:bg-brand-green-light
Cards:          rounded-2xl bg-brand-surface border border-gray-800 p-6
Inputs:         bg-brand-dark border-gray-700 rounded-lg focus:border-brand-green
```

### Brand Color Variables (Tailwind)

```javascript
// Available after tailwind.config.js update
brand: {
  dark: '#0d1117',
  surface: '#161b22',
  elevated: '#1e2a3a',
  green: '#a3e635',
  'green-light': '#bef264',
}
```

---

*Last updated: January 2025*
*Version: 1.0*
*Scope: Marketing pages only*
