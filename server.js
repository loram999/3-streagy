require("dotenv").config();
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");

const app = express();

// ─── Middleware ────────────────────────────────────────────────
app.use(express.json());

// Static files (index.html, app.html, style files etc.)
app.use(express.static(path.join(__dirname)));

// ─── Routes ─────────────────────────────────────────────────────

// Root route → serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// App route → serve app.html
app.get("/app.html", (req, res) => {
  res.sendFile(path.join(__dirname, "app.html"));
});

// ─── AI API Endpoint ────────────────────────────────────────────

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a Pick 3 lottery strategy advisor. You help players analyze digit patterns, recommend numbers, and tune filters to maximize coverage while staying within budget.
Be concise and practical. Format responses with clear sections using ▶ headers. Use bullet points. Keep total response under 300 words.`;

app.post("/api/ai", async (req, res) => {
  const { type, data } = req.body;

  if (!type || !data) {
    return res.status(400).json({ error: "Missing type or data" });
  }

  let userPrompt;

  if (type === "pattern") {
    userPrompt = `PATTERN ANALYSIS REQUEST
Past draws provided: ${data.draws}
Key digits identified: ${data.keyDigits.join(", ") || "none"}

Analyze these draws for:
1. Hot digits (appearing most frequently)
2. Cold digits (overdue)
3. Position tendencies (which digits fall in positions 1,2,3)
4. Pair/combo trends
5. Sum range trend
Provide actionable insights for next draw selection.`;
  } 
  else if (type === "recommend") {
    userPrompt = `NUMBER RECOMMENDATION REQUEST
Current filtered pool size: ${data.poolSize} straight numbers
Key digits: ${data.keyDigits.join(", ")}
Active filters: ${JSON.stringify(data.filters)}
Sum range: ${data.sumMin}–${data.sumMax}
Sample numbers from pool: ${data.sample.join(", ")}

From this filtered pool, recommend the TOP 10–15 highest-probability straight plays.
Explain why each pick is strong (digit frequency, position logic, sum value).
List as: NUMBER — reason`;
  } 
  else if (type === "autofilter") {
    userPrompt = `AUTO-FILTER TUNING REQUEST
Key digits: ${data.keyDigits.join(", ")}
Current pool size: ${data.poolSize} straight numbers (goal: under 100)
Current filters active: ${JSON.stringify(data.filters)}
Current sum range: ${data.sumMin}–${data.sumMax}
Budget: $${data.budget}

Recommend specific filter adjustments to get the pool under 100 numbers while keeping the most likely winners.
Be specific: which filters to toggle on/off, what sum range to set. Estimate resulting pool size.`;
  } 
  else {
    return res.status(400).json({ error: "Unknown type" });
  }

  try {
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const message = await stream.finalMessage();
    const text = message.content.find((b) => b.type === "text")?.text || "";

    res.json({ result: text });
  } catch (err) {
    console.error("AI error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Catch-all: if no route matches, serve index.html ────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ─── Start Server ──────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Pick3 server running on http://localhost:${PORT}`);
});