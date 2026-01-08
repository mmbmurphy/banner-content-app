import type { WorkflowStatus } from '@/types/session';

export const WORKFLOW_STATUSES: { value: WorkflowStatus; label: string; color: string }[] = [
  { value: 'backlog', label: 'Backlog', color: 'bg-gray-100 text-gray-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  { value: 'review', label: 'Review', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'published', label: 'Published', color: 'bg-green-100 text-green-700' },
  { value: 'archived', label: 'Archived', color: 'bg-gray-200 text-gray-500' },
];

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-600' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-700' },
];

export const CONTENT_TYPES = [
  { value: 'blog', label: 'Blog Post', color: 'bg-purple-100 text-purple-700' },
  { value: 'guide', label: 'Guide', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'case-study', label: 'Case Study', color: 'bg-teal-100 text-teal-700' },
  { value: 'tutorial', label: 'Tutorial', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'thought-leadership', label: 'Thought Leadership', color: 'bg-rose-100 text-rose-700' },
  { value: 'news', label: 'News/Update', color: 'bg-amber-100 text-amber-700' },
  { value: 'listicle', label: 'Listicle', color: 'bg-lime-100 text-lime-700' },
  { value: 'comparison', label: 'Comparison', color: 'bg-orange-100 text-orange-700' },
];

export const STEP_NAMES = [
  'Topic',
  'Blog Draft',
  'LinkedIn Posts',
  'Carousel',
  'PDF',
  'Export',
  'Queue',
];

export const STEP_SLUGS = [
  'topic',
  'blog',
  'linkedin',
  'carousel',
  'pdf',
  'export',
  'queue',
];

export type ViewMode = 'cards' | 'table' | 'kanban' | 'calendar';
