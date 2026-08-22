const { classifyMessage } = require('./classifier');

async function run() {
  const testCases = [
    // 1. NOISE (Greetings, short replies)
    { text: "hello", msg: {}, expected: "NOISE" },
    { text: "ok", msg: {}, expected: "NOISE" },
    { text: "thanks", msg: {}, expected: "NOISE" },
    
    // 1. NOISE (System & Emojis & Absence)
    { text: "message was deleted", msg: {}, expected: "NOISE" },
    { text: "👍", msg: {}, expected: "NOISE" },
    { text: "sorry ma'm won't attend", msg: {}, expected: "NOISE" },
    
    // 1.5. QUESTION
    { text: "what is economics?", msg: {}, expected: "QUESTION" },
    { text: "where can i find the syllabus", msg: {}, expected: "QUESTION" },
    { text: "can someone share the notes", msg: {}, expected: "QUESTION" },
    
    // 2. Roll call / Name lists -> NOISE
    { text: "1. John\n2. Doe\n3. Smith\n4. Alice\n5. Bob\n6. Eve\n7. Charlie\n8. Dave", msg: {}, expected: "NOISE" },
    
    // 3. NOTE (Media attachment)
    { text: "", msg: { message: { documentMessage: {} } }, expected: "NOTE" },
    
    // 3. NOTE (Explicit URLs)
    { text: "https://drive.google.com/file/d/123", msg: {}, expected: "NOTE" },
    
    // PYQ
    { text: "/predict", msg: {}, expected: "PYQ" },
    { text: "probable questions for exam", msg: {}, expected: "PYQ" },
    
    // LLM Fallback triggers (Ambiguous text)
    // Needs a valid LLM key if it falls back to LLM, but we can just see if it uses LLM
    { text: "I think we should do this assignment by tomorrow", msg: {}, expected: "DEADLINE or NOTE or NOISE via llm" }
  ];

  for (const tc of testCases) {
    const res = await classifyMessage(tc.text, tc.msg);
    console.log(`[${res.category} via ${res.method}] => "${tc.text.replace(/\n/g, '\\n')}"`);
  }
}
run();
