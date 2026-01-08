import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

// GET /api/versions/[id] - Get a specific version
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { rows } = await sql`
      SELECT id, session_id, step, content, prompt_used, created_at, created_by
      FROM content_versions
      WHERE id = ${params.id}::uuid
    `;

    if (rows.length === 0) {
      return Response.json({ error: 'Version not found' }, { status: 404 });
    }

    return Response.json({ version: rows[0] });
  } catch (error) {
    console.error('Error fetching version:', error);
    return Response.json({
      error: 'Failed to fetch version',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE /api/versions/[id] - Delete a specific version
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await sql`DELETE FROM content_versions WHERE id = ${params.id}::uuid`;
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting version:', error);
    return Response.json({
      error: 'Failed to delete version',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
