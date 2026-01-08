'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { PipelineSession, WorkflowStatus, SessionUser } from '@/types/session';
import { WORKFLOW_STATUSES, PRIORITY_OPTIONS, STEP_NAMES, STEP_SLUGS, CONTENT_TYPES } from '@/lib/constants/dashboard';

interface ContentTypeOption {
  value: string;
  label: string;
  color: string;
}

interface TableViewProps {
  sessions: PipelineSession[];
  onUpdateSession: (id: string, updates: Partial<PipelineSession>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  contentTypes?: ContentTypeOption[];
}

type SortField = 'title' | 'type' | 'status' | 'targetDate' | 'createdAt' | 'priority' | 'assignee';
type SortDirection = 'asc' | 'desc';

export function TableView({ sessions, onUpdateSession, onDelete, onDuplicate, contentTypes: propContentTypes }: TableViewProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [teamMembers, setTeamMembers] = useState<SessionUser[]>([]);

  // Use passed content types or fall back to defaults
  const types = propContentTypes || CONTENT_TYPES;

  // Fetch team members on mount
  useEffect(() => {
    async function fetchMembers() {
      try {
        const res = await fetch('/api/teams/members');
        const data = await res.json();
        if (data.members) {
          setTeamMembers(data.members);
        }
      } catch (err) {
        console.error('Error fetching team members:', err);
      }
    }
    fetchMembers();
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    let aVal: string | number | undefined;
    let bVal: string | number | undefined;

    switch (sortField) {
      case 'title':
        aVal = a.topic.title || a.topic.slug || '';
        bVal = b.topic.title || b.topic.slug || '';
        break;
      case 'type':
        aVal = a.contentType || '';
        bVal = b.contentType || '';
        break;
      case 'status':
        aVal = a.workflowStatus || 'backlog';
        bVal = b.workflowStatus || 'backlog';
        break;
      case 'targetDate':
        aVal = a.targetDate || '';
        bVal = b.targetDate || '';
        break;
      case 'createdAt':
        aVal = a.createdAt;
        bVal = b.createdAt;
        break;
      case 'priority':
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        aVal = priorityOrder[a.priority || 'low'];
        bVal = priorityOrder[b.priority || 'low'];
        break;
      case 'assignee':
        aVal = a.assignee?.name || a.assignee?.email || '';
        bVal = b.assignee?.name || b.assignee?.email || '';
        break;
    }

    if (aVal === undefined) aVal = '';
    if (bVal === undefined) bVal = '';

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="ml-1 text-gray-400">
      {sortField === field ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  const handleAssigneeChange = (sessionId: string, userId: string) => {
    const member = teamMembers.find(m => m.id === userId);
    onUpdateSession(sessionId, {
      assignedTo: userId || undefined,
      assignee: member || undefined,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('title')}
              >
                Title <SortIcon field="title" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('type')}
              >
                Type <SortIcon field="type" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('status')}
              >
                Status <SortIcon field="status" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Progress
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('assignee')}
              >
                Assignee <SortIcon field="assignee" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('priority')}
              >
                Priority <SortIcon field="priority" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('targetDate')}
              >
                Target Date <SortIcon field="targetDate" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('createdAt')}
              >
                Created <SortIcon field="createdAt" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Created By
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedSessions.map((session) => (
              <tr key={session.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/pipeline/${session.id}/step-${session.currentStep}-${STEP_SLUGS[session.currentStep - 1]}`}
                    className="font-medium text-brand-primary hover:text-brand-accent"
                  >
                    {session.topic.title || session.topic.slug || 'Untitled'}
                  </Link>
                  {session.notes && (
                    <p className="text-xs text-gray-500 mt-1 truncate max-w-xs">{session.notes}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={session.contentType || ''}
                    onChange={(e) => onUpdateSession(session.id, {
                      contentType: e.target.value as PipelineSession['contentType'] || undefined
                    })}
                    className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${
                      session.contentType
                        ? types.find(t => t.value === session.contentType)?.color
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <option value="">No type</option>
                    {types.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={session.workflowStatus || 'backlog'}
                    onChange={(e) => onUpdateSession(session.id, {
                      workflowStatus: e.target.value as WorkflowStatus,
                      completedDate: e.target.value === 'published' ? new Date().toISOString() : session.completedDate
                    })}
                    className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${
                      WORKFLOW_STATUSES.find(s => s.value === (session.workflowStatus || 'backlog'))?.color
                    }`}
                  >
                    {WORKFLOW_STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {STEP_NAMES.map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${
                            i < session.currentStep
                              ? 'bg-brand-green'
                              : i === session.currentStep - 1
                              ? 'bg-brand-accent'
                              : 'bg-gray-200'
                          }`}
                          title={STEP_NAMES[i]}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">
                      {session.currentStep}/7
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={session.assignedTo || ''}
                    onChange={(e) => handleAssigneeChange(session.id, e.target.value)}
                    className="text-xs px-2 py-1 border border-gray-200 rounded cursor-pointer hover:border-gray-300 min-w-[120px]"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name || member.email.split('@')[0]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={session.priority || 'medium'}
                    onChange={(e) => onUpdateSession(session.id, { priority: e.target.value as 'low' | 'medium' | 'high' })}
                    className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${
                      PRIORITY_OPTIONS.find(p => p.value === (session.priority || 'medium'))?.color
                    }`}
                  >
                    {PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="date"
                    value={session.targetDate ? session.targetDate.split('T')[0] : ''}
                    onChange={(e) => onUpdateSession(session.id, { targetDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                    className="text-xs px-2 py-1 border border-gray-200 rounded cursor-pointer hover:border-gray-300"
                  />
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(session.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {session.creator ? (
                    <div className="flex items-center gap-2">
                      {session.creator.image ? (
                        <img
                          src={session.creator.image}
                          alt={session.creator.name || ''}
                          className="w-5 h-5 rounded-full"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-brand-accent text-white flex items-center justify-center text-[10px] font-medium">
                          {session.creator.name?.[0] || session.creator.email[0].toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs text-gray-600">
                        {session.creator.name || session.creator.email.split('@')[0]}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => onDuplicate(session.id)}
                      className="p-1 text-gray-400 hover:text-brand-accent"
                      title="Duplicate"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(session.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sortedSessions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No sessions found
        </div>
      )}
    </div>
  );
}
