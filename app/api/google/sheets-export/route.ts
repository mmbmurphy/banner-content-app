import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Check for Google service account credentials
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!serviceAccountJson || !spreadsheetId) {
      // Return mock success for demo purposes
      console.log('Google Sheets export (mock):', data);
      return NextResponse.json({
        success: true,
        message: 'Export simulated (Google credentials not configured)',
        sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId || 'demo'}/edit`,
      });
    }

    // Parse service account credentials
    const credentials = JSON.parse(serviceAccountJson);

    // Get access token using service account
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: await createJWT(credentials),
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get access token');
    }

    const { access_token } = await tokenResponse.json();

    // Prepare row data
    const today = new Date().toISOString().split('T')[0];
    const rowData = [
      today,
      data.slug || '',
      data.title || '',
      data.webflowUrl || '',
      data.linkedinPosts || 0,
      data.carouselSlides || 0,
      data.pdfGenerated ? 'Yes' : 'No',
      'Complete',
    ];

    // Append row to sheet
    const appendResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:H:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [rowData],
        }),
      }
    );

    if (!appendResponse.ok) {
      const error = await appendResponse.text();
      throw new Error(`Failed to append to sheet: ${error}`);
    }

    return NextResponse.json({
      success: true,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    });
  } catch (error) {
    console.error('Error exporting to Sheets:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}

// Helper function to create JWT for Google authentication
async function createJWT(credentials: { client_email: string; private_key: string }) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(payload));
  const message = `${headerB64}.${payloadB64}`;

  // Import private key
  const pemContents = credentials.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(message)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${message}.${signatureB64}`;
}
