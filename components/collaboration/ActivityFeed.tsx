'use client';

import { useState, useEffect } from 'react';
import type { Activity, ActivityType } from '@/types/collaboration';
import { STEP_NAMES } from '@/lib/constants/dashboard';

interface ActivityFeedProps {
  sessionId: string;
  limit?: number;
}

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  session_created: '🆕',
  session_duplicated: '📋',
  step_completed: '✅',
  content_generated: '🤖',
  content_edited: '✏️',
  status_changed: '🔄',
  assignee_changed: '👤',
  review_requested: '👀',
  review_completed: '✓',
  comment_added: '💬',
  published: '🚀',
};

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  session_created: 'created this pipeline',
  session_duplicated: 'duplicated this pipeline',
  step_completed: 'completed',
  content_generated: 'generated content for',
  content_edited: 'edited',
  status_changed: 'changed status',
  assignee_changed: 'changed assignee',
  review_requested: 'requested review from',
  review_completed: 'completed review',
  comment_added: 'commented on',
  published: 'published',
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getActivityDescription(activity: Activity): string {
  const baseLabel = ACTIVITY_LABELS[activity.type] || activity.type;

  if (activity.step && activity.type !== 'review_requested') {
    const stepName = STEP_NAMES[activity.step - 1] || `Step ${activity.step}`;
    return `${baseLabel} ${stepName}`;
  }

  if (activity.type === 'review_requested' && activity.metadata?.reviewerName) {
    return `${baseLabel} ${activity.metadata.reviewerName}`;
  }

  if (activity.type === 'status_changed' && activity.metadata) {
    const { from, to } = activity.metadata;
    return `changed status from ${from || 'none'} to ${to}`;
  }

  if (activity.type === 'assignee_changed' && activity.metadata) {
    return `assigned to ${activity.metadata.assigneeName || 'Unassigned'}`;
  }

  return baseLabel;
}

export function ActivityFeed({ sessionId, limit = 20 }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchActivities() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/activity?limit=${limit}`);
        const data = await res.json();
        if (data.activities) {
          setActivities(data.activities);
        }
      } catch (err) {
        console.error('Error fetching activities:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchActivities();
  }, [sessionId, limit]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        No activity yet
      </div>
    );
  }

  const displayActivities = expanded ? activities : activities.slice(0, 5);

  return (
    <div className="space-y-3">
      {displayActivities.map((activity) => (
        <div key={activity.id} className="flex items-start gap-3 text-sm">
          <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
            {activity.userImage ? (
              <img
                src={activity.userImage}
                alt={activity.userName}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                {activity.userName?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-700">
              <span className="font-medium">{activity.userName}</span>
              {' '}
              <span className="text-gray-600">{getActivityDescription(activity)}</span>
            </p>
            {activity.metadata?.note && (
              <p className="text-gray-500 text-xs mt-0.5 italic">
                "{activity.metadata.note}"
              </p>
            )}
            {activity.metadata?.preview && activity.type === 'comment_added' && (
              <p className="text-gray-500 text-xs mt-0.5">
                "{activity.metadata.preview}..."
              </p>
            )}
          </div>
          <div className="flex-shrink-0 text-xs text-gray-400">
            {formatRelativeTime(activity.createdAt)}
          </div>
        </div>
      ))}

      {activities.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-brand-accent hover:underline"
        >
          {expanded ? 'Show less' : `Show ${activities.length - 5} more`}
        </button>
      )}
    </div>
  );
}
