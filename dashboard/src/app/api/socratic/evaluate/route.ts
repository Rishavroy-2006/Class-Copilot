import { NextResponse } from 'next/server';
import { generateAnswer } from '@/lib/llmRouter';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { challengeId, defense } = await req.json();

    if (!challengeId || !defense) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch the challenge
    const { data: challengeData, error: challengeError } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challengeData) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const prompt = `
You are an expert Socratic tutor. You previously challenged a student on a concept, and they have provided a defense.

Concept: ${challengeData.concept}
Student's Initial Answer: ${challengeData.student_answer}
Your Challenge: ${challengeData.ai_challenge}
Student's Defense: ${defense}
Strictness Level: ${challengeData.strictness}

Evaluate their defense. Did they understand the concept?
Assign a mastery score from 0 to 100 based on their defense. Be honest but fair.
Provide a short feedback explaining your evaluation.

Return ONLY a JSON object with the following keys:
- "understood": boolean
- "mastery_score": integer (0-100)
- "evaluation": string (short feedback)
`;

    const result = await generateAnswer(prompt, true);
    let parsed;
    try {
      parsed = typeof result === 'string' ? JSON.parse(result) : result;
    } catch (e) {
      const match = result?.match(/```json\n([\s\S]*?)\n```/);
      if (match) parsed = JSON.parse(match[1]);
      else {
        parsed = {
          understood: false,
          mastery_score: 10,
          evaluation: "Failed to parse AI response. Please try defending your answer again."
        };
      }
    }

    if (defense.trim().length < 3) {
      parsed = {
        understood: false,
        mastery_score: 0,
        evaluation: "Your defense was too short or empty. Please provide a clear explanation to demonstrate your understanding."
      };
    }

    // Update the challenge row
    const { error: updateError } = await supabase
      .from('challenges')
      .update({
        student_defense: defense,
        understood: parsed.understood,
        mastery_score: parsed.mastery_score,
        evaluation: parsed.evaluation
      })
      .eq('id', challengeId);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return NextResponse.json({ error: 'Database update error' }, { status: 500 });
    }

    return NextResponse.json({
      understood: parsed.understood,
      mastery_score: parsed.mastery_score,
      evaluation: parsed.evaluation
    });
  } catch (error: any) {
    console.error('Evaluate Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
