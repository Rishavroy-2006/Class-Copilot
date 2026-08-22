const { classifyMessage } = require('./classifier');

async function run() {
  const msgs = [
    "@103561123877025 what is economics?",
    "What is economics @103561123877025",
    "what is economics ? @103561123877025"
  ];
  for (const m of msgs) {
    const res = await classifyMessage(m, {});
    console.log(`"${m}" -> ${res.category} (via ${res.method})`);
  }
}
run();
