
# Add Focus Keyword Analyzer to Product SEO Tab

## Overview
Add a focus keyword analyzer to the Vendor Product Editor's SEO tab, matching the pattern already used in the Blog Editor. The analyzer will check if the primary keyword appears in the SEO title, meta description, product name/slug, and product description.

## Changes

**File: `src/pages/vendor/VendorProductEditorPage.tsx`**

1. Add a "Focus Keyword" input field at the top of the SEO tab that extracts the first keyword from `seo_keywords`
2. Add a keyword analysis panel that checks presence in 4 areas:
   - SEO title (falls back to product name)
   - Meta description
   - Product name (equivalent to slug in blog context)
   - Product description (equivalent to body in blog context)
3. Display a progress bar and score (X/4 checks passed)
4. Add character count warnings for SEO title (>60) and meta description (>160) with destructive color styling
5. Add a helper note under the keywords field explaining the focus keyword feature

## Technical Details

The focus keyword analyzer logic:
- Extracts the first comma-separated keyword from `seo_keywords`
- Converts to lowercase for case-insensitive matching
- Checks 4 fields: `seo_title` (fallback `product.name`), `seo_description`, `product.name`, `description`
- Renders a color-coded grid (green checkmark / red X) with a progress bar
- Progress bar color: green (3-4 passes), yellow (2), red (0-1)

No database changes required -- this is purely a UI enhancement using existing fields.
