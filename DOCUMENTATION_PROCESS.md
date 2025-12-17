# Documentation Update Process

This file defines the process for updating user-facing documentation and AI context.

---

## IMPORTANT: Verification Required

**Before updating `src/content/features.ts`, Claude MUST ask the user:**

> "This change affects [feature name]. Should I update the Feature Registry (`features.ts`) to keep the AI Assistant and User Guide in sync?"

Wait for user confirmation before proceeding.

---

## When to Trigger This Process

Ask the user about documentation updates when:

1. **Adding a new feature** - New UI, new page, new functionality
2. **Renaming a feature** - Menu item renamed, button text changed
3. **Changing navigation** - Feature moved to different location
4. **Removing a feature** - Feature deprecated or removed
5. **Changing how a feature works** - Workflow or steps changed

---

## Update Checklist

After user confirms, follow these steps:

### Step 1: Update Feature Registry
**File:** `src/content/features.ts`

- [ ] Add/update feature in `APP_FEATURES` array
- [ ] Include accurate `name` and `description`
- [ ] Include correct `navigationPath` (e.g., "Team > Settings")
- [ ] Include correct `guidePath` (e.g., "/guide/teams/team-settings")

### Step 2: Update User Guide (if needed)
**Location:** `src/content/guide/[category]/[page].md`

- [ ] Create new page if feature is new
- [ ] Update existing page if feature changed
- [ ] Ensure frontmatter has correct `title` and `description`

### Step 3: Verify
- [ ] Confirm AI context generates correctly (check `generateAIContext()` output)
- [ ] Test that guide page loads at the specified path

---

## File Locations

| Purpose | File |
|---------|------|
| Feature Registry (AI + Guide sync) | `src/content/features.ts` |
| User Guide Pages | `src/content/guide/**/*.md` |
| AI Prompt/Behavior | `src/lib/ai/context/static-context.ts` |
| Docs Navigation Config | `src/config/docs-navigation.ts` |

---

## Example Conversation

**Claude:** "I've added the new 'Export to PDF' button to the Playbook page. This is a new feature - should I update the Feature Registry (`features.ts`) to include it in the AI Assistant context and User Guide?"

**User:** "Yes, add it."

**Claude:** *Updates features.ts with:*
```typescript
{
  name: 'Export to PDF',
  description: 'Export your playbook or selected plays to a PDF file',
  guidePath: '/guide/playbook/export-pdf',
  navigationPath: 'Playbook > Export > PDF',
}
```

**Claude:** "Should I also create the guide page at `src/content/guide/playbook/export-pdf.md`?"

---

## Do NOT Update Without Asking

- `src/content/features.ts` - Controls AI context
- `src/config/docs-navigation.ts` - Controls guide sidebar
- Any `src/content/guide/**/*.md` file

Always get user confirmation first.
