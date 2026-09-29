import { describe, expect, it } from "vitest";

import { translateGeminiInteraction } from "../src/model/gemini-model.js";

describe("translateGeminiInteraction", () => {
  it("translates Gemini text output into a final model response", () => {
    /*
     * This object represents the small portion of a Gemini response that
     * Coyote Code uses. No real API request is made.
     */
    const result = translateGeminiInteraction({
      id: "interaction-1",
      output_text: "  The repository contains five files.  ",
      steps: [],
    });

    /*
     * Gemini-specific field names should not escape the adapter. The rest of
     * Coyote Code receives the provider-neutral ModelTurn format.
     */
    expect(result).toEqual({
      id: "interaction-1",
      response: {
        type: "final",
        content: "The repository contains five files.",
      },
    });
  });
});
