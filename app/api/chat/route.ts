import Anthropic from "@anthropic-ai/sdk";
import type { MessageCreateParamsStreaming } from "@anthropic-ai/sdk/resources/messages/messages";

import { getChatResponse } from "@/lib/server/chat-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return getChatResponse(request, {
    createStream: async (params) => {
      const apiKey = process.env.ANTHROPIC_API_KEY;

      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY is not configured.");
      }

      const anthropic = new Anthropic({
        apiKey
      });

      return anthropic.messages.create(params as MessageCreateParamsStreaming);
    }
  });
}
