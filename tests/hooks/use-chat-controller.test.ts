import { describe, expect, it } from "vitest";

import { parseChatSseEvent } from "@/hooks/use-chat-controller";

describe("chat SSE parsing", () => {
  it("parses provider-neutral SSE data events", () => {
    const event = parseChatSseEvent(
      'event: text_delta\ndata: {"type":"text_delta","text":"Applied filters."}'
    );

    expect(event).toEqual({
      type: "text_delta",
      text: "Applied filters."
    });
  });
});
