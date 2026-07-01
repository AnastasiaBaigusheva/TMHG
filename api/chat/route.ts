import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  SYSTEM_PROMPT,
  DEFAULT_MODEL,
  MAX_USER_MESSAGE_LENGTH,
  GameState,
  INITIAL_GAME_STATE,
} from "@/lib/anthropic";

export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Минимальный fallback: если модель вернула невалидный JSON
function fallbackState(gs: GameState): GameState {
  return { ...gs, turnCount: gs.turnCount + 1 };
}

// Строгая валидация и нормализация GameState из ответа модели
function parseGameState(raw: unknown, previous: GameState): GameState {
  if (!raw || typeof raw !== "object") return fallbackState(previous);
  const r = raw as Record<string, unknown>;

  const VALID_STAGES = ["intro","request_clarification","contract","exploration","integration","finished"];
  const VALID_ZONES = ["request","values","fears","defenses","relationships","patterns","resources","insights"];

  const stage = VALID_STAGES.includes(r.stage as string)
    ? (r.stage as GameState["stage"])
    : previous.stage;

  // Stage never goes backward
  const stageOrder = VALID_STAGES;
  const prevIdx = stageOrder.indexOf(previous.stage);
  const newIdx = stageOrder.indexOf(stage);
  const safeStage = newIdx >= prevIdx ? stage : previous.stage;

  const userRequest =
    typeof r.userRequest === "string" && r.userRequest.trim()
      ? r.userRequest.trim()
      : previous.userRequest;

  const confirmedRequest =
    typeof r.confirmedRequest === "boolean" ? r.confirmedRequest : previous.confirmedRequest;

  const currentZone = VALID_ZONES.includes(r.currentZone as string)
    ? (r.currentZone as GameState["currentZone"])
    : previous.currentZone;

  const incomingZones = Array.isArray(r.openedZones)
    ? (r.openedZones as string[]).filter((z) => VALID_ZONES.includes(z)) as GameState["openedZones"]
    : [];
  // openedZones only grows, never shrinks
  const merged = Array.from(new Set([...previous.openedZones, ...incomingZones])) as GameState["openedZones"];

  const askedQuestions = Array.isArray(r.askedQuestions)
    ? (r.askedQuestions as string[]).filter((q) => typeof q === "string")
    : previous.askedQuestions;

  const keyInsights = Array.isArray(r.keyInsights)
    ? (r.keyInsights as string[]).filter((i) => typeof i === "string")
    : previous.keyInsights;

  const intensity = [1,2,3,4,5].includes(r.emotionalIntensity as number)
    ? (r.emotionalIntensity as GameState["emotionalIntensity"])
    : previous.emotionalIntensity;

  const turnCount = typeof r.turnCount === "number" ? r.turnCount : previous.turnCount + 1;
  const loopWarnings = typeof r.loopWarnings === "number" ? r.loopWarnings : previous.loopWarnings;
  const safetyFlag = typeof r.safetyFlag === "boolean" ? r.safetyFlag : previous.safetyFlag;
  const lastAssistantIntent = typeof r.lastAssistantIntent === "string" ? r.lastAssistantIntent : null;
  const nextStep = typeof r.nextStep === "string" ? r.nextStep : null;

  return {
    stage: safeStage,
    userRequest,
    confirmedRequest,
    currentZone,
    openedZones: merged,
    askedQuestions,
    keyInsights,
    emotionalIntensity: intensity,
    turnCount,
    loopWarnings,
    safetyFlag,
    lastAssistantIntent,
    nextStep,
  };
}

export async function POST(req: NextRequest) {
  let body: { messages?: ChatMessage[]; gameState?: GameState };

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Некорректный JSON в запросе." }, 400);
  }

  const messages = body.messages;
  const incomingState: GameState = body.gameState ?? INITIAL_GAME_STATE;

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: "Поле messages обязательно и не может быть пустым." }, 400);
  }

  for (const m of messages) {
    if (!m || typeof m.content !== "string" || m.content.trim().length === 0) {
      return jsonResponse({ error: "Пустые сообщения не допускаются." }, 400);
    }
    if (m.content.length > MAX_USER_MESSAGE_LENGTH) {
      return jsonResponse(
        { error: `Сообщение слишком длинное. Максимум ${MAX_USER_MESSAGE_LENGTH} символов.` },
        400
      );
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "ANTHROPIC_API_KEY не задан на сервере." }, 500);
  }

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  // Init: inject gameState as context so the model knows exactly where it is
  const isInit = messages.length === 1 && messages[0].content === "__INIT__";

  const stateContext = `\nТекущий GameState (используй для принятия решений, обнови в ответе):\n${JSON.stringify(incomingState, null, 2)}\n`;

  const apiMessages = isInit
    ? [
        {
          role: "user" as const,
          content:
            stateContext +
            "\nЭто первый ход. Напиши первое сообщение игры. Строго по формату: одно правило, без длинных объяснений, заверши вопросом о запросе пользователя. Верни JSON.",
        },
      ]
    : messages.map((m, i) => ({
        role: m.role,
        // Inject state context into the last user message
        content:
          i === messages.length - 1 && m.role === "user"
            ? stateContext + "\nСообщение пользователя: " + m.content
            : m.content,
      }));

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    });

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // Parse JSON from model response
    let content = "";
    let gameState: GameState = fallbackState(incomingState);

    try {
      // Strip possible markdown fences just in case
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned);

      content = typeof parsed.userVisibleMessage === "string"
        ? parsed.userVisibleMessage
        : rawText;

      gameState = parseGameState(parsed.updatedGameState, incomingState);
    } catch {
      // Fallback: return raw text, minimal state update
      console.warn("Model returned non-JSON, using fallback.");
      content = rawText;
      gameState = fallbackState(incomingState);
    }

    return jsonResponse({ content, gameState });
  } catch (err) {
    console.error("Anthropic API error:", err);
    return jsonResponse(
      { error: "Не удалось получить ответ от ИИ. Попробуйте ещё раз чуть позже." },
      502
    );
  }
}
