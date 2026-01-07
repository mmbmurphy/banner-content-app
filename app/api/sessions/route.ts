import { sql } from '@vercel/postgres';
import type { PipelineSession } from '@/types/session';

export const dynamic = 'force-dynamic';

// GET /api/sessions - List all sessions
export async function GET() {
  try {
    const { rows } = await sql`
      SELECT id, data, created_at, updated_at
      FROM sessions
      ORDER BY updated_at DESC
      LIMIT 50
    `;

    const sessions = rows.map(row => ({
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
    }));

    return Response.json({ sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);

    // Check if table doesn't exist
    if (error instanceof Error && error.message.includes('relation "sessions" does not exist')) {
      return Response.json({
        sessions: [],
        needsInit: true,
        error: 'Database not initialized. Visit /api/sessions/init to set up.'
      });
    }

    return Response.json({
      error: 'Failed to fetch sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/sessions - Create new session
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = body.id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const emptySession: PipelineSession = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      currentStep: 1,
      status: 'in_progress',
      topic: { source: 'custom', slug: '', title: '' },
      blog: {
        frontmatter: {},
        content: '',
        htmlContent: '',
        status: 'draft'
      },
      linkedin: {
        posts: [],
        carousel: {},
        regenerationCount: 0
      },
      carousel: {
        slides: [],
        imageUrls: [],
        status: 'pending'
      },
      pdf: { status: 'pending' },
      export: {
        sheetsExported: false,
        driveUploaded: false
      },
      queue: {
        postsQueued: [],
        status: 'pending'
      },
    };

    await sql`
      INSERT INTO sessions (id, data, created_at, updated_at)
      VALUES (${sessionId}, ${JSON.stringify(emptySession)}, NOW(), NOW())
    `;

    return Response.json({ session: emptySession });
  } catch (error) {
    console.error('Error creating session:', error);
    return Response.json({
      error: 'Failed to create session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
