import type {
  CommentContext,
  CommentService,
} from "../../requirements/CommentService.js";
import { system, user } from "./prompts.js";
import type {
  InputMessageItem,
  OpenRouterRequest,
  OpenRouterResponse,
} from "./types.js";

export default class OpenRouterCommentService implements CommentService {
  constructor(
    private options: {
      apiKey: string;
      model: string;
      baseUrl: string;
    },
  ) {}

  async generateComment(context: CommentContext): Promise<string> {
    const fallback = "No comment.";
    try {
      const comment = await this.generateCompletion([
        { type: "message", role: "system", content: system() },
        { type: "message", role: "user", content: user(context) },
      ]);
      return comment.trim() || fallback;
    } catch (error) {
      console.error("AI comment generation failed", { error });
      return fallback;
    }
  }

  private async generateCompletion(
    messages: InputMessageItem[],
  ): Promise<string> {
    const requestBody: OpenRouterRequest = {
      model: this.options.model,
      input: messages,
      stream: false,
    };

    const response = await fetch(this.options.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `OpenRouter request failed (${response.status}): ${body}`,
      );
    }

    const json = (await response.json()) as OpenRouterResponse;
    return json.output_text ?? this.extractTextFromOutput(json) ?? "";
  }

  private extractTextFromOutput(response: OpenRouterResponse): string | null {
    if (!response.output) {
      return null;
    }
    for (const item of response.output) {
      if (item.type === "message" && item.content) {
        for (const content of item.content) {
          if (content.type === "output_text" && content.text) {
            return content.text;
          }
        }
      }
    }
    return null;
  }
}
