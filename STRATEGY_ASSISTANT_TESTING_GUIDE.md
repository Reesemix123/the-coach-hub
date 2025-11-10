# Strategy Assistant Testing Guide - Phase 1

## Overview
This guide will help you systematically test the Strategy Assistant feature and identify any issues before making it available to other coaches.

---

## Prerequisites

Before testing, ensure you have:
- ✅ Migration 023 applied to Supabase
- ✅ Dev server running on http://localhost:3002
- ✅ At least one team with:
  - An upcoming game scheduled
  - Some tagged plays in `play_instances` (for generating insights)
  - Some playbook plays
- ✅ Logged in as a coach

---

## Test 1: Game Week Station Integration

**URL:** `/teams/[teamId]/game-week`

### What to Test:
1. **Navigate to Game Week page**
   - Should see 6 station cards (Film, Playbook, Practice, Personnel, Game Plan, **Strategy Station**)

2. **Verify Strategy Station card displays:**
   - Station name: "Strategy Station"
   - Status indicator (gray/yellow/red/green)
   - Two metrics:
     - "Strategic Questions: X/Y answered" (should show "Not started" initially)
     - "Preparation Checklist: X/Y complete" (should show "Not started" initially)
   - Primary action button: "Generate Strategy Report"
   - Secondary actions: "View Analytics", "View Film"

3. **Check status logic:**
   - Gray = No report generated yet
   - Red = < 50% complete
   - Yellow = 50-80% complete
   - Green = 80%+ complete

### Expected Behavior:
- ✅ Strategy Station appears as 6th card
- ✅ Shows "Not started" metrics when no report exists
- ✅ "Generate Strategy Report" button links to `/teams/[teamId]/strategy-assistant?game=[gameId]`

### Issues Found:
```
[ ] Issue #1: _______________________
[ ] Issue #2: _______________________
```

---

## Test 2: Strategy Assistant Main Page (No Report Yet)

**URL:** `/teams/[teamId]/strategy-assistant` (no game parameter)

### What to Test:
1. **Navigate without game ID**
   - Should show game selector page

2. **Verify game selector displays:**
   - Page title: "Strategy Station"
   - Subtitle: "AI-powered game preparation assistant (coming soon)"
   - List of upcoming games (max 5)
   - Each game shows: opponent name, date
   - "Generate Report →" link for each game

3. **Click on a game**
   - Should navigate to `/teams/[teamId]/strategy-assistant?game=[gameId]`

### Expected Behavior:
- ✅ Shows clean game selector
- ✅ Lists upcoming games only
- ✅ Shows helpful message if no upcoming games
- ✅ Links to schedule page if no games

### Issues Found:
```
[ ] Issue #1: _______________________
[ ] Issue #2: _______________________
```

---

## Test 3: Generate Strategy Report

**URL:** `/teams/[teamId]/strategy-assistant?game=[gameId]`

### What to Test:
1. **First visit (no report exists):**
   - Page should generate report automatically
   - Should save to database (check `strategic_insights`, `strategic_questions`, `preparation_checklist` tables)

2. **Verify report displays:**
   - **Header:**
     - Title: "Strategy Station"
     - Game info: "Team Name vs Opponent • X days until game"
     - Data quality badge (High/Medium/Low Confidence)

   - **Left Column:**
     - **Strategic Insights section:**
       - Priority badges (Priority 1, 2, 3)
       - Category labels (opponent_tendency, own_strength, etc.)
       - Insight title and description
       - Recommendations list
     - **Opponent Tendencies table:**
       - Columns: Down, Distance, Run %, Pass %, Plays, Success %
       - Data grouped by down and distance range
     - **Team Analysis section:**
       - Strengths list
       - Weaknesses list
       - Top performing plays (if any)

   - **Right Column:**
     - **Strategic Questions preview:**
       - Shows first 3 questions
       - Question count
       - "Answer Questions" button
     - **Preparation Checklist preview:**
       - Shows first 5 items
       - Item count
       - "View Full Checklist" button
     - **AI Chat placeholder:**
       - "Coming soon" message
       - Disabled button

3. **Check data quality warning:**
   - If Medium/Low confidence, yellow warning banner should appear
   - Shows film tagged counts
   - Suggests tagging more film

### Expected Behavior:
- ✅ Report generates on first load
- ✅ Data saves to database
- ✅ All sections render correctly
- ✅ No console errors
- ✅ Links work to sub-pages

### Test Scenarios:

**Scenario A: Plenty of Film Data**
- Tag 100+ plays for your team
- Tag 50+ plays for opponent
- Should show "High Confidence" badge
- Should have rich insights

**Scenario B: Limited Film Data**
- Tag 20-50 plays for your team
- Tag 10-30 plays for opponent
- Should show "Medium Confidence" badge
- Should show warning message
- Insights should still generate (just flagged as low confidence)

**Scenario C: No Film Data**
- No tagged plays
- Should still generate report
- Should show "Limited Data" badge
- Insights should be generic/encourage film tagging

### Issues Found:
```
[ ] Issue #1: _______________________
[ ] Issue #2: _______________________
```

---

## Test 4: Strategic Questions Page

**URL:** `/teams/[teamId]/strategy-assistant/questions?game=[gameId]`

### What to Test:
1. **Navigate from main page**
   - Click "Answer Questions" button

2. **Verify questions page displays:**
   - **Header:**
     - Title: "Strategic Questions"
     - Team vs Opponent info
     - Progress percentage (e.g., "0%")
     - Progress count (e.g., "0/15 answered")
     - Progress bar

   - **Question categories:**
     - ⚡ Offensive Strategy
     - 🛡️ Defensive Strategy
     - 🦶 Special Teams
     - 👥 Personnel
     - 🎯 Situational

   - **Each question shows:**
     - Checkmark icon (empty if unanswered, filled if answered)
     - Question number and text
     - Multiple choice options (if provided)
     - Free-form textarea
     - "Save Response" button
     - Last saved timestamp (if answered)

3. **Test answering questions:**
   - **Multiple choice:**
     - Select a radio button
     - Click "Save Response"
     - Should save to database
     - Button should briefly show "Saved!"
     - Checkmark should turn green

   - **Free-form text:**
     - Type in textarea
     - Click "Save Response"
     - Should save to database

   - **Keyboard shortcut:**
     - Type answer
     - Press Cmd/Ctrl + Enter
     - Should auto-save

4. **Verify progress tracking:**
   - Answer 1 question → progress bar updates
   - Answer all questions → shows completion message
   - "View Preparation Checklist →" button appears

### Expected Behavior:
- ✅ Questions grouped by category
- ✅ Progress updates in real-time
- ✅ Saves persist across page refreshes
- ✅ Multiple choice + free-form both work
- ✅ Keyboard shortcut works (Cmd+Enter)
- ✅ Completion message shows when done

### Issues Found:
```
[ ] Issue #1: _______________________
[ ] Issue #2: _______________________
```

---

## Test 5: Preparation Checklist Page

**URL:** `/teams/[teamId]/strategy-assistant/checklist?game=[gameId]`

### What to Test:
1. **Navigate from main page**
   - Click "View Full Checklist" button

2. **Verify checklist page displays:**
   - **Header:**
     - Title: "Preparation Checklist"
     - Team vs Opponent info
     - Progress percentage
     - Progress count (e.g., "0/20 complete")
     - Progress bar
     - Status message based on days until game

   - **Priority summary cards:**
     - 🔴 Must Do (priority 1)
     - 🟡 Should Do (priority 2)
     - ⚪ Nice to Have (priority 3)
     - Each shows: X/Y complete

   - **Checklist items by category:**
     - Items sorted: incomplete first, then by priority
     - Each item shows:
       - Checkbox (circle = unchecked, green checkmark = checked)
       - Item text
       - Priority badge
       - Completed timestamp (if done)
       - "Add notes" / "Edit notes" button

3. **Test checking off items:**
   - Click checkbox on an item
   - Should toggle complete/incomplete
   - Should save immediately to database
   - Progress bar should update
   - Item should move to bottom (if completed)
   - Completed timestamp should appear

4. **Test notes functionality:**
   - Click "Add notes" button
   - Textarea should appear
   - Type notes
   - Click "Save Notes"
   - Notes should save and display in gray box
   - Click "Edit notes" to modify

5. **Verify priority system:**
   - Must Do items have red background/border
   - Should Do items have yellow background/border
   - Nice to Have items have gray background/border
   - Items auto-sort by completion status + priority

6. **Test completion states:**
   - Complete all "Must Do" items
   - Complete 50% of total → should show yellow status
   - Complete 80%+ → should show green status
   - Complete 100% → shows celebration message with confetti emoji

### Expected Behavior:
- ✅ Items check off instantly (optimistic update)
- ✅ Saves persist across page refreshes
- ✅ Notes save correctly
- ✅ Auto-sorting works (incomplete first)
- ✅ Progress tracking accurate
- ✅ Priority badges color-coded correctly
- ✅ Completion message shows when done

### Issues Found:
```
[ ] Issue #1: _______________________
[ ] Issue #2: _______________________
```

---

## Test 6: Database Verification

### Manual Database Checks:

1. **Check `strategic_insights` table:**
   ```sql
   SELECT * FROM strategic_insights
   WHERE team_id = 'your-team-id'
   AND game_id = 'your-game-id';
   ```
   - Should have multiple rows (5-10 insights)
   - Each with: category, title, description, priority
   - `generation_method` should be 'rule_based'
   - `is_active` should be true

2. **Check `strategic_questions` table:**
   ```sql
   SELECT * FROM strategic_questions
   WHERE team_id = 'your-team-id'
   AND game_id = 'your-game-id'
   ORDER BY sort_order;
   ```
   - Should have 10-15 questions
   - Grouped by category
   - Some with `response_options` (JSONB array)
   - `coach_response` should be NULL initially, then populate when answered

3. **Check `preparation_checklist` table:**
   ```sql
   SELECT * FROM preparation_checklist
   WHERE team_id = 'your-team-id'
   AND game_id = 'your-game-id'
   ORDER BY priority, sort_order;
   ```
   - Should have 15-25 items
   - Priority: 1, 2, or 3
   - `is_auto_generated` should be true
   - `is_completed` should be false initially, then toggle

### Expected Behavior:
- ✅ Data persists correctly
- ✅ Updates save immediately
- ✅ No orphaned records
- ✅ RLS policies allow access

### Issues Found:
```
[ ] Issue #1: _______________________
[ ] Issue #2: _______________________
```

---

## Test 7: Edge Cases & Error Handling

### Test These Scenarios:

1. **No upcoming games:**
   - Navigate to Strategy Assistant
   - Should show message: "No upcoming games scheduled"
   - Link to schedule page

2. **Game in the past:**
   - Try to access strategy assistant for past game
   - Should handle gracefully (allow access for review)

3. **Regenerate report:**
   - Visit strategy assistant page again (after report exists)
   - Should generate fresh report with latest data
   - Should NOT duplicate database records (should delete old data first)

4. **Insufficient film data:**
   - Delete all play_instances
   - Generate report
   - Should show "Limited Data" warning
   - Should still generate generic insights
   - Should encourage film tagging

5. **Network errors:**
   - Simulate slow network
   - Save a question response
   - Should show "Saving..." state
   - Should handle timeout gracefully

6. **Permission errors:**
   - Log in as different user (not on team)
   - Try to access strategy assistant
   - Should be blocked by RLS policies

### Expected Behavior:
- ✅ Graceful error messages
- ✅ No crashes or white screens
- ✅ Helpful guidance when data is missing
- ✅ RLS policies enforced

### Issues Found:
```
[ ] Issue #1: _______________________
[ ] Issue #2: _______________________
```

---

## Test 8: UI/UX Polish

### Check These Details:

1. **Typography:**
   - All text readable (dark on light backgrounds)
   - Form inputs have `text-gray-900` class
   - Headings use correct font sizes
   - Consistent spacing

2. **Responsive Design:**
   - Test on mobile (narrow viewport)
   - Test on tablet (medium viewport)
   - Test on desktop (wide viewport)
   - Grid layouts adjust properly
   - No horizontal scroll

3. **Loading States:**
   - "Saving..." indicators appear
   - "Loading..." messages while generating report
   - Skeleton screens or spinners

4. **Accessibility:**
   - Buttons have hover states
   - Links have hover states
   - Form inputs have focus rings
   - Checkboxes are keyboard accessible

5. **Consistency:**
   - Button styles match rest of app
   - Card styles match rest of app
   - Color scheme consistent (black/white/gray)
   - Icons from Lucide React

### Issues Found:
```
[ ] Issue #1: _______________________
[ ] Issue #2: _______________________
```

---

## Test 9: Performance

### Measure These:

1. **Page Load Times:**
   - Game Week page: ___ seconds
   - Strategy Assistant main page: ___ seconds
   - Questions page: ___ seconds
   - Checklist page: ___ seconds

2. **Report Generation:**
   - With 100+ plays tagged: ___ seconds
   - With 50 plays tagged: ___ seconds
   - With 0 plays tagged: ___ seconds

3. **Database Queries:**
   - Open browser DevTools → Network tab
   - Check number of queries to Supabase
   - Look for N+1 query problems

### Expected Performance:
- ✅ Pages load in < 2 seconds
- ✅ Report generates in < 5 seconds
- ✅ No excessive database queries
- ✅ Smooth interactions (no lag)

### Issues Found:
```
[ ] Issue #1: _______________________
[ ] Issue #2: _______________________
```

---

## Test 10: Integration with Existing Features

### Test Workflow:

1. **Film → Strategy Assistant:**
   - Tag 20+ plays in Film page
   - Navigate to Strategy Assistant
   - Verify insights use the tagged data

2. **Playbook → Strategy Assistant:**
   - Create 5-10 plays in Playbook
   - Generate strategy report
   - Verify "Top Plays" section references them

3. **Schedule → Strategy Assistant:**
   - Add upcoming game in Schedule
   - Navigate to Game Week
   - Verify Strategy Station shows the game

4. **Analytics → Strategy Assistant:**
   - Check that insights match analytics data
   - Compare success rates between Analytics page and Strategy report

### Expected Behavior:
- ✅ Data flows correctly between features
- ✅ No conflicts or inconsistencies
- ✅ Navigation links work

### Issues Found:
```
[ ] Issue #1: _______________________
[ ] Issue #2: _______________________
```

---

## Summary Checklist

Before releasing to other coaches:

### Critical (Must Fix):
- [ ] All pages load without errors
- [ ] Data saves to database correctly
- [ ] RLS policies work (can't see other teams' data)
- [ ] Form inputs are readable (text-gray-900)
- [ ] No console errors in browser DevTools
- [ ] Links work correctly
- [ ] Progress tracking accurate

### Important (Should Fix):
- [ ] Mobile responsive
- [ ] Loading states display
- [ ] Error messages are helpful
- [ ] Performance is good (< 5 sec load times)
- [ ] Edge cases handled gracefully

### Nice to Have (Can Fix Later):
- [ ] Animations smooth
- [ ] Perfect typography
- [ ] Advanced accessibility features
- [ ] Offline support

---

## Reporting Issues

When you find an issue, document:
1. **What page/feature** (e.g., "Strategic Questions page")
2. **What you did** (e.g., "Clicked Save Response button")
3. **What happened** (e.g., "Got 500 error")
4. **What should happen** (e.g., "Should save to database")
5. **Browser console errors** (screenshot or copy)

Share these with me and I'll help fix them!

---

## Next Steps After Testing

Once Phase 1 is clean:
1. ✅ Write user documentation
2. ✅ Create demo video
3. ✅ Invite beta testers (other coaches)
4. ✅ Collect feedback
5. ✅ Plan Phase 2 (AI features)

Good luck testing! 🎯
