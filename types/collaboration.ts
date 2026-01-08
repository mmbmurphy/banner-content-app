// Activity types for the activity feed
export type ActivityType =
  | 'session_created'
  | 'session_duplicated'
  | 'step_completed'
  | 'content_generated'
  | 'content_edited'
  | 'status_changed'
  | 'assignee_changed'
  | 'review_requested'
  | 'review_completed'
  | 'comment_added'
  | 'published';

export interface Activity {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  userImage?: string;
  type: ActivityType;
  step?: number; // Which step this activity relates to (1-7)
  metadata?: Record<string, any>; // Additional context (e.g., old/new status)
  createdAt: string;
}

// Comment on a specific step or the whole session
export interface Comment {
  id: string;
  sessionId: string;
  step?: number; // null = session-level comment, 1-7 = step-specific
  userId: string;
  userName: string;
  userImage?: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

// Review request
export type ReviewStatus = 'pending' | 'approved' | 'changes_requested' | 'cancelled';

export interface ReviewRequest {
  id: string;
  sessionId: string;
  step?: number; // Which step to review (null = whole session)
  requesterId: string;
  requesterName: string;
  requesterImage?: string;
  reviewerId: string;
  reviewerName: string;
  reviewerImage?: string;
  note?: string; // Message from requester
  status: ReviewStatus;
  responseNote?: string; // Feedback from reviewer
  createdAt: string;
  respondedAt?: string;
}
