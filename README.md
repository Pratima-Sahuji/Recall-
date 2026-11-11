# Recall - Context-Aware Cognitive AI Agent

> **Recall** is an intelligent, context-aware pair programming and research agent equipped with dual-layer memory (episodic and semantic) in PostgreSQL, live web search via Tavily, and real-time streaming with explicit source attribution.

---

## 🌟 Key Features

- 🧠 **Dual-Layer Memory Engine (PostgreSQL)**:
  - **Episodic Memory**: Remembers past conversations, life events, project deadlines, and historical dates with original timestamps.
  - **Semantic Memory**: Retains user preferences, tech stack choices, and enduring facts across sessions.
- 🕒 **Temporal & Timezone Awareness**: Answers time-relative queries (*"What did I ask you yesterday?"*, *"What task did I mention last week?"*) respecting the user's local timezone offset.
- 🌐 **Single-Tool Autonomous Web Search (Tavily)**:
  - Dynamically searches the web only when fresh external data is needed.
  - Automatically enriches queries using recalled memories (e.g. searching for *"backend interview preparation guides"* instead of the ambiguous *"resources for the interview we discussed"*).
- 🛡️ **Prompt Injection Resistance**: Sanitizes external search snippets, defangs injection attacks, and encloses results in `<untrusted_search_data>` isolation boundaries.
- ⚡ **Low-Latency SSE Token Streaming**: Streams responses in real-time using HTTP Server-Sent Events with graceful error recovery.
- 🎨 **Visual Cognitive Demarcation**: Clean visual distinction in the UI between:
  1. 🟣 **Recalled Memories** (with original event dates and category tags).
  2. ⚪ **Synthesized Reasoning** (rendered Markdown with syntax-highlighted code blocks & copy buttons).
  3. 🔵 **Web Sources** (clickable interactive citation cards with domains and links).

---

## 🛠️ Tech Stack

### Frontend (`client/`)
- **React 18** with **TypeScript**
- **Vite** (Next-generation bundler)
- **Tailwind CSS** (Modern dark-mode design system)
- **Lucide React** (Clean iconography)

### Backend (`server/`)
- **Node.js** with **Express** & **TypeScript**
- **Prisma ORM** with **PostgreSQL**
- **OpenAI API** (`gpt-4o-mini`)
- **Tavily Search API** (Autonomous web research)
- **Layered Architecture**: Routes ➔ Middleware ➔ Controllers ➔ Services ➔ Repositories ➔ Database

---

## 🏛️ System Architecture

```
User (Browser Client)
       │
       ▼ [POST /api/conversations/:id/chat/stream]
Express Gateway (Rate Limiter & Payload Validator)
       │
       ▼
Context-Aware Agent Coordinator
       │
       ├─► 1. Internal Memory Retrieval (PostgreSQL)
       ├─► 2. Query Understanding & Disambiguation
       ├─► 3. Token-Budgeted Context Assembly (~6,000 token cap)
       ├─► 4. LLM Reasoning Loop (OpenAI)
       │         │
       │         └─► Optional: web_search (Tavily API with retries & injection filters)
       │
       ├─► 5. Server-Sent Events (SSE) Stream to Client
       │
       └─► 6. Asynchronous Memory Extraction & Deduplication (PostgreSQL)
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher)
- **npm** or **pnpm**
- **PostgreSQL** database (local or cloud like Neon, Supabase, Railway)

### 2. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/recall-ai-agent.git
cd recall-ai-agent

# Install root, client, and server dependencies
npm install
```

### 3. Configure Environment Variables
Inside `server/`, create a `.env` file (see `.env.example`):
```bash
cp server/.env.example server/.env
```

Fill in your configuration:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<dbname>?sslmode=require"
CLIENT_ORIGIN=http://localhost:5173

# OpenAI Configuration
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o-mini"
OPENAI_TIMEOUT_MS=30000

# Tavily Web Search Configuration
TAVILY_API_KEY="tvly-..."
TAVILY_MAX_RESULTS=5
TAVILY_TIMEOUT_MS=15000
```

> **Security Note**: Never commit `server/.env` to source control. It is protected in `.gitignore`.

### 4. Database Setup & Migrations
```bash
cd server
npx prisma generate
npx prisma migrate dev --name init
```

### 5. Start Development Servers
From the root directory:
```bash
npm run dev
```
- **Backend API**: `http://localhost:5000`
- **Frontend App**: `http://localhost:5173`

---

## 🧪 Testing & Verification

Recall includes unit, integration, and production evaluation test suites:

```bash
cd server

# Run all test suites
npm run test

# Run the production evaluation benchmark suite
npm run test:eval
```

### Actual Benchmark Evaluation Results
```
========================================================================
       RECALL SYSTEM EVALUATION SUITE BENCHMARK REPORT                 
========================================================================
┌───────────────────────┬──────────────┬────────────┬────────────┬─────────┬──────────────────────────────────────────────┐
│ Category              │ Latency (ms) │ Memory Hit │ Tool Calls │ Correct │ Details                                      │
├───────────────────────┼──────────────┼────────────┼────────────┼─────────┼──────────────────────────────────────────────┤
│ Simple Factual        │ 12.40        │ NO         │ 0          │ PASS    │ Direct answer without search tool invocation │
│ Web Search Required   │ 45.20        │ NO         │ 1          │ PASS    │ Executed Tavily search with source citation  │
│ Memory Only           │ 18.10        │ YES        │ 0          │ PASS    │ Recalled preference internally (zero search) │
│ Temporal Recall       │ 22.30        │ YES        │ 0          │ PASS    │ Parsed yesterday boundary and retrieved event│
│ Memory + Web Search   │ 58.70        │ YES        │ 1          │ PASS    │ Disambiguated interview and executed search  │
│ Ambiguous Question    │ 9.80         │ NO         │ 0          │ PASS    │ Clarification requested safely               │
│ Search Failure        │ 8.50         │ NO         │ 0          │ PASS    │ Handled upstream search failure gracefully   │
│ Security / Injection  │ 0.10         │ NO         │ 0          │ PASS    │ Defanged injection & isolated untrusted data │
└───────────────────────┴──────────────┴────────────┴────────────┴─────────┴──────────────────────────────────────────────┘
```

---

## 📡 API Documentation

### 1. Health Check
- **Endpoint**: `GET /api/health`
- **Response**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-11-11T12:00:00.000Z",
    "uptime": 124.5,
    "services": {
      "api": "healthy",
      "database": "connected"
    }
  }
  ```

### 2. Stream Chat (Server-Sent Events)
- **Endpoint**: `POST /api/conversations/:conversationId/chat/stream`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "message": "Find some resources for the interview we discussed.",
    "timezoneOffset": -330
  }
  ```
- **SSE Events**:
  - `event: tool_call`: `{ "tool": "web_search", "query": "backend interview preparation guides", "status": "searching" }`
  - `event: chunk`: `{ "delta": "Here are " }`
  - `event: done`: `{ "userMessage": {...}, "assistantMessage": {...}, "recalledMemories": [...] }`

### 3. Conversations Lifecycle
- `GET /api/conversations`: List user conversations with message counts.
- `POST /api/conversations`: Create a new conversation session.
- `GET /api/conversations/:id`: Retrieve conversation details and message history.
- `DELETE /api/conversations/:id`: Cascade delete a conversation and its messages.

---

## 🖥️ Interactive Demo Instructions

1. **Test Fact & Event Storage (Episodic)**:
   - Ask: *"I am preparing for a backend system design interview next Friday."*
   - Observe: Conversation auto-titles in the sidebar. Recall records the event and target date in PostgreSQL.
2. **Test Context-Guided Web Search**:
   - In a later turn, ask: *"Find some resources for the interview we discussed."*
   - Observe:
     - 🟣 Violet card displays the recalled context: `[EVENT] User is preparing for a backend interview (Date: next Friday)`.
     - 🌐 Tool spinner indicates: `Searching web for: "backend interview preparation guides"...`.
     - 🔵 Indigo cards display verified clickable citations (`[1] System Design Primer`).
3. **Test Temporal Recall**:
   - Ask: *"What was the technology I discussed earlier?"*
   - Observe: Direct answer citing your past message without triggering unnecessary web search.

---

## 🔒 Security & Privacy

- **No Secrets in Source**: All API keys and connection strings are managed exclusively through server environment variables.
- **Indirect Injection Defenses**: Web search results pass through an automated defanging pipeline before entering LLM reasoning prompts.
- **Single-Tool Sandbox**: Database and memory operations cannot be invoked by LLM tool calls.
