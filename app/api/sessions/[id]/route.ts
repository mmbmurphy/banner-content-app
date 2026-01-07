import { sql } from '@vercel/postgres';
import type { PipelineSession } from '@/types/session';

export const dynamic = 'force-dynamic';

// GET /api/sessions/[id] - Get single session
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { rows } = await sql`
      SELECT id, data, created_at, updated_at
      FROM sessions
      WHERE id = ${params.id}
    `;

    if (rows.length === 0) {
      return Response.json({
        error: 'Session not found',
        notFound: true
      }, { status: 404 });
    }

    const session = {
      ...rows[0].data,
      id: rows[0].id,
      createdAt: rows[0].created_at,
    };

    return Response.json({ session });
  } catch (error) {
    console.error('Error fetching session:', error);
    return Response.json({
      error: 'Failed to fetch session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT /api/sessions/[id] - Update session
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const updates: Partial<PipelineSession> = await request.json();

    // Get existing session first
    const { rows: existing } = await sql`
      SELECT data FROM sessions WHERE id = ${params.id}
    `;

    if (existing.length === 0) {
      return Response.json({
        error: 'Session not found',
        notFound: true
      }, { status: 404 });
    }

    // Merge updates with existing data
    const currentData = existing[0].data as PipelineSession;
    const updatedData = deepMerge(currentData, updates);

    await sql`
      UPDATE sessions
      SET data = ${JSON.stringify(updatedData)}, updated_at = NOW()
      WHERE id = ${params.id}
    `;

    return Response.json({ session: updatedData });
  } catch (error) {
    console.error('Error updating session:', error);
    return Response.json({
      error: 'Failed to update session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE /api/sessions/[id] - Delete session
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await sql`DELETE FROM sessions WHERE id = ${params.id}`;
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    return Response.json({
      error: 'Failed to delete session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Deep merge helper function
function deepMerge(target: PipelineSession, source: Partial<PipelineSession>): PipelineSession {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const k = key as keyof PipelineSession;
      const sourceValue = source[k];
      const targetValue = target[k];

      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result as any)[k] = { ...targetValue, ...sourceValue };
      } else if (sourceValue !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result as any)[k] = sourceValue;
      }
    }
  }

  return result;
}
