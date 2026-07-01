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

type ChatMessage = { role: "user" | "assistant"; content: string };

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fallbackState(gs: GameState): GameState {
  return { ...gs, turnCount: gs.turnCount + 1 };
}

// Вытаскиваем JSON из ответа модели.
// Ключевой приём: берём срез от первой { до последней } — это надёжно работает
// даже если модель добавила текст до/после или обернула в ```json```.
function extractJson(raw: string): unknown {
  // Стратегия 1 (самая надёжная): первая { до последней }
  const firstBrace = raw.indexOf("{");
  const lastBrace  = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(raw.slice(firstBrace, lastBrace + 1)); } catch { /* continue */ }
  }

  // Стратегия 2: убрать все ```json и ``` и попробовать распарсить
  const stripped = raw.replace(/```(?:json)?/gi, "").trim();
  try { return JSON.parse(stripped); } catch { /* continue */ }

  return null;
}

function parseGameState(raw: unknown, previous: GameState): GameState {
  if (!raw || typeof raw !== "object") return fallbackState(previous);
  const r = raw as Record<string, unknown>;

  const VALID_STAGES = ["intro","request_clarification","contract","exploration","integration","finished"];
  const VALID_ZONES  = ["request","fear","illusion","control","choice","boundaries","resources","insight"];

  const stage = VALID_STAGES.includes(r.stage as string)
    ? (r.stage as GameState["stage"]) : previous.stage;

  // Stage никогда не идёт назад
  const stageOrder = VALID_STAGES;
  const newIdx  = stageOrder.indexOf(stage);
  const prevIdx = stageOrder.indexOf(previous.stage);
  const safeStage = newIdx >= prevIdx ? stage : previous.stage;

  const userRequest =
    typeof r.userRequest === "string" && r.userRequest.trim()
      ? r.userRequest.trim() : previous.userRequest;

  const confirmedRequest =
    typeof r.confirmedRequest === "boolean" ? r.confirmedRequest : previous.confirmedRequest;

  const currentZone = VALID_ZONES.includes(r.currentZone as string)
    ? (r.currentZone as GameState["currentZone"]) : previous.currentZone;

  // currentZone двигается только вперёд по маршруту
  const zoneOrder = VALID_ZONES;
  const newZoneIdx  = currentZone ? zoneOrder.indexOf(currentZone) : -1;
  const prevZoneIdx = previous.currentZone ? zoneOrder.indexOf(previous.currentZone) : -1;
  const safeZone = newZoneIdx >= prevZoneIdx ? currentZone : previous.currentZone;

  const incomingZones = Array.isArray(r.openedZones)
    ? (r.openedZones as string[]).filter((z) => VALID_ZONES.includes(z)) as GameState["openedZones"]
    : [];
  const merged = Array.from(new Set([...previous.openedZones, ...incomingZones])) as GameState["openedZones"];

  const askedQuestions = Array.isArray(r.askedQuestions)
    ? (r.askedQuestions as string[]).filter((q) => typeof q === "string")
    : previous.askedQuestions;

  const keyInsights = Array.isArray(r.keyInsights)
    ? (r.keyInsights as string[]).filter((i) => typeof i === "string")
    : previous.keyInsights;

  const intensity = [1,2,3,4,5].includes(r.emotionalIntensity as number)
    ? (r.emotionalIntensity as GameState["emotionalIntensity"]) : previous.emotionalIntensity;

  const turnCount    = typeof r.turnCount    === "number" ? r.turnCount    : previous.turnCount + 1;
  const loopWarnings = typeof r.loopWarnings === "number" ? r.loopWarnings : previous.loopWarnings;
  const safetyFlag   = typeof r.safetyFlag   === "boolean" ? r.safetyFlag  : previous.safetyFlag;
  const lastAssistantIntent = typeof r.lastAssistantIntent === "string" ? r.lastAssistantIntent : null;
  const nextStep = typeof r.nextStep === "string" ? r.nextStep : null;

  return {
    stage: safeStage,
    userRequest,
    confirmedRequest,
    currentZone: safeZone,
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
    // Лимит длины — только для сообщений пользователя, не для ассистента
    if (m.role === "user" && m.content.length > MAX_USER_MESSAGE_LENGTH) {
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

  const isInit = messages.length === 1 && messages[0].content === "__INIT__";

  // Компактный снимок состояния для передачи модели
  const stateSnapshot = JSON.stringify({
    stage:            incomingState.stage,
    currentZone:      incomingState.currentZone,
    openedZones:      incomingState.openedZones,
    confirmedRequest: incomingState.confirmedRequest,
    userRequest:      incomingState.userRequest,
    turnCount:        incomingState.turnCount,
    loopWarnings:     incomingState.loopWarnings,
    lastInsights:     incomingState.keyInsights.slice(-3),
    lastQuestions:    incomingState.askedQuestions.slice(-5),
  });

  const stateContext = `[GAME_STATE: ${stateSnapshot}]\n\n`;

  const apiMessages = isInit
    ? [{
        role: "user" as const,
        content:
          stateContext +
          "Первый ход. Напиши ТОЛЬКО JSON. Начни игру: коротко объясни одно правило («Не ври себе»), спроси с чем пользователь хочет разобраться. currentZone остаётся \"request\".",
      }]
    : messages.map((m, i) => ({
        role: m.role,
        content:
          i === messages.length - 1 && m.role === "user"
            ? stateContext + m.content
            : m.content,
      }));

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    });

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    let content = "";
    let gameState: GameState = fallbackState(incomingState);

    const parsed = extractJson(rawText);

    if (parsed && typeof parsed === "object") {
      const p = parsed as Record<string, unknown>;
      if (typeof p.userVisibleMessage === "string" && p.userVisibleMessage.trim()) {
        content   = p.userVisibleMessage.trim();
        gameState = parseGameState(p.updatedGameState, incomingState);
      } else {
        // Модель вернула JSON, но без нужного поля
        console.warn("JSON parsed but missing userVisibleMessage:", rawText.slice(0, 200));
        content   = rawText;
        gameState = fallbackState(incomingState);
      }
    } else {
      // JSON не найден вообще — показываем текст как есть
      console.warn("No JSON found in model response:", rawText.slice(0, 200));
      content   = rawText;
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
