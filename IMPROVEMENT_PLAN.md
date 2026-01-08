# Banner Content Pipeline - Improvement Plan

## Executive Summary

The current app is an MVP that works well for single-user, linear content creation. To make it production-ready for team use and robust content management, we need to address: **versioning**, **content library**, **collaboration**, **publishing reliability**, and **analytics**.

---

## Current State Assessment

| Area | Current State | Impact |
|------|--------------|--------|
| Storage | Session-based, no history | Can't recover old versions |
| Content Reuse | None | Recreate similar content from scratch |
| Collaboration | Single browser only | Can't share work with team |
| Publishing | Fire-and-forget | Don't know if it actually worked |
| Analytics | None | No insight into content performance |

---

## Proposed Architecture

### Phase 1: Content Library & Versioning (High Impact)

**Goal**: Never lose content, enable reuse

#### 1.1 Content Versioning System

```
Current: Session → overwrites → Session
Proposed: Session → creates → Version → Version → Version
```

**Database Schema Changes:**
```sql
-- New table for version history
CREATE TABLE content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) REFERENCES sessions(id),
  step VARCHAR(50) NOT NULL, -- 'blog', 'linkedin', 'carousel'
  content JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255), -- user email
  prompt_used TEXT, -- AI prompt that generated this
  parent_version_id UUID REFERENCES content_versions(id)
);

CREATE INDEX idx_versions_session ON content_versions(session_id, step);
```

**Features:**
- Auto-save versions on each generation/edit
- View version history sidebar
- Compare versions side-by-side
- Restore any previous version
- Branch from any version

**UI Changes:**
- Add "History" button to each step
- Version timeline showing all iterations
- Diff view for comparing versions

#### 1.2 Content Library

**Goal**: Save and reuse successful content patterns

```sql
CREATE TABLE content_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255),
  type VARCHAR(50) NOT NULL, -- 'blog_template', 'post_template', 'carousel_template'
  name VARCHAR(255) NOT NULL,
  description TEXT,
  content JSONB NOT NULL,
  tags TEXT[], -- searchable tags
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  is_public BOOLEAN DEFAULT false -- share with team
);

CREATE INDEX idx_library_type ON content_library(type);
CREATE INDEX idx_library_tags ON content_library USING GIN(tags);
```

**Features:**
- "Save to Library" button on each content piece
- Browse library by type (blogs, posts, carousels)
- Search by tags or content
- "Use as Template" to start new session
- Track which templates perform best

**UI Changes:**
- Library sidebar/modal
- Tag editor when saving
- Template selection in Step 1

---

### Phase 2: Publishing Pipeline (Medium Impact)

**Goal**: Reliable, trackable publishing with status visibility

#### 2.1 Publishing Queue & Status

```sql
CREATE TABLE publish_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) REFERENCES sessions(id),
  platform VARCHAR(50) NOT NULL, -- 'webflow', 'recurpost', 'sheets', 'drive'
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, success, failed, retrying
  payload JSONB NOT NULL,
  response JSONB,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  scheduled_for TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_jobs_status ON publish_jobs(status);
CREATE INDEX idx_jobs_session ON publish_jobs(session_id);
```

**Features:**
- Background job processing (not blocking UI)
- Automatic retry on failure (exponential backoff)
- Clear status indicators (pending/success/failed)
- Webhook callbacks from platforms when available
- Manual retry button for failed jobs

**UI Changes:**
- Publishing status dashboard
- Real-time status updates (polling or WebSocket)
- Error details with retry option
- Scheduled publishing calendar

#### 2.2 Content Status Workflow

```
Draft → Ready for Review → Approved → Published → Archived
```

**Features:**
- Status field on sessions
- Filter dashboard by status
- Bulk status changes
- Notes/comments on status changes

---

### Phase 3: Analytics & Insights (Medium Impact)

**Goal**: Understand what content works

#### 3.1 Generation Analytics

```sql
CREATE TABLE generation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255),
  step VARCHAR(50),
  event_type VARCHAR(50), -- 'generate', 'regenerate', 'edit', 'publish'
  prompt_hash VARCHAR(64), -- track which prompts used
  tokens_used INTEGER,
  duration_ms INTEGER,
  success BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Metrics to Track:**
- Generation success rate by step
- Average iterations per content piece
- Most effective prompts
- Time spent per step
- Completion rate through pipeline

**UI Changes:**
- Analytics dashboard page
- Per-session metrics sidebar
- Prompt effectiveness reports

#### 3.2 Content Performance (Future)

When integrated with analytics platforms:
- Track published content views
- LinkedIn engagement metrics
- Conversion from content to site visits
- A/B test different content variations

---

### Phase 4: Team Collaboration (Lower Priority for Now)

**Goal**: Multiple team members working together

#### 4.1 User Management

Already have NextAuth - extend with:
- Team/organization concept
- Role-based access (admin, editor, viewer)
- Session ownership + sharing

#### 4.2 Real-Time Collaboration

- WebSocket for live updates
- Presence indicators (who's viewing)
- Commenting on content
- @mentions and notifications

---

## Implementation Roadmap

### Immediate (This Week)
| Task | Effort | Impact |
|------|--------|--------|
| Add version history table | 2 hrs | High |
| Save version on each generation | 2 hrs | High |
| Version history UI (basic list) | 4 hrs | High |
| Restore from version | 2 hrs | High |

### Short-Term (Next 2 Weeks)
| Task | Effort | Impact |
|------|--------|--------|
| Content library table | 2 hrs | Medium |
| Save to library UI | 3 hrs | Medium |
| Browse/search library | 4 hrs | Medium |
| Use template to start session | 3 hrs | Medium |
| Publishing job queue | 4 hrs | High |
| Job status UI | 3 hrs | High |

### Medium-Term (Month)
| Task | Effort | Impact |
|------|--------|--------|
| Version comparison (diff view) | 6 hrs | Medium |
| Analytics events tracking | 4 hrs | Medium |
| Analytics dashboard | 8 hrs | Medium |
| Scheduled publishing | 6 hrs | Medium |
| Content status workflow | 4 hrs | Medium |

---

## Quick Wins (Can Do Today)

### 1. Add "Duplicate Session" Button
- Clone existing session to start similar content
- 30 min implementation

### 2. Add "Export Session as JSON"
- Download full session data
- Manual backup option
- 30 min implementation

### 3. Improve Error Messages
- Show retry button on failures
- Log errors to console with context
- 1 hr implementation

### 4. Add Session Notes Field
- Free-form notes per session
- Track decisions/context
- 1 hr implementation

### 5. Dashboard Filters
- Filter by status (in_progress, completed)
- Search by title
- 2 hr implementation

---

## Database Migration Strategy

1. **Non-Breaking Changes First**
   - Add new tables without changing existing
   - Backfill data gradually

2. **Feature Flags**
   - Enable new features per-user
   - Test with small group first

3. **Rollback Plan**
   - Keep old code paths available
   - Easy switch back if issues

---

## Technical Recommendations

### Storage
- Keep Vercel Postgres (works well)
- Add proper indexes for new tables
- Consider Vercel KV for caching (sessions list, library browse)

### Background Jobs
- Use Vercel Cron for scheduled jobs
- Or integrate QStash for reliable job queue
- Implement idempotency for retries

### Real-Time (Future)
- Vercel doesn't support WebSockets natively
- Options: Pusher, Ably, or Supabase Realtime
- Start with polling, upgrade later

### Image Storage (Future)
- Move from data URLs to Vercel Blob
- Enables sharing, CDN delivery
- Reduces session data size

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Content recovery rate | 0% (no history) | 100% (any version) |
| Time to create similar content | Start from scratch | 50% faster with templates |
| Publishing success visibility | Unknown | 100% tracked |
| Failed publish recovery | Manual redo | Auto-retry |
| Team content sharing | Not possible | Full collaboration |

---

## Recommended Starting Point

**Start with Phase 1.1 (Versioning)** because:
1. Highest user pain point (losing work)
2. Foundation for other features
3. Relatively simple to implement
4. Immediate value

Would you like me to start implementing any of these improvements?
