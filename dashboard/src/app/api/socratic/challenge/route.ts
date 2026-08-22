import { NextResponse } from 'next/server';
import { generateAnswer } from '@/lib/llmRouter';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { studentId, concept, answer, sourceNoteId, strictness = 'medium' } = await req.json();

    if (!studentId || !concept || !answer) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Look up the prior score
    const { data: priorData, error: priorError } = await supabase
      .from('challenges')
      .select('mastery_score')
      .eq('student_id', studentId)
      .eq('concept', concept)
      .order('created_at', { ascending: false })
      .limit(1);

    const priorScore = priorData && priorData.length > 0 ? priorData[0].mastery_score : null;

    let promptContext = "The student is attempting this concept for the first time. Generate a standard Socratic question to test their initial understanding.";
    if (priorScore !== null) {
      if (priorScore < 40) {
        promptContext = `The student previously struggled with this concept (Prior Mastery Score: ${priorScore}/100). Generate a highly scaffolded, foundational Socratic question. Break the concept down and ask about a simpler, core component to help them build basic intuition.`;
      } else if (priorScore > 80) {
        promptContext = `The student has demonstrated strong mastery of this concept (Prior Mastery Score: ${priorScore}/100). Generate a rigorous, edge-case Socratic challenge. Push their understanding by asking them to compare it to a complex alternative or apply it to a difficult, non-standard scenario.`;
      } else {
        promptContext = `The student has an average understanding of this concept (Prior Mastery Score: ${priorScore}/100). Generate a standard Socratic question to test and deepen their understanding.`;
      }
    }

    const prompt = `
You are an expert Socratic tutor. A student has submitted an answer about a specific concept.
Concept: ${concept}
Student's Answer: ${answer}
Strictness Level: ${strictness}

${promptContext}

Your goal is to challenge their reasoning, point out any flaws (if they exist, but don't just give the answer), and ask a thought-provoking question that makes them defend or reconsider their answer.
Return the result as JSON with a single key "challenge" containing your question.
`;

    const result = await generateAnswer(prompt, true);
    let parsed;
    try {
      parsed = typeof result === 'string' ? JSON.parse(result) : result;
    } catch (e) {
      // attempt to extract json from markdown blocks
      const match = result?.match(/```json\n([\s\S]*?)\n```/);
      if (match) parsed = JSON.parse(match[1]);
      else throw e;
    }

    const aiChallenge = parsed.challenge;

    // Create a new challenge row
    const { data, error } = await supabase
      .from('challenges')
      .insert({
        student_id: studentId,
        concept,
        source_note_id: sourceNoteId || null,
        student_answer: answer,
        ai_challenge: aiChallenge,
        strictness,
        prior_score: priorScore
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ challenge: aiChallenge, challengeId: data.id });
  } catch (error: any) {
    console.error('Challenge Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
