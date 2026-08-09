# Class Copilot

> The first AI agent built for your entire class — plug into any WhatsApp group in under 60 seconds.

![Node.js](https://img.shields.io/badge/Node.js-Backend-green?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-Frontend-black?style=flat-square)
![Baileys](https://img.shields.io/badge/WhatsApp-Baileys-brightgreen?style=flat-square)
![Groq](https://img.shields.io/badge/Groq-Llama_3-orange?style=flat-square)
![Gemini](https://img.shields.io/badge/Gemini-Flash_Lite-blue?style=flat-square)
![Supabase](https://img.shields.io/badge/Supabase-pgvector-emerald?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-gray?style=flat-square)

Students can chat. They can share notes. They can panic about deadlines.

But they cannot organize it all — until now.

Class Copilot is a full-featured AI agent that gives your existing WhatsApp group the ability to autonomously capture notes, track deadlines, predict exam questions, and answer complex queries based on your class material. No new apps to download. No confusing onboarding. Just plug in and study smarter.

**demo:** _Coming soon — video demo in progress_

## How It Works

```mermaid
sequenceDiagram
    participant S as Student
    participant W as WhatsApp Group
    participant B as Baileys Bridge
    participant C as AI Classifier
    participant DB as Supabase
    participant R as LLM Router (Groq/Gemini)

    S->>W: Send message or PDF note
    W->>B: Capture incoming message
    B->>C: Classify (NOTE, DEADLINE, QUESTION, PYQ, NOISE)
    
    alt is QUESTION
        C->>R: Run Troll Shield guardrail
        R->>DB: Vector search for context
        DB-->>R: Return relevant class notes
        R-->>B: Generate highly accurate answer
        B-->>W: Reply directly in group
    else is NOTE
        C->>DB: Extract text from PDF & store in pgvector
    else is DEADLINE
        C->>B: Auto-schedule reminder via node-schedule
    else is PYQ
        C->>R: Concatenate past papers
        R->>DB: Predict high-probability topics
    end
```

## Architecture

```mermaid
graph TD
    subgraph Frontend Layer
        WA[WhatsApp Group]
        DASH[Next.js Web Dashboard]
    end

    subgraph Bridge Layer
        B[Baileys Socket]
        AUTH[Local Session Auth]
    end

    subgraph Routing Engine
        C[Message Classifier]
        NH[Note Handler]
        DH[Deadline Handler]
        QH[Question Handler]
        PH[PYQ Handler]
    end

    subgraph AI Layer
        TS[Prompt Guard Troll Shield]
        G8[Groq 8B Fast Extract]
        G70[Groq 70B Heavy Reasoning]
        GEM[Gemini 3.5 Flash Lite Fallback]
    end

    subgraph Storage Layer
        SUPA[Supabase PostgreSQL]
        VEC[pgvector Embeddings]
        CRON[node-schedule Reminders]
    end

    WA <--> B
    B <--> AUTH
    B --> C
    
    C --> NH
    C --> DH
    C --> QH
    C --> PH
    
    NH --> SUPA
    DH --> CRON
    PH --> SUPA
    DASH --> SUPA
    
    QH --> TS
    TS --> VEC
    VEC --> G70
    PH --> G70
    G70 --> B
```

## Installation

Class Copilot is lightweight and designed to run locally or on a cheap VPS. It consists of a backend bridge and a Next.js frontend dashboard.

```bash
# 1. Clone the repository
git clone https://github.com/Rishavroy-2006/Class-Copilot.git
cd class-copilot

# 2. Install backend dependencies
npm install

# 3. Setup environment variables
cp .env.example .env

# 4. Install dashboard dependencies
cd dashboard
npm install
```

To run the full stack, you will need two terminal windows:

Terminal 1 (Backend Bridge):
```bash
cd class-copilot
npm start
```

Terminal 2 (Web Dashboard):
```bash
cd class-copilot/dashboard
npm run dev
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GROQ_API_KEY` | Yes | — | For fast classification and heavy reasoning (`llama-3.3-70b-versatile`) |
| `GEMINI_API_KEY` | Yes | — | Triple-redundant fallback for massive contexts (`gemini-3.5-flash-lite`) |
| `SUPABASE_URL` | Yes | — | URL to your Supabase project |
| `SUPABASE_KEY` | Yes | — | `service_role` key to bypass RLS in the backend |
| `NEXT_PUBLIC_GROUP_ID` | No | `120363412429875166@g.us` | The specific WhatsApp Chat ID the dashboard should display data for |

## Core Features Reference

### 1. Smart Message Processing & Routing
- **Group-Only Guard**: Operates strictly in group chats (`@g.us`). Ignores DMs to preserve privacy.
- **Hybrid Classifier**: Uses regex rules to classify messages (`NOTE`, `DEADLINE`, `QUESTION`, `PYQ`, `NOISE`). Falls back to Groq (`llama-3.1-8b-instant`) for ambiguous text.
- **Summary Command**: Reply to any long message with "summarize" to generate concise bullet points.

### 2. Note Management & Embeddings
- **PDF & Document Parsing**: Detects attachments and extracts raw text using `pdf-parse`.
- **Subject Extraction**: Automatically predicts the academic subject of a note.
- **Vector Embeddings**: Uses `gemini-embedding-001` to generate 768-dimensional embeddings for semantic search and stores them in Supabase `pgvector`.

### 3. Automated Deadlines & Reminders
- **Date Extraction**: Identifies due dates and descriptions from chat messages.
- **Auto-Scheduling**: Schedules a 24-hour advance reminder via `node-schedule`.

### 4. RAG-Powered Q&A
- **Vector Search**: Uses pgvector `match_notes` RPC to find semantically relevant notes.
- **Contextual Generation**: Injects notes into the LLM prompt with strict anti-hallucination rules.

### 5. PYQ Predictor Engine
- **Pattern Recognition**: Upload past year question papers (PYQs) and the bot will store them by subject.
- **Topic Prediction**: Command the bot to predict an exam, and it will concatenate all past papers for that subject, routing them through the LLM to identify the highest-probability recurring topics.

### 6. Live Web Dashboard
- **Next.js Portal**: A gorgeous web interface built with React and Tailwind CSS.
- **Native Serving**: The original static landing page is natively integrated to serve on the root path, automatically linking users to their live class dashboard.

## Live Demo (How to Test)

1. Start the bridge using `npm start`.
2. Scan the QR code that appears in your terminal with your phone (WhatsApp -> Settings -> Linked Devices).
3. Send this exact message in your test group:
   > "Does anyone have the syllabus for CS101?"

What to expect:
1. The Baileys bridge intercepts the message.
2. The Classifier instantly identifies it as a `QUESTION`.
3. The Troll Shield verifies it is not a jailbreak attempt.
4. The system queries Supabase for any notes tagged `CS101 Syllabus`.
5. The LLM Router synthesizes an answer and replies directly in the chat within seconds.

## Security & Disclaimers

- **Group-Only Privacy** — The bot physically cannot read Direct Messages or Broadcasts. The global guardrail drops all non-group traffic at the socket level.
- **Troll Shield** — A dedicated 86M guardrail model intercepts all queries before they hit the expensive LLM.
- **Local Auth** — WhatsApp session tokens are stored locally in the `/auth` folder. They never touch the cloud.
- **Backend-Only Secrets** — Built as a strict Node.js backend. No React/Next.js frontend exposure vulnerabilities beyond the public group ID.
- **No Database Exposure** — Connects to Supabase exclusively via the secure `service_role` key on the backend.
- **Hackathon Disclosure:** This project uses an unofficial library (Baileys) to connect to WhatsApp rather than Meta's official Business API. Treat this as a demo-scale bridge.
- **Git Security:** Ensure all API keys are strictly stored in `.env`. Do not hardcode keys.

## Comparison Table

| Metric | Class Copilot | NotebookLM / Single-Player Tools | Traditional LMS (Canvas/Blackboard) |
|---|---|---|---|
| **Adoption Friction** | Zero (It is just WhatsApp) | High (Requires downloading or learning an app) | High (Clunky, requires separate login) |
| **Multiplayer** | Native — entire class shares one brain | No — built for solo study | Yes, but heavily siloed by professors |
| **Deadlines** | Pings you right where you chat | Manual entry required | Buried in a syllabus PDF |
| **Cost** | Virtually free (Groq/Gemini free tiers) | Paid tiers for heavy usage | Institution pays thousands |

## Roadmap

**Now**
- WhatsApp listener via Baileys
- Global Group-Only Privacy Guard
- Smart Regex + LLM message classifier
- RAG Q&A using Supabase pgvector
- Auto-deadline scheduling
- PYQ Predictor via concatenated RAG
- Next.js Web Dashboard for out-of-chat viewing
- Native Landing Page integration

**Next**
- **Voice Note Transcription:** Whisper API integration so the bot can summarize voice rambles.
- **Authentication:** Allowing individual students to log into the dashboard securely.

**Future**
- **Handwritten Notes:** Vision integration to read messy whiteboard photos.
- **Multi-Subject Routing:** Smarter partitioning for mega-groups covering multiple classes.

## Tech Stack & License

- **Language:** JavaScript (Node.js 18+), TypeScript (React/Next.js)
- **Bridge:** `@whiskeysockets/baileys`
- **Database:** Supabase (PostgreSQL + pgvector)
- **Primary LLM:** Groq (`llama-3.3-70b`, `llama-3.1-8b`, `prompt-guard`)
- **Fallback LLM:** Google Gemini (`gemini-3.5-flash-lite`)

This project is open-sourced under the MIT License — see [LICENSE](./LICENSE).
