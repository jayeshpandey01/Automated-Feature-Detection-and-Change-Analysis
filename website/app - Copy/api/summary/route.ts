import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { date, content } = await request.json();

    const prompt = `
    You are an expert glaciologist analyzing satellite data for GlacioWatch.
    Please provide a brief, professional summary (around 3-4 sentences) interpreting the following daily data.
    Highlight the significance of the numbers.
    
    Data Date: ${date}
    Data Content: ${JSON.stringify(content)}
    `;

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.2:1b',
        prompt: prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json({ summary: data.response });
  } catch (error) {
    console.error("Failed to generate summary:", error);
    return NextResponse.json({ error: 'Failed to generate summary. Ensure Ollama is running.' }, { status: 500 });
  }
}
