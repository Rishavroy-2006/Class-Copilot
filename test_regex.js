const QUESTION_PATTERN = /(\?(\s*@\d+)*$|^(what|why|who|where|when|how|can|could|will|would|does|do|is|are|whose)\b|^any(one|body)\b|^any(one|body)\s+ha(s|ve)\b|^has\s+anyone\b|^can\s+(someone|anyone)\b|^pls\b|^please\b.*\b(send|share|give)\b|\b(need|send|share|provide)\s+(notes|pdf|link|material|assignment|syllabus)\b|where\s+can\s+i|roll\s+no)/i;

const msgs = [
  "@103561123877025 what is economics?",
  "What is economics @103561123877025",
  "what is economics ? @103561123877025"
];

for (const m of msgs) {
  const cleanText = m.replace(/@\d+\s*/g, '').trim();
  console.log(m, "=>", cleanText, "=>", QUESTION_PATTERN.test(cleanText));
}
