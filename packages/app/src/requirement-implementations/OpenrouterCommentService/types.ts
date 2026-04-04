export interface InputMessageItem {
  type: "message";
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  input: InputMessageItem[];
  stream: boolean;
}

export interface OutputContentPart {
  type: string;
  text?: string;
}

export interface OutputItem {
  type: string;
  content?: OutputContentPart[];
}

export interface OpenRouterResponse {
  output_text?: string;
  output?: OutputItem[];
}
