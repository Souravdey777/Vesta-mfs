import { describe, expect, it } from "vitest";

import {
  guardAssistantStreamingText,
  guardAssistantStructuredText,
  guardAssistantText
} from "@/lib/chat-guardrails";

describe("chat guardrails", () => {
  it("leaves safe two-sentence filtering copy alone", () => {
    expect(
      guardAssistantText(
        "I filtered for large-cap funds with 3-year returns above 15%. The results table is updated."
      )
    ).toEqual({
      changed: false,
      reason: null,
      text: "I filtered for large-cap funds with 3-year returns above 15%. The results table is updated."
    });
  });

  it("pads one-sentence responses with a source-of-truth reminder", () => {
    expect(guardAssistantText("Applied filters.")).toEqual({
      changed: true,
      reason: "sentence_count",
      text: "Applied filters. Check the results table for fund names and metrics."
    });
  });

  it("truncates responses above four sentences", () => {
    expect(guardAssistantText("One. Two. Three. Four. Five.").text).toBe(
      "One. Two. Three. Four."
    );
  });

  it("replaces investment or tax advice with neutral screening copy", () => {
    const result = guardAssistantText(
      "You should invest in an ELSS fund to claim an 80C deduction this year."
    );

    expect(result).toMatchObject({
      changed: true,
      reason: "advice"
    });
    expect(result.text).not.toContain("80C");
  });

  it("replaces generated scheme-name-like text", () => {
    const result = guardAssistantText(
      "HDFC Top 100 Fund looks strong for this screen. The table is updated."
    );

    expect(result).toMatchObject({
      changed: true,
      reason: "fund_name"
    });
    expect(result.text).not.toContain("HDFC Top 100 Fund");
  });

  it("allows visible UI context fund names", () => {
    expect(
      guardAssistantText(
        "HDFC Large Cap Direct Growth is visible in the table. Its metrics come from the current UI context.",
        {
          allowedFundNames: ["HDFC Large Cap Direct Growth"]
        }
      )
    ).toEqual({
      changed: false,
      reason: null,
      text: "HDFC Large Cap Direct Growth is visible in the table. Its metrics come from the current UI context."
    });
  });

  it("allows generic category and plan phrases", () => {
    expect(
      guardAssistantText("I filtered for ELSS Fund screens. Direct Plan rows can appear in the table.")
        .changed
    ).toBe(false);
  });

  it("does not pad partial streaming text before the final guardrail pass", () => {
    expect(guardAssistantStreamingText("I am filtering ELSS rows")).toEqual({
      changed: false,
      reason: null,
      text: "I am filtering ELSS rows"
    });
  });

  it("preserves structured markdown-like filter summaries", () => {
    expect(guardAssistantStructuredText("**Applied filters**\n- Category: ELSS")).toEqual({
      changed: false,
      reason: null,
      text: "**Applied filters**\n- Category: ELSS"
    });
  });
});
