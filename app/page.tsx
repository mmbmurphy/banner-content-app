'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePipelineStore } from '@/lib/store/session-store';
import type { PipelineSession, SessionUser } from '@/types/session';
import { ViewMode, STEP_NAMES, STEP_SLUGS, WORKFLOW_STATUSES, CONTENT_TYPES } from '@/lib/constants/dashboard';
import { TableView } from '@/components/dashboard/TableView';
import { KanbanView } from '@/components/dashboard/KanbanView';
import { CalendarView } from '@/components/dashboard/CalendarView';
import { useBrandKitStore } from '@/lib/store/brand-kit-store';

export default function Dashboard() {
  const router = useRouter();
  const {
    createSession,
    getTeamSessions,
    deleteSession,
    duplicateSession,
    updateSession,
    fetchSessionsFromApi,
    setCurrentTeamId,
    isLoading,
  } = usePipelineStore();

  const { brandKit, fetchBrandKit } = useBrandKitStore();

  // Use team content types if available, otherwise use defaults
  const contentTypes = (brandKit.contentTypes && brandKit.contentTypes.length > 0)
    ? brandKit.contentTypes.map(ct => ({ value: ct.value, label: ct.label, color: ct.color }))
    : CONTENT_TYPES;

  const [sessions, setSessions] = useState<PipelineSession[]>([]);
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterContentType, setFilterContentType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<SessionUser[]>([]);

  const refreshSessions = useCallback(() => {
    setSessions(getTeamSessions());
  }, [getTeamSessions]);

  useEffect(() => {
    setMounted(true);

    // Load saved view preference
    const savedView = localStorage.getItem('dashboard-view-mode');
    if (savedView && ['cards', 'table', 'kanban', 'calendar'].includes(savedView)) {
      setViewMode(savedView as ViewMode);
    }

    async function init() {
      let teamId: string | null = null;

      // First get user's team to establish context
      try {
        const teamsRes = await fetch('/api/teams');
        const teamsData = await teamsRes.json();

        if (teamsData.teams && teamsData.teams.length > 0) {
          teamId = teamsData.teams[0].id;
          setCurrentTeamId(teamId);
        }
      } catch (err) {
        console.error('Error fetching teams:', err);
      }

      // Fetch sessions with explicit team ID (avoids race condition)
      await fetchSessionsFromApi(teamId);
      refreshSessions();

      // Fetch brand kit for team content types
      fetchBrandKit();

      // Fetch team members for filter
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

    init();
  }, [fetchSessionsFromApi, refreshSessions, setCurrentTeamId, fetchBrandKit]);

  // Save view preference
  const handleViewChange = (view: ViewMode) => {
    setViewMode(view);
    localStorage.setItem('dashboard-view-mode', view);
  };

  const handleNewPipeline = async () => {
    const sessionId = await createSession();
    router.push(`/pipeline/${sessionId}/step-1-topic`);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this session?')) {
      deleteSession(id);
      refreshSessions();
    }
  };

  const handleDuplicate = async (id: string) => {
    const newId = await duplicateSession(id);
    if (newId) {
      refreshSessions();
      router.push(`/pipeline/${newId}/step-1-topic`);
    }
  };

  const handleUpdateSession = (id: string, updates: Partial<PipelineSession>) => {
    updateSession(id, updates);
    refreshSessions();
  };

  // Filter sessions
  const filteredSessions = sessions.filter(s => {
    const statusMatch = filterStatus === 'all' || (s.workflowStatus || 'backlog') === filterStatus;
    const assigneeMatch = filterAssignee === 'all' ||
      (filterAssignee === 'unassigned' && !s.assignedTo) ||
      s.assignedTo === filterAssignee;
    const contentTypeMatch = filterContentType === 'all' ||
      (filterContentType === 'unset' && !s.contentType) ||
      s.contentType === filterContentType;
    const searchMatch = !searchQuery.trim() ||
      (s.topic.title?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.topic.slug?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.notes?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
    return statusMatch && assigneeMatch && contentTypeMatch && searchMatch;
  });

  if (!mounted) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded w-48 mb-8"></div>
          <div className="h-24 bg-gray-200 rounded mb-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      {isLoading && (
        <div className="flex items-center gap-2 text-gray-500 mb-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-accent"></div>
          <span className="text-sm">Syncing sessions...</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-brand-primary">Dashboard</h2>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white w-48 focus:ring-2 focus:ring-brand-accent focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Content Type Filter */}
          <select
            value={filterContentType}
            onChange={(e) => setFilterContentType(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="all">All Types</option>
            <option value="unset">Unset ({sessions.filter(s => !s.contentType).length})</option>
            {contentTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label} ({sessions.filter(s => s.contentType === type.value).length})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="all">All Status ({sessions.length})</option>
            {WORKFLOW_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label} ({sessions.filter(s => (s.workflowStatus || 'backlog') === status.value).length})
              </option>
            ))}
          </select>

          {/* Assignee Filter */}
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="all">All Assignees</option>
            <option value="unassigned">Unassigned ({sessions.filter(s => !s.assignedTo).length})</option>
            {teamMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name || member.email.split('@')[0]} ({sessions.filter(s => s.assignedTo === member.id).length})
              </option>
            ))}
          </select>

          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleViewChange('cards')}
              className={`p-2 rounded-md transition ${viewMode === 'cards' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
              title="Card View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => handleViewChange('table')}
              className={`p-2 rounded-md transition ${viewMode === 'table' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
              title="Table View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => handleViewChange('kanban')}
              className={`p-2 rounded-md transition ${viewMode === 'kanban' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
              title="Kanban View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </button>
            <button
              onClick={() => handleViewChange('calendar')}
              className={`p-2 rounded-md transition ${viewMode === 'calendar' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
              title="Calendar View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          <button
            onClick={handleNewPipeline}
            className="bg-brand-accent text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            New Pipeline
          </button>
        </div>
      </div>

      {/* Content */}
      {sessions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-gray-400 text-5xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No pipelines yet
          </h3>
          <p className="text-gray-500 mb-6">
            Start by creating a new content pipeline
          </p>
          <button
            onClick={handleNewPipeline}
            className="bg-brand-accent text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition"
          >
            Create First Pipeline
          </button>
        </div>
      ) : (
        <>
          {/* Card View */}
          {viewMode === 'cards' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                {filterStatus === 'all' ? 'All Sessions' : WORKFLOW_STATUSES.find(s => s.value === filterStatus)?.label} ({filteredSessions.length})
              </h3>
              {filteredSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/pipeline/${session.id}/step-${session.currentStep}-${STEP_SLUGS[session.currentStep - 1]}`}
                  className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-accent hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-semibold text-brand-primary">
                          {session.topic.title || session.topic.slug || 'Untitled'}
                        </h4>
                        {/* Content Type Tag */}
                        <div className="relative group">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            className={`text-xs px-2 py-0.5 rounded-full cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-brand-accent transition ${
                              session.contentType
                                ? contentTypes.find(t => t.value === session.contentType)?.color
                                : 'bg-gray-100 text-gray-500 border border-dashed border-gray-300'
                            }`}
                          >
                            {session.contentType
                              ? contentTypes.find(t => t.value === session.contentType)?.label
                              : '+ Type'}
                          </button>
                          {/* Dropdown - pt-2 creates invisible bridge to prevent gap */}
                          <div className="absolute left-0 top-full pt-2 hidden group-hover:block min-w-[160px] z-20">
                            <div className="bg-white border border-gray-200 rounded-lg shadow-lg">
                            {contentTypes.map((type) => (
                              <button
                                key={type.value}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleUpdateSession(session.id, { contentType: type.value as PipelineSession['contentType'] });
                                }}
                                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg flex items-center gap-2 ${
                                  session.contentType === type.value ? 'bg-gray-50 font-medium' : ''
                                }`}
                              >
                                <span className={`w-2 h-2 rounded-full ${type.color.split(' ')[0]}`}></span>
                                {type.label}
                              </button>
                            ))}
                            {session.contentType && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleUpdateSession(session.id, { contentType: undefined });
                                }}
                                className="w-full text-left px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 border-t border-gray-100 rounded-b-lg"
                              >
                                Clear type
                              </button>
                            )}
                            </div>
                          </div>
                        </div>
                        {session.workflowStatus && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            WORKFLOW_STATUSES.find(s => s.value === session.workflowStatus)?.color
                          }`}>
                            {WORKFLOW_STATUSES.find(s => s.value === session.workflowStatus)?.label}
                          </span>
                        )}
                        {session.priority && session.priority !== 'medium' && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            session.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {session.priority}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Step {session.currentStep} of 7 — {STEP_NAMES[session.currentStep - 1]}
                      </p>
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <p className="text-xs text-gray-400">
                          Created {new Date(session.createdAt).toLocaleDateString()}
                        </p>
                        {session.assignee ? (
                          <div className="flex items-center gap-1" title={`Assigned to ${session.assignee.name || session.assignee.email}`}>
                            <span className="text-xs text-gray-400">Assigned:</span>
                            {session.assignee.image ? (
                              <img
                                src={session.assignee.image}
                                alt={session.assignee.name || ''}
                                className="w-5 h-5 rounded-full ring-2 ring-brand-accent"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-brand-accent text-white flex items-center justify-center text-[10px] font-medium">
                                {session.assignee.name?.[0] || session.assignee.email[0].toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs text-brand-accent font-medium">
                              {session.assignee.name || session.assignee.email.split('@')[0]}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Unassigned</span>
                        )}
                        {session.creator && (
                          <div className="flex items-center gap-1" title={`Created by ${session.creator.name || session.creator.email}`}>
                            <span className="text-xs text-gray-400">by</span>
                            {session.creator.image ? (
                              <img
                                src={session.creator.image}
                                alt={session.creator.name || ''}
                                className="w-4 h-4 rounded-full opacity-60"
                              />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-[10px] font-medium">
                                {session.creator.name?.[0] || session.creator.email[0].toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs text-gray-500">
                              {session.creator.name || session.creator.email.split('@')[0]}
                            </span>
                          </div>
                        )}
                        {session.targetDate && (
                          <p className="text-xs text-purple-600">
                            Target: {new Date(session.targetDate).toLocaleDateString()}
                          </p>
                        )}
                        {session.completedDate && (
                          <p className="text-xs text-green-600">
                            Completed: {new Date(session.completedDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {session.notes && (
                        <p className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded mt-2 line-clamp-1">
                          {session.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <div className="flex gap-1">
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
                          />
                        ))}
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDuplicate(session.id);
                        }}
                        className="text-gray-400 hover:text-brand-accent p-1"
                        title="Duplicate session"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(session.id);
                        }}
                        className="text-gray-400 hover:text-red-500 p-1"
                        title="Delete session"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <TableView
              sessions={filteredSessions}
              onUpdateSession={handleUpdateSession}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              contentTypes={contentTypes}
            />
          )}

          {/* Kanban View */}
          {viewMode === 'kanban' && (
            <KanbanView
              sessions={sessions} // Use all sessions for kanban (filter doesn't make sense)
              onUpdateSession={handleUpdateSession}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          )}

          {/* Calendar View */}
          {viewMode === 'calendar' && (
            <CalendarView
              sessions={filteredSessions}
              onUpdateSession={handleUpdateSession}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          )}
        </>
      )}
    </div>
  );
}
