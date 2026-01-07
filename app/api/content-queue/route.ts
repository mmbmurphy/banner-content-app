import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Try to read from the existing pipeline's content queue
    const queuePath = path.join(
      process.cwd(),
      '..',
      'banner-content-pipeline',
      'config',
      'content-queue.csv'
    );

    if (!fs.existsSync(queuePath)) {
      return NextResponse.json({ items: [] });
    }

    const content = fs.readFileSync(queuePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return NextResponse.json({ items: [] });
    }

    // Parse CSV (simple parser)
    const headers = lines[0].split(',');
    const items = lines.slice(1).map((line, index) => {
      const values = line.split(',');
      return {
        id: index + 1,
        title: values[1]?.replace(/"/g, '') || '',
        pillar: values[2]?.replace(/"/g, '') || '',
        funnel: values[3]?.replace(/"/g, '') || '',
        keyword: values[4]?.replace(/"/g, '') || '',
        persona: values[5]?.replace(/"/g, '') || '',
        priority: parseInt(values[6]) || 1,
        status: values[7]?.replace(/"/g, '') || 'queued',
        slug: values[8]?.replace(/"/g, '') || '',
      };
    }).filter(item => item.status === 'queued' && item.title);

    return NextResponse.json({ items: items.slice(0, 50) });
  } catch (error) {
    console.error('Error loading queue:', error);
    return NextResponse.json({ items: [] });
  }
}
