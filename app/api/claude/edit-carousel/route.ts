import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { LayeredSlide } from '@/types/carousel-layers';
import type { BrandKit } from '@/types/brand';

// Initialize client - will use ANTHROPIC_API_KEY from env
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface EditCarouselRequest {
  command: string;
  slides: LayeredSlide[];
  currentSlideIndex: number;
  brandKit: BrandKit;
  context?: {
    topic?: string;
    hook?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: EditCarouselRequest = await request.json();
    const { command, slides, currentSlideIndex, brandKit, context } = body;

    if (!command || !slides) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Build brand context
    const brandColors = brandKit.colors.map(c => `${c.name}: ${c.hex}`).join(', ');
    const brandFonts = brandKit.fonts.map(f => f.name).join(', ');

    const systemPrompt = `You are a carousel slide editor assistant. You help users modify their LinkedIn carousel slides based on natural language commands.

You will receive:
1. The current slides data (JSON with layers)
2. A user command describing what changes they want
3. Brand kit information (colors, fonts)
4. The current slide index (0-based)

Your job is to interpret the command and return ONLY the modified slides JSON. Make smart, professional design choices.

BRAND COLORS: ${brandColors || 'Primary: #101828, Accent: #0082F3, Coral: #FF7469, White: #FFFFFF, Gray: #758696'}
BRAND FONTS: ${brandFonts || 'Inter'}

IMPORTANT RULES:
1. Return ONLY valid JSON - no explanation, no markdown
2. Preserve slide structure (id, slideNumber, slideType, layers array)
3. For text changes, update the "content" field in text layers
4. For color changes, update "color" in text style or "fill"/"color" in backgrounds/shapes
5. For size changes, update "fontSize" in text style or width/height in transform
6. For position changes, update x/y in transform
7. "current slide" refers to index ${currentSlideIndex}
8. Be conservative - only change what the user asks for
9. Keep text concise and impactful for carousel format

LAYER TYPES:
- background: { type: "background", backgroundType: "solid"|"gradient", color?: string, gradient?: {...} }
- text: { type: "text", transform: {x,y,width,height,zIndex}, content: string, style: {fontFamily,fontSize,fontWeight,color,textAlign} }
- shape: { type: "shape", transform: {...}, shapeType: "rectangle"|"circle"|"line", fill?: string }
- image: { type: "image", transform: {...}, imageUrl: string }`;

    const userMessage = `CURRENT SLIDES:
${JSON.stringify(slides, null, 2)}

TOPIC CONTEXT: ${context?.topic || 'General carousel content'}

USER COMMAND: ${command}

Return the complete modified slides array as JSON:`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [
        { role: 'user', content: userMessage }
      ],
      system: systemPrompt,
    });

    // Extract JSON from response
    const content = response.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Invalid response format' }, { status: 500 });
    }

    let updatedSlides: LayeredSlide[];
    try {
      // Try to parse the response as JSON
      let jsonText = content.text.trim();

      // Remove markdown code blocks if present
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      updatedSlides = JSON.parse(jsonText);

      // Validate it's an array
      if (!Array.isArray(updatedSlides)) {
        throw new Error('Response is not an array');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', content.text);
      return NextResponse.json({
        error: 'Failed to parse AI response',
        raw: content.text
      }, { status: 500 });
    }

    return NextResponse.json({
      slides: updatedSlides,
      message: 'Slides updated successfully'
    });

  } catch (error) {
    console.error('Error editing carousel:', error);

    // Provide more specific error messages
    let errorMessage = 'Failed to edit carousel';
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = 'API configuration error. Please contact support.';
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try a simpler command.';
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
