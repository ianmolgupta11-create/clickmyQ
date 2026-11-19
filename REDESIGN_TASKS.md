# MediNexPlus UI Redesign - Task Breakdown
For continuation by other agents

## Overview
Total scope: ~170 TSX files (non-API), mix of styling approaches, needs unification.

## PHASE 1: FOUNDATION (Design System & Infrastructure)
Priority: CRITICAL | Can be done by any agent

### Task 1.1: Create Unified Design System
- [ ] Create `/src/styles/design-system.css` with CSS variables
- [ ] Define color palette (unify teal/purple - recommend teal as primary)
- [ ] Define typography scale, spacing system (8pt grid)
- [ ] Define border radius, shadows, transitions
- [ ] Define breakpoints
- **Files**: `src/styles/design-system.css` (new)
- **Dependencies**: None
- **Time**: ~2-3 hours

### Task 1.2: Create Component Library Structure
- [ ] Create `/src/components/ui/` folder
- [ ] Create base components: Button, Card, Input, Badge, etc.
- [ ] Make them reusable and consistent
- [ ] Use TypeScript with proper props
- **Files**: `src/components/ui/*.tsx` (new)
- **Dependencies**: 1.1
- **Time**: ~4-6 hours

### Task 1.3: Update Global Styles
- [ ] Integrate design system into `globals.css`
- [ ] Clean up unused styles
- [ ] Ensure consistency
- **Files**: `src/app/globals.css`
- **Dependencies**: 1.1, 1.2
- **Time**: ~1-2 hours

## PHASE 2: CORE LAYOUT COMPONENTS
Priority: HIGH | Foundation for all pages

### Task 2.1: Redesign Navbar
- [ ] Unify with design system
- [ ] Improve mobile menu
- [ ] Better dropdown animations
- [ ] Consistent styling
- **Files**: `src/components/Navbar.tsx`, `src/components/Navbar.module.css`
- **Dependencies**: Phase 1
- **Time**: ~3-4 hours

### Task 2.2: Redesign Footer
- [ ] Clean up, unify styling
- [ ] Better responsive layout
- [ ] Consistent with design system
- **Files**: `src/components/Footer.tsx`, `src/components/Footer.module.css`
- **Dependencies**: Phase 1
- **Time**: ~2-3 hours

### Task 2.3: Update Layout
- [ ] Ensure proper structure
- [ ] Add any missing meta/SEO improvements
- **Files**: `src/app/layout.tsx`
- **Dependencies**: 2.1, 2.2
- **Time**: ~30 min

## PHASE 3: LANDING PAGE REDESIGN
Priority: HIGH | Most visible

### Task 3.1: Break Down ClickMyQLanding.tsx
- [ ] Split into smaller components (Hero, Features, etc.)
- [ ] Move styles out of inline style block to CSS modules
- [ ] Each section becomes its own component
- **Files**: Create `src/components/landing/*`, modify `src/components/ClickMyQLanding.tsx`
- **Dependencies**: Phase 1, 2
- **Time**: ~6-8 hours (biggest task)

### Task 3.2: Redesign Hero Section
- [ ] Clean, modern hero
- [ ] Better CTAs
- [ ] Improved animations (per Emil's principles)
- [ ] Responsive
- **Files**: `src/components/landing/Hero.tsx` (new)
- **Dependencies**: 3.1
- **Time**: ~2-3 hours

### Task 3.3: Redesign Other Landing Sections
- [ ] Features/Solutions
- [ ] Pricing
- [ ] Testimonials
- [ ] FAQ
- [ ] CTA
- **Files**: `src/components/landing/*.tsx` (new)
- **Dependencies**: 3.1
- **Time**: ~4-5 hours

## PHASE 4: OTHER PUBLIC PAGES
Priority: MEDIUM-HIGH

### Task 4.1: About Page
- [ ] Review and redesign
- **Files**: `src/app/about/*`
- **Time**: ~2-3 hours

### Task 4.2: Treatments Pages
- [ ] Unify treatment page designs
- [ ] Improve layout and CTAs
- **Files**: `src/app/treatments/**/*`
- **Time**: ~4-6 hours

### Task 4.3: Contact/Blog Pages
- [ ] Clean up and unify
- **Files**: `src/app/contact/*`, `src/app/blog/*`
- **Time**: ~2-3 hours

## PHASE 5: DASHBOARD PAGES
Priority: MEDIUM | Many different dashboards

### Task 5.1: Create Dashboard Layout System
- [ ] Unified dashboard layout component
- [ ] Consistent sidebar, header
- [ ] Role-based theming
- **Files**: `src/components/dashboard/*` (new)
- **Time**: ~4-5 hours

### Task 5.2: Redesign Key Dashboards
- [ ] Doctor dashboard
- [ ] Patient dashboard  
- [ ] Admin dashboards
- [ ] Others as needed
- **Files**: Various dashboard pages
- **Time**: ~8-12 hours (large)

## PHASE 6: POLISH & OPTIMIZATION
Priority: LOW-MEDIUM

### Task 6.1: Animation Audit & Improvement
- [ ] Apply Emil Kowalski's animation principles
- [ ] Remove unnecessary animations
- [ ] Add purposeful ones
- [ ] Respect prefers-reduced-motion
- **Time**: ~2-3 hours

### Task 6.2: Accessibility Audit
- [ ] Keyboard navigation
- [ ] ARIA labels
- [ ] Color contrast
- [ ] Focus states
- **Time**: ~2-3 hours

### Task 6.3: Responsive Testing & Fixes
- [ ] Mobile, tablet breakpoints
- **Time**: ~2-3 hours

### Task 6.4: Performance Optimization
- [ ] Image optimization
- [ ] Code splitting
- [ ] Remove unused CSS
- **Time**: ~1-2 hours

## Handoff Instructions
When handing off to another agent:
1. Read this file and AUDIT_AND_REDESIGN_PLAN.md
2. Check which phase/task is next
3. Follow the design system once created
4. Test changes
5. Update task status
6. Document decisions
