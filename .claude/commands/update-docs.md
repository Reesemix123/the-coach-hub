---
description: Update documentation (User Guide + AI context) when features change
argument-hint: <feature-description>
---

# Documentation Update Command

Update the User Guide and AI Assistant context when a feature is added or changed.

## Feature Being Documented

$ARGUMENTS

## Files to Update

1. **Feature Registry** (`src/content/features.ts`)
   - Add/update feature in `APP_FEATURES` array
   - Add to `COMMON_TASKS` if it's a common user action

2. **User Guide** (`src/content/guide/[category]/[page].md`)
   - Create new page or update existing page
   - Must match entry in `src/config/docs-navigation.ts`

3. **Navigation** (`src/config/docs-navigation.ts`)
   - Add new pages to the sidebar navigation (if creating new guide page)

## Process

1. First, read the current state of these files:
   - @src/content/features.ts
   - @src/config/docs-navigation.ts
   - @DOCUMENTATION_PROCESS.md

2. Identify which category the feature belongs to (teams, film, playbook, analytics, etc.)

3. Propose the specific updates needed:
   - Show the exact code changes for features.ts
   - Show the markdown content for the guide page
   - Show any navigation updates needed

4. After user approval, make the updates

## Output Format

Provide a summary like:

```
Documentation Updates for: [Feature Name]

FILES TO UPDATE:
- features.ts: Add [feature] under [category]
- guide/[path].md: Add/update section about [feature]
- docs-navigation.ts: [if needed]

PROPOSED CHANGES:
[Show the actual code/content changes]
```

## Important

- Always include `guidePath` and `navigationPath` in features.ts entries
- User guide content should be practical and include step-by-step instructions
- Link related features and guide pages where helpful
