import { requestUrl } from "obsidian";
import { ProviderConfig, ChatMessage } from "../types";

export async function callGoogleAPI(provider: ProviderConfig, apiKey: string, model: string, messages: ChatMessage[], context: string, systemPrompt: string): Promise<string> {
	// Build system instruction
	const systemParts: string[] = [];
	if (systemPrompt) {
		systemParts.push(systemPrompt);
	}
	if (context) {
		systemParts.push(context);
	}

	// Build contents array (Google Gemini format)
	const contents: { role: string; parts: { text: string }[] }[] = [];
	for (const m of messages) {
		contents.push({
			role: m.role === "assistant" ? "model" : "user",
			parts: [{ text: m.content }]
		});
	}

	const requestBody: Record<string, unknown> = {
		contents: contents,
	};

	if (systemParts.length > 0) {
		requestBody.systemInstruction = {
			parts: [{ text: systemParts.join("\n\n") }]
		};
	}

	// Normalize baseUrl - remove trailing slash
	const baseUrl = provider.baseUrl.replace(/\/+$/, "");
	// Google uses API key as query parameter
	const response = await requestUrl({
		url: `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(requestBody),
		throw: false,
	});

	if (response.status < 200 || response.status >= 300) {
		throw new Error(`Google API error: ${response.status} - ${response.text}`);
	}

	const data = response.json;
	// Google returns candidates array with parts that can be text or inlineData (images)
	if (data.candidates && data.candidates[0]?.content?.parts) {
		const parts = data.candidates[0].content.parts;
		const resultParts: string[] = [];

		for (const part of parts) {
			if (part.text) {
				// Text content
				resultParts.push(part.text);
			} else if (part.inlineData) {
				// Image content - convert to Markdown data URL
				const { mimeType, data: base64Data } = part.inlineData;
				const dataUrl = `data:${mimeType};base64,${base64Data}`;
				resultParts.push(`\n\n![Generated Image](${dataUrl})\n\n`);
			}
		}

		return resultParts.join("") || "No response";
	}
	return "No response";
}
