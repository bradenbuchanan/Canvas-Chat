import { requestUrl } from "obsidian";
import { ProviderConfig, ChatMessage } from "../types";

export async function callAnthropicAPI(provider: ProviderConfig, apiKey: string, model: string, messages: ChatMessage[], context: string, systemPrompt: string): Promise<string> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		"x-api-key": apiKey,
		"anthropic-version": "2023-06-01",
		"anthropic-dangerous-direct-browser-access": "true",
	};

	// Build system prompt
	const systemParts: string[] = [];
	if (systemPrompt) {
		systemParts.push(systemPrompt);
	}
	if (context) {
		systemParts.push(context);
	}

	// Build messages array (Anthropic format)
	const apiMessages: { role: string; content: string }[] = [];
	for (const m of messages) {
		apiMessages.push({ role: m.role, content: m.content });
	}

	const requestBody: Record<string, unknown> = {
		model: model,
		max_tokens: 4096,
		messages: apiMessages,
	};

	if (systemParts.length > 0) {
		requestBody.system = systemParts.join("\n\n");
	}

	// Normalize baseUrl - remove trailing slash and ensure correct path
	const baseUrl = provider.baseUrl.replace(/\/+$/, "");
	const response = await requestUrl({
		url: `${baseUrl}/v1/messages`,
		method: "POST",
		headers,
		body: JSON.stringify(requestBody),
		throw: false,
	});

	if (response.status < 200 || response.status >= 300) {
		throw new Error(`Anthropic API error: ${response.status} - ${response.text}`);
	}

	const data = response.json;
	// Anthropic returns content as an array of content blocks
	if (data.content && Array.isArray(data.content)) {
		return data.content
			.filter((block: { type: string }) => block.type === "text")
			.map((block: { text: string }) => block.text)
			.join("");
	}
	return "No response";
}
