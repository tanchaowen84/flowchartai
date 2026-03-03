import { canUserUseAI, recordAIUsage } from '@/lib/ai-usage';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import OpenAI from 'openai';

// Define the shape of the expected response
interface DiagramData {
  center: {
    label: string;
    icon: string;
  };
  satellites: Array<{
    label: string;
    icon: string;
  }>;
}

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({
          error: 'Authentication required',
          message: 'Please sign in to use AI-powered visual generation.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const usageCheck = await canUserUseAI(session.user.id);
    if (!usageCheck.canUse) {
      return new Response(
        JSON.stringify({
          error: 'Usage limit exceeded',
          message: `You have reached your AI usage limit. ${usageCheck.remainingUsage} of ${usageCheck.limit} requests remaining.`,
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { topic } = await req.json();

    if (!topic) {
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'FlowViz Architect',
      },
    });

    const systemPrompt = `Analyze the given topic and create a structural integration diagram. 
Identify one central entity (the hub) and 4 to 8 satellites. Return icon keywords.
Return valid JSON ONLY. It must strictly match the following format without any markdown wrappers or codeblocks:
{
  "center": {
    "label": "string",
    "icon": "string"
  },
  "satellites": [
    {
      "label": "string",
      "icon": "string"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Topic: ${topic}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const rawContent = completion.choices[0]?.message?.content;
    
    if (!rawContent) {
      throw new Error('Model returned empty response');
    }

    // Try to parse out code blocks if the model wrapped the JSON
    const extractJson = (content: string) => {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
      return match ? match[1].trim() : content.trim();
    };

    const jsonString = extractJson(rawContent);
    const parsedData: DiagramData = JSON.parse(jsonString);

    // Record the usage securely
    await recordAIUsage(session.user.id, 'flowchart_generation', {
      tokensUsed: 0,
      model: 'google/gemini-2.5-flash',
      success: true,
      metadata: { mode: 'flowviz' }
    });

    return new Response(JSON.stringify(parsedData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error: any) {
    console.error('FlowViz API Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Generation failed', 
        message: error.message || 'Unknown error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
