import { PluginSettings } from "./types";

export const VIEW_TYPE_CANVAS_CHAT = "canvas-chat-view";
export const FILE_EXTENSION = "canvaschat";

export const DEFAULT_CONTEXT_TEMPLATE = `--- {filepath} ---
{content}`;

export const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. You help users with their questions and tasks. When context files are provided, use them to give more accurate and relevant answers. Be concise but thorough.`;

export const DEFAULT_SETTINGS: PluginSettings = {
	customOpenRouterModels: "",
	providers: [
		{
			name: "OpenAI",
			baseUrl: "https://api.openai.com/v1",
			apiKey: "",
			models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
			enabled: true,
			apiFormat: "openai"
		},
		{
			name: "OpenRouter",
			baseUrl: "https://openrouter.ai/api/v1",
			apiKey: "",
			models: ["anthropic/claude-3.5-sonnet", "anthropic/claude-3-opus", "openai/gpt-4o", "google/gemini-pro-1.5"],
			enabled: true,
			apiFormat: "openai"
		},
		{
			name: "Anthropic",
			baseUrl: "https://api.anthropic.com",
			apiKey: "",
			models: ["claude-sonnet-4-5", "claude-sonnet-4-5-thinking", "claude-opus-4-5-thinking"],
			enabled: true,
			apiFormat: "anthropic"
		},
		{
			name: "Google",
			baseUrl: "https://generativelanguage.googleapis.com/v1beta",
			apiKey: "",
			models: ["gemini-2.5-flash", "gemini-2.5-flash-thinking", "gemini-3-flash", "gemini-3-pro-high", "gemini-3-pro-low"],
			enabled: true,
			apiFormat: "google"
		}
	]
};
