import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/chat/route";
import { getChatResponse, writeChatSseStream, type RawChatStreamEvent } from "@/lib/server/chat-route";
import type { ChatSseEvent, ChatUiContext } from "@/lib/types";

const ORIGINAL_ENV = process.env;

describe("chat route", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns 400 for invalid requests", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [] })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      error: "Invalid chat request."
    });
  });

  it("returns sanitized 500 when Anthropic config is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(validChatRequest("show me large cap funds"));
    const body = await response.json();

    consoleSpy.mockRestore();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      ok: false,
      error: "Unable to start chat right now."
    });
  });

  it("streams text deltas and complete tool calls without exposing Anthropic event names", async () => {
    const response = await getChatResponse(validChatRequest("large cap funds"), {
      createStream: async () =>
        mockAnthropicStream([
          textDelta("I filtered for large-cap funds."),
          toolStart(1, "toolu_apply", "apply_filters"),
          toolJsonDelta(1, '{"category":"Large Cap",'),
          toolJsonDelta(1, '"sort_by":"returns_3y"}'),
          toolStop(1)
        ]),
      logger: silentLogger
    });
    const body = await response.text();
    const events = parseSseEvents(body);

    expect(response.status).toBe(200);
    expect(events).toEqual([
      {
        type: "text_delta",
        text: "I filtered for large-cap funds. Check the results table for fund names and metrics."
      },
      {
        type: "tool_call",
        toolCall: {
          id: "toolu_apply",
          name: "apply_filters",
          input: {
            category: "Large Cap",
            sort_by: "returns_3y"
          }
        }
      },
      {
        type: "done"
      }
    ]);
    expect(body).not.toContain("content_block_delta");
    expect(body).not.toContain("input_json_delta");
  });

  it("passes current UI context to the model and allows visible fund names", async () => {
    let capturedSystem = "";
    const response = await getChatResponse(
      validChatRequest("which visible fund has the lowest expense?", sampleUiContext),
      {
        createStream: async (params) => {
          capturedSystem = params.system;

          return mockAnthropicStream([
            textDelta(
              "HDFC Large Cap Direct Growth is visible in the table. Its expense ratio comes from the current UI context."
            )
          ]);
        },
        logger: silentLogger
      }
    );
    const body = await response.text();
    const events = parseSseEvents(body);

    expect(capturedSystem).toContain("CURRENT UI CONTEXT");
    expect(capturedSystem).toContain("HDFC Large Cap Direct Growth");
    expect(events).toContainEqual({
      type: "text_delta",
      text: "HDFC Large Cap Direct Growth is visible in the table. Its expense ratio comes from the current UI context."
    });
  });

  it("emits sanitized errors for invalid streamed tool calls", async () => {
    const emitted: ChatSseEvent[] = [];

    await writeChatSseStream(
      mockAnthropicStream([
        toolStart(0, "toolu_bad", "apply_filters"),
        toolJsonDelta(0, '{"category":"Liquid"}'),
        toolStop(0)
      ]),
      {
        enqueue: (event) => emitted.push(event),
        logger: silentLogger
      }
    );

    expect(emitted).toEqual([
      {
        type: "error",
        error: "Invalid tool input."
      },
      {
        type: "done"
      }
    ]);
  });

  it("keeps recommendation responses as filters rather than scheme-name text", async () => {
    const response = await getChatResponse(
      validChatRequest("what is the best HDFC fund right now"),
      {
        createStream: async () =>
          mockAnthropicStream([
            textDelta("I filtered for HDFC funds with stronger 3-year returns."),
            toolStart(2, "toolu_hdfc", "apply_filters"),
            toolJsonDelta(2, '{"fund_house":"HDFC","sort_by":"returns_3y","order":"desc"}'),
            toolStop(2)
          ]),
        logger: silentLogger
      }
    );
    const body = await response.text();
    const events = parseSseEvents(body);

    expect(events).toContainEqual({
      type: "tool_call",
      toolCall: {
        id: "toolu_hdfc",
        name: "apply_filters",
        input: {
          fund_house: "HDFC",
          sort_by: "returns_3y",
          order: "desc"
        }
      }
    });
    expect(body).not.toContain("HDFC Top 100 Fund");
    expect(body).not.toContain("HDFC Flexi Cap Fund");
  });

  it("replaces unsafe assistant text before sending SSE events", async () => {
    const response = await getChatResponse(validChatRequest("best hdfc fund"), {
      createStream: async () =>
        mockAnthropicStream([
          textStart(0),
          textDeltaAt(0, "You should invest in HDFC Top 100 Fund."),
          textDeltaAt(0, " It can help you claim an 80C deduction."),
          textStop(0)
        ]),
      logger: silentLogger
    });
    const body = await response.text();
    const events = parseSseEvents(body);

    expect(events).toEqual([
      {
        type: "text_delta",
        text: "I can screen funds, but I cannot give investment or tax advice. Use the results table as your source of truth."
      },
      {
        type: "done"
      }
    ]);
    expect(body).not.toContain("HDFC Top 100 Fund");
    expect(body).not.toContain("80C");
  });
});

function validChatRequest(content: string, uiContext?: ChatUiContext) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content
        }
      ],
      uiContext
    })
  });
}

async function* mockAnthropicStream(events: RawChatStreamEvent[]) {
  for (const event of events) {
    yield event;
  }
}

function textDelta(text: string) {
  return {
    type: "content_block_delta",
    index: 0,
    delta: {
      type: "text_delta",
      text
    }
  };
}

function textStart(index: number, text = "") {
  return {
    type: "content_block_start",
    index,
    content_block: {
      text,
      type: "text"
    }
  };
}

function textDeltaAt(index: number, text: string) {
  return {
    type: "content_block_delta",
    index,
    delta: {
      type: "text_delta",
      text
    }
  };
}

function textStop(index: number) {
  return {
    type: "content_block_stop",
    index
  };
}

function toolStart(index: number, id: string, name: string) {
  return {
    type: "content_block_start",
    index,
    content_block: {
      id,
      name,
      input: {},
      type: "tool_use"
    }
  };
}

function toolJsonDelta(index: number, partial_json: string) {
  return {
    type: "content_block_delta",
    index,
    delta: {
      partial_json,
      type: "input_json_delta"
    }
  };
}

function toolStop(index: number) {
  return {
    type: "content_block_stop",
    index
  };
}

function parseSseEvents(text: string): ChatSseEvent[] {
  return text
    .trim()
    .split("\n\n")
    .map((chunk) => {
      const dataLine = chunk
        .split("\n")
        .find((line) => line.startsWith("data: "));

      if (!dataLine) {
        throw new Error(`Missing data line in ${chunk}`);
      }

      return JSON.parse(dataLine.slice("data: ".length)) as ChatSseEvent;
    });
}

const sampleUiContext: ChatUiContext = {
  filters: {
    category: "Large Cap",
    min_returns_3y: 15
  },
  results: {
    page: 1,
    pageCount: 1,
    pageSize: 25,
    status: "success",
    total: 1,
    visibleFunds: [
      {
        aum_cr: 15000,
        beta: 0.92,
        category: "Large Cap",
        downside_capture_ratio: 84.8,
        exit_load: "1% if redeemed within 1 year",
        expense_ratio: 0.72,
        fund_house: "HDFC",
        min_sip: 500,
        nav: 123.45,
        plan_type: "Direct",
        rating: 5,
        returns_1y: 18.2,
        returns_3y: 16.4,
        returns_3y_vs_category: 1.4,
        returns_5y: 14.1,
        rolling_returns_3y: 15.9,
        scheme_code: "100001",
        scheme_name: "HDFC Large Cap Direct Growth",
        sharpe_ratio: 1.05,
        standard_deviation: 12.7,
        updated_at: "2026-05-01T00:00:00.000Z",
        upside_capture_ratio: 96.3
      }
    ],
    visibleRange: {
      end: 1,
      start: 1
    },
    zeroState: null
  }
};

const silentLogger = {
  error: () => undefined
};
