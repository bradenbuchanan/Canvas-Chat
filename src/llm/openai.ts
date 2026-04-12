import { requestUrl } from "obsidian";
import { ProviderConfig, ChatMessage } from "../types";

export async function callOpenAIAPI(provider: ProviderConfig, apiKey: string, model: string, messages: ChatMessage[], context: string, systemPrompt: string): Promise<string> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		"Authorization": `Bearer ${apiKey}`,
	};

	// OpenRouter requires additional headers
	if (provider.name === "OpenRouter") {
		headers["HTTP-Referer"] = "https://obsidian.md";
		headers["X-Title"] = "Canvas Chat";
	}

	// Build messages array with system prompt and context
	const apiMessages: { role: string; content: string }[] = [];

	// Combine system prompt and context
	const systemParts: string[] = [];
	if (systemPrompt) {
		systemParts.push(systemPrompt);
	}
	if (context) {
		systemParts.push(context);
	}
	if (systemParts.length > 0) {
		apiMessages.push({ role: "system", content: systemParts.join("\n\n") });
	}

	for (const m of messages) {
		apiMessages.push({ role: m.role, content: m.content });
	}

	// Normalize baseUrl - remove trailing slash
	const baseUrl = provider.baseUrl.replace(/\/+$/, "");
	const response = await requestUrl({
		url: `${baseUrl}/chat/completions`,
		method: "POST",
		headers,
		body: JSON.stringify({
			model: model,
			messages: apiMessages,
		}),
		throw: false,
	});

	if (response.status < 200 || response.status >= 300) {
		throw new Error(`API error: ${response.status} - ${response.text}`);
	}

	const data = response.json;
	return data.choices[0]?.message?.content || "No response";
}
