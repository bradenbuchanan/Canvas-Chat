export interface CanvasNode {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	type: "card" | "chat" | "link" | "note";
	content: string;
	title?: string;
	filePath?: string;
	url?: string;
	linkTitle?: string;
	linkDescription?: string;
	linkImage?: string;
	linkContent?: string;
	linkType?: "webpage" | "youtube" | "twitter" | "obsidian";
}

export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
	contextFiles?: string[]; // Context files at the time of sending (for user messages)
	contextNodes?: string[]; // Connected canvas node IDs at the time of sending
}

export interface Edge {
	id: string;
	from: string;
	to: string;
}

export interface ProviderConfig {
	name: string;
	baseUrl: string;
	apiKey: string;
	models: string[];
	enabled: boolean;
	apiFormat: "openai" | "anthropic" | "google";
}

export interface PluginSettings {
	customOpenRouterModels: string;
	providers: ProviderConfig[];
}

export interface ChatNodeState {
	provider: string;
	model: string;
	contextFiles: string[]; // file paths
	contextNodes: string[]; // connected canvas node IDs
	systemPrompt: string;
	contextTemplate: string; // template for context files
}

/** Subset of CanvasChatView methods needed by ExpandedChatModal. */
export interface ChatViewHandle {
	getNode(nodeId: string): CanvasNode | undefined;
	getChatState(nodeId: string): ChatNodeState | undefined;
	getChatMessages(nodeId: string): ChatMessage[] | undefined;
	sendChatMessage(nodeId: string, text: string): Promise<void>;
}

export interface CanvasChatData {
	nodes: CanvasNode[];
	edges: Edge[];
	chatMessages: Record<string, ChatMessage[]>;
	chatStates: Record<string, ChatNodeState>;
	view: {
		scale: number;
		panX: number;
		panY: number;
	};
}
