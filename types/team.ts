export type TeamRole = 'owner' | 'admin' | 'member';

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string; // User ID
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: string;
  // Populated fields
  user?: User;
}

export interface TeamInvite {
  id: string;
  teamId: string;
  email: string;
  role: TeamRole;
  invitedBy: string; // User ID
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  // Populated fields
  team?: Team;
  inviter?: User;
}

export interface TeamWithMembers extends Team {
  members: TeamMember[];
  invites: TeamInvite[];
  memberCount: number;
}

// For the current user's context
export interface UserTeamContext {
  currentTeam: Team | null;
  teams: Team[];
  role: TeamRole | null;
}
