import { ProviderConfig, ChatMessage } from "../types";
import { callOpenAIAPI } from "./openai";
import { callAnthropicAPI } from "./anthropic";
import { callGoogleAPI } from "./google";

export { callOpenAIAPI } from "./openai";
export { callAnthropicAPI } from "./anthropic";
export { callGoogleAPI } from "./google";

export async function callLLM(provider: ProviderConfig, apiKey: string, model: string, messages: ChatMessage[], context: string = "", systemPrompt: string = ""): Promise<string> {
	const apiFormat = provider.apiFormat || "openai";

	switch (apiFormat) {
		case "anthropic":
			return callAnthropicAPI(provider, apiKey, model, messages, context, systemPrompt);
		case "google":
			return callGoogleAPI(provider, apiKey, model, messages, context, systemPrompt);
		case "openai":
		default:
			return callOpenAIAPI(provider, apiKey, model, messages, context, systemPrompt);
	}
}
