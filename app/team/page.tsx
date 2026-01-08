'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { TeamRole } from '@/types/team';

interface Team {
  id: string;
  name: string;
  slug: string;
  role: TeamRole;
  memberCount: number;
  createdAt: string;
}

interface PendingInvite {
  id: string;
  teamId: string;
  teamName: string;
  role: TeamRole;
  expiresAt: string;
}

interface TeamMember {
  id: string;
  userId: string;
  role: TeamRole;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
}

interface TeamInvite {
  id: string;
  email: string;
  role: TeamRole;
  createdAt: string;
  expiresAt: string;
}

export default function TeamPage() {
  const { data: session, status } = useSession();
  const [teams, setTeams] = useState<Team[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [teamDetails, setTeamDetails] = useState<{
    team: Team;
    members: TeamMember[];
    invites: TeamInvite[];
    currentUserRole: TeamRole;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create team modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('member');
  const [inviting, setInviting] = useState(false);

  // Load teams
  useEffect(() => {
    if (status === 'authenticated') {
      loadTeams();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status]);

  // Load team details when selected
  useEffect(() => {
    if (selectedTeam) {
      loadTeamDetails(selectedTeam);
    } else {
      setTeamDetails(null);
    }
  }, [selectedTeam]);

  async function loadTeams() {
    try {
      const res = await fetch('/api/teams');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTeams(data.teams || []);
      setPendingInvites(data.pendingInvites || []);

      // Auto-select first team
      if (data.teams?.length > 0 && !selectedTeam) {
        setSelectedTeam(data.teams[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  }

  async function loadTeamDetails(teamId: string) {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTeamDetails(data);
    } catch (err) {
      console.error('Error loading team details:', err);
    }
  }

  async function createTeam() {
    if (!newTeamName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setTeams([data.team, ...teams]);
      setSelectedTeam(data.team.id);
      setShowCreateModal(false);
      setNewTeamName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setCreating(false);
    }
  }

  async function acceptInvite(inviteId: string) {
    try {
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Reload teams
      loadTeams();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
    }
  }

  async function sendInvite() {
    if (!inviteEmail.trim() || !selectedTeam) return;

    setInviting(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeam}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Reload team details
      loadTeamDetails(selectedTeam);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('member');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  }

  async function cancelInvite(inviteId: string) {
    if (!selectedTeam) return;

    try {
      const res = await fetch(`/api/teams/${selectedTeam}/invites?inviteId=${inviteId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      loadTeamDetails(selectedTeam);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel invite');
    }
  }

  async function updateMemberRole(memberId: string, role: TeamRole) {
    if (!selectedTeam) return;

    try {
      const res = await fetch(`/api/teams/${selectedTeam}/members`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, role }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      loadTeamDetails(selectedTeam);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update member');
    }
  }

  async function removeMember(memberId: string) {
    if (!selectedTeam || !confirm('Are you sure you want to remove this member?')) return;

    try {
      const res = await fetch(`/api/teams/${selectedTeam}/members?memberId=${memberId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.leftTeam) {
        // User left the team, reload teams list
        loadTeams();
        setSelectedTeam(null);
      } else {
        loadTeamDetails(selectedTeam);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="p-8">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h1 className="text-xl font-semibold mb-4">Sign in to manage your team</h1>
          <Link
            href="/login"
            className="inline-block px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-opacity-90"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand-primary">Team Management</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-opacity-90 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Team
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h2 className="font-semibold text-blue-800 mb-3">Pending Invitations</h2>
          <div className="space-y-2">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between bg-white p-3 rounded border border-blue-200"
              >
                <div>
                  <span className="font-medium">{invite.teamName}</span>
                  <span className="text-gray-500 text-sm ml-2">as {invite.role}</span>
                </div>
                <button
                  onClick={() => acceptInvite(invite.id)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Accept
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teams List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold">Your Teams</h2>
            </div>
            {teams.length === 0 ? (
              <div className="p-4 text-gray-500 text-center">
                <p>No teams yet</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-2 text-brand-accent hover:underline"
                >
                  Create your first team
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeam(team.id)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition ${
                      selectedTeam === team.id ? 'bg-blue-50 border-l-4 border-brand-accent' : ''
                    }`}
                  >
                    <div className="font-medium">{team.name}</div>
                    <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                      <span className="capitalize">{team.role}</span>
                      <span>-</span>
                      <span>{team.memberCount} member{team.memberCount !== 1 ? 's' : ''}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Team Details */}
        <div className="lg:col-span-2">
          {teamDetails ? (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-lg">{teamDetails.team.name}</h2>
                  <p className="text-sm text-gray-500">
                    You are {teamDetails.currentUserRole === 'owner' ? 'the owner' : `a ${teamDetails.currentUserRole}`}
                  </p>
                </div>
                {(teamDetails.currentUserRole === 'owner' || teamDetails.currentUserRole === 'admin') && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="px-3 py-1.5 bg-brand-accent text-white text-sm rounded hover:bg-opacity-90 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Invite Member
                  </button>
                )}
              </div>

              {/* Members */}
              <div className="p-4">
                <h3 className="font-medium mb-3">Members ({teamDetails.members.length})</h3>
                <div className="space-y-2">
                  {teamDetails.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {member.user.image ? (
                          <img
                            src={member.user.image}
                            alt={member.user.name || ''}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-brand-accent text-white flex items-center justify-center text-sm font-medium">
                            {member.user.name?.[0] || member.user.email[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium">
                            {member.user.name || member.user.email}
                          </div>
                          <div className="text-sm text-gray-500">{member.user.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {teamDetails.currentUserRole === 'owner' && member.role !== 'owner' ? (
                          <select
                            value={member.role}
                            onChange={(e) => updateMemberRole(member.id, e.target.value as TeamRole)}
                            className="text-sm border rounded px-2 py-1"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span className={`text-sm px-2 py-1 rounded ${
                            member.role === 'owner' ? 'bg-purple-100 text-purple-700' :
                            member.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {member.role}
                          </span>
                        )}
                        {(teamDetails.currentUserRole === 'owner' && member.role !== 'owner') ||
                         (member.userId === session?.user?.id) ? (
                          <button
                            onClick={() => removeMember(member.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title={member.userId === session?.user?.id ? 'Leave team' : 'Remove member'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending Invites for this team */}
              {teamDetails.invites.length > 0 && (
                <div className="p-4 border-t border-gray-200">
                  <h3 className="font-medium mb-3">Pending Invites ({teamDetails.invites.length})</h3>
                  <div className="space-y-2">
                    {teamDetails.invites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg"
                      >
                        <div>
                          <div className="font-medium">{invite.email}</div>
                          <div className="text-sm text-gray-500">
                            Invited as {invite.role} - expires {new Date(invite.expiresAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={() => cancelInvite(invite.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : teams.length > 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Select a team to view details
            </div>
          ) : null}
        </div>
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Create a Team</h2>
            <input
              type="text"
              placeholder="Team name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-brand-accent"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewTeamName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={createTeam}
                disabled={creating || !newTeamName.trim()}
                className="px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-opacity-90 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Invite Team Member</h2>
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-brand-accent"
              autoFocus
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as TeamRole)}
              className="w-full px-4 py-2 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-brand-accent"
            >
              <option value="member">Member - Can view and create content</option>
              <option value="admin">Admin - Can also manage members</option>
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                  setInviteRole('member');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={sendInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-opacity-90 disabled:opacity-50"
              >
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
