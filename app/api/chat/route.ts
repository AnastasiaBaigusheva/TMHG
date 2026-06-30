import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  SYSTEM_PROMPT,
  DEFAULT_MODEL,
  MAX_USER_MESSAGE_LENGTH,
} from "@/lib/anthropic";

export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: NextRequest) {
  let body: { messages?: ChatMessage[] };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Некорректный JSON в запросе." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const messages = body.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "Поле messages обязательно и не может быть пустым." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Валидация сообщений: непустые, в пределах лимита длины
  for (const m of messages) {
    if (!m || typeof m.content !== "string" || m.content.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Пустые сообщения не допускаются." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (m.content.length > MAX_USER_MESSAGE_LENGTH) {
      return new Response(
        JSON.stringify({
          error: `Сообщение слишком длинное. Максимум ${MAX_USER_MESSAGE_LENGTH} символов.`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "ANTHROPIC_API_KEY не задан на сервере. Проверьте .env.local.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Модель берется из env ANTHROPIC_MODEL, иначе используется DEFAULT_MODEL
  // (поменять дефолт можно в lib/anthropic.ts)
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const client = new Anthropic({ apiKey });

  // Специальный случай: первая загрузка /chat присылает технический маркер
  // __INIT__, чтобы ассистент сам начал диалог первым сообщением.
  const isInit = messages.length === 1 && messages[0].content === "__INIT__";

  const apiMessages = isInit
    ? [
        {
          role: "user" as const,
          content:
            "Начни игру. Поприветствуй меня, кратко объясни правила и ограничения (это не терапия, не диагностика, не замена психолога), и попроси меня сформулировать личный запрос.",
        },
      ]
    : messages.map((m) => ({ role: m.role, content: m.content }));

  try {
    const stream = await client.messages.stream({
      model,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          stream.on("text", (text) => {
            controller.enqueue(encoder.encode(text));
          });
          stream.on("error", (err) => {
            console.error("Anthropic stream error:", err);
            controller.error(err);
          });
          await stream.finalMessage();
          controller.close();
        } catch (err) {
          console.error("Streaming failed:", err);
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("Anthropic API error:", err);
    return new Response(
      JSON.stringify({
        error: "Не удалось получить ответ от ИИ. Попробуйте еще раз чуть позже.",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
