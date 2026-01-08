'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PipelineSession, WorkflowStatus } from '@/types/session';
import { WORKFLOW_STATUSES, PRIORITY_OPTIONS, STEP_NAMES, STEP_SLUGS } from '@/lib/constants/dashboard';

interface KanbanViewProps {
  sessions: PipelineSession[];
  onUpdateSession: (id: string, updates: Partial<PipelineSession>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function KanbanView({ sessions, onUpdateSession, onDelete, onDuplicate }: KanbanViewProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const getSessionsByStatus = (status: WorkflowStatus) => {
    return sessions.filter(s => (s.workflowStatus || 'backlog') === status);
  };

  const handleDragStart = (e: React.DragEvent, sessionId: string) => {
    setDraggedId(sessionId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: WorkflowStatus) => {
    e.preventDefault();
    if (draggedId) {
      onUpdateSession(draggedId, {
        workflowStatus: status,
        completedDate: status === 'published' ? new Date().toISOString() : undefined
      });
      setDraggedId(null);
    }
  };

  const getPriorityColor = (priority?: string) => {
    return PRIORITY_OPTIONS.find(p => p.value === priority)?.color || PRIORITY_OPTIONS[1].color;
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {WORKFLOW_STATUSES.filter(s => s.value !== 'archived').map((status) => (
        <div
          key={status.value}
          className="flex-shrink-0 w-72"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, status.value)}
        >
          {/* Column Header */}
          <div className={`px-3 py-2 rounded-t-lg ${status.color} flex justify-between items-center`}>
            <span className="font-medium text-sm">{status.label}</span>
            <span className="text-xs opacity-70">
              {getSessionsByStatus(status.value).length}
            </span>
          </div>

          {/* Column Body */}
          <div className="bg-gray-50 rounded-b-lg p-2 min-h-[400px] space-y-2">
            {getSessionsByStatus(status.value).map((session) => (
              <div
                key={session.id}
                draggable
                onDragStart={(e) => handleDragStart(e, session.id)}
                className={`bg-white rounded-lg border border-gray-200 p-3 cursor-move hover:shadow-md transition ${
                  draggedId === session.id ? 'opacity-50' : ''
                }`}
              >
                {/* Card Header */}
                <div className="flex justify-between items-start mb-2">
                  <Link
                    href={`/pipeline/${session.id}/step-${session.currentStep}-${STEP_SLUGS[session.currentStep - 1]}`}
                    className="font-medium text-sm text-brand-primary hover:text-brand-accent line-clamp-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {session.topic.title || session.topic.slug || 'Untitled'}
                  </Link>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => onDuplicate(session.id)}
                      className="p-1 text-gray-400 hover:text-brand-accent"
                      title="Duplicate"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(session.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                      title="Delete"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex gap-0.5">
                    {STEP_NAMES.map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${
                          i < session.currentStep
                            ? 'bg-brand-green'
                            : i === session.currentStep - 1
                            ? 'bg-brand-accent'
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">
                    Step {session.currentStep}/7
                  </span>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-2 text-xs">
                  {session.priority && (
                    <span className={`px-2 py-0.5 rounded-full ${getPriorityColor(session.priority)}`}>
                      {session.priority}
                    </span>
                  )}
                  {session.targetDate && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      {new Date(session.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>

                {/* Assignee & Creator */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                  {session.assignee ? (
                    <div className="flex items-center gap-1" title={`Assigned to ${session.assignee.name || session.assignee.email}`}>
                      {session.assignee.image ? (
                        <img
                          src={session.assignee.image}
                          alt={session.assignee.name || ''}
                          className="w-5 h-5 rounded-full ring-2 ring-brand-accent"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-brand-accent text-white flex items-center justify-center text-[9px] font-medium ring-2 ring-brand-accent ring-offset-1">
                          {session.assignee.name?.[0] || session.assignee.email[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-dashed border-gray-300" title="Unassigned" />
                  )}
                  {session.creator && (
                    <div className="flex items-center gap-1" title={`Created by ${session.creator.name || session.creator.email}`}>
                      <span className="text-[9px] text-gray-400">by</span>
                      {session.creator.image ? (
                        <img
                          src={session.creator.image}
                          alt={session.creator.name || ''}
                          className="w-4 h-4 rounded-full opacity-60"
                        />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-[8px] font-medium">
                          {session.creator.name?.[0] || session.creator.email[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Notes Preview */}
                {session.notes && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2 bg-yellow-50 px-2 py-1 rounded">
                    {session.notes}
                  </p>
                )}
              </div>
            ))}

            {/* Empty State */}
            {getSessionsByStatus(status.value).length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                Drop items here
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Archived Column (collapsed) */}
      {getSessionsByStatus('archived').length > 0 && (
        <div
          className="flex-shrink-0 w-48"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'archived')}
        >
          <div className="px-3 py-2 rounded-t-lg bg-gray-200 text-gray-500 flex justify-between items-center">
            <span className="font-medium text-sm">Archived</span>
            <span className="text-xs opacity-70">
              {getSessionsByStatus('archived').length}
            </span>
          </div>
          <div className="bg-gray-100 rounded-b-lg p-2 min-h-[100px] space-y-1">
            {getSessionsByStatus('archived').map((session) => (
              <div
                key={session.id}
                draggable
                onDragStart={(e) => handleDragStart(e, session.id)}
                className="bg-white rounded px-2 py-1 text-xs text-gray-500 truncate cursor-move hover:bg-gray-50"
              >
                {session.topic.title || session.topic.slug || 'Untitled'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
