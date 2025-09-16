# Laptop Damage Assessment App - Design Guidelines

## Design Approach
**Reference-Based Approach**: Drawing inspiration from professional assessment tools like Linear and Notion, combined with enterprise dashboard patterns from Carbon Design. This utility-focused application prioritizes efficiency, clarity, and data presentation over visual flair.

## Core Design Elements

### A. Color Palette
**Primary Colors:**
- Light mode: 219 15% 95% (light gray background), 219 25% 15% (dark text)  
- Dark mode: 219 25% 8% (dark background), 219 15% 92% (light text)

**Accent Colors:**
- Success (Grade A): 142 76% 36% (professional green)
- Warning (Grade B/C): 38 92% 50% (amber)
- Error (Grade D): 0 84% 60% (red)
- Info/Upload: 217 91% 60% (blue)

### B. Typography
**Font Stack:** Inter via Google Fonts CDN
- Headers: 600 weight, sizes from text-xl to text-4xl
- Body text: 400 weight, text-sm to text-base
- Data labels: 500 weight, text-xs to text-sm

### C. Layout System
**Spacing Units:** Consistent use of Tailwind units 2, 4, 6, 8, and 12
- Component padding: p-4, p-6
- Section margins: mb-6, mb-8  
- Grid gaps: gap-4, gap-6
- Container max-width: max-w-7xl with mx-auto

### D. Component Library

**Navigation:**
- Top navigation bar with app logo, main sections, and user actions
- Breadcrumb navigation for deep pages
- Sidebar for filtering and search options

**Data Input:**
- Drag-and-drop image upload zone with progress indicators
- Form fields with clear labels and validation states
- SKU input with auto-complete suggestions

**Data Display:**
- Card-based laptop records with thumbnail, SKU, grade badge, and key metrics
- Data table for bulk viewing with sortable columns
- Grade badges using accent colors with rounded corners
- Image galleries with lightbox functionality

**Assessment Interface:**
- Split-view layout: uploaded images on left, AI analysis results on right
- Damage annotation overlays on images
- Grade assignment with visual indicators and reasoning

**Search & Browse:**
- Search bar with filters dropdown
- Grade filter chips with color coding
- Pagination or infinite scroll for results
- Sort options (date, grade, SKU)

### E. Visual Hierarchy
- Clear information architecture with assessment workflow as primary path
- Consistent card patterns for laptop records
- Strategic use of whitespace to separate assessment sections
- Color-coded grade system for immediate visual recognition

## Key Interactions
- Smooth image upload with real-time preview
- Instant search with filtered results
- Modal overlays for detailed laptop record views
- Responsive grid that adapts from mobile to desktop

## Images
No large hero images required. Focus on:
- Uploaded laptop photos displayed in organized galleries
- Thumbnail previews in search results
- Placeholder states for empty upload areas
- Icon-based navigation elements using Heroicons library

This design prioritizes professional functionality while maintaining visual clarity for efficient laptop assessment workflows.