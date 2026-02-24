

## Add Tag Filter to Public Blog Page

### What it does
Adds a horizontal row of clickable tag pills above the blog post grid. Visitors can click a tag to show only posts with that tag, or click "All" to reset.

### How it works
1. After fetching all published posts, extract every unique tag from all posts' `tags` JSON arrays
2. Display them as clickable `Badge` components in a scrollable row
3. Track the selected tag in local state (also sync to URL search params like `?tag=AI` for shareability)
4. Filter the posts array client-side before rendering the grid
5. Show the active tag highlighted with the `default` badge variant, inactive ones as `outline`

### Technical details

**File: `src/pages/BlogPage.tsx`** (only file changed)

- Import `useSearchParams` from `react-router-dom` and `useMemo`/`useState` from React
- After `posts` are fetched, compute `allTags` with `useMemo` -- iterate all posts, collect tags from the JSONB arrays, deduplicate, and sort alphabetically
- Read/write `?tag=` search param for the active filter (enables shareable filtered URLs)
- Add a filter bar between the subtitle and the grid:
  - "All" pill (resets filter)
  - One pill per unique tag
  - Active tag uses `variant="default"`, others use `variant="outline"`
  - Wrapped in a flex container with `overflow-x-auto` for horizontal scroll on mobile
- Filter `posts` array: if a tag is selected, only show posts whose `tags` array includes that tag
- Update the empty state to distinguish "no posts at all" vs "no posts matching this tag"

No database changes needed -- tags are already stored as JSONB on `blog_posts` and fetched in the existing query.

