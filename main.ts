import {
	TextFileView,
	Plugin,
	WorkspaceLeaf,
	TFile,
	Menu,
	TFolder,
	Notice,
	Modal,
	Setting,
	MarkdownRenderer,
	Component,
	requestUrl,
	setIcon,
} from "obsidian";

const VIEW_TYPE_RABBITMAP = "rabbitmap-canvas";
const FILE_EXTENSION = "rabbitmap";

interface CanvasNode {
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

interface ChatMessage {
	role: "user" | "assistant";
	content: string;
	contextFiles?: string[]; // Context files at the time of sending (for user messages)
	contextNodes?: string[]; // Connected canvas node IDs at the time of sending
}

interface Edge {
	id: string;
	from: string;
	to: string;
}

interface ProviderConfig {
	name: string;
	baseUrl: string;
	apiKey: string;
	models: string[];
	enabled: boolean;
	apiFormat: "openai" | "anthropic" | "google";
}

interface PluginSettings {
	openaiApiKey: string; // deprecated, kept for migration
	openrouterApiKey: string; // deprecated, kept for migration
	customOpenRouterModels: string;
	providers: ProviderConfig[];
}

const DEFAULT_SETTINGS: PluginSettings = {
	openaiApiKey: "",
	openrouterApiKey: "",
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

interface ChatNodeState {
	provider: string;
	model: string;
	contextFiles: string[]; // file paths
	contextNodes: string[]; // connected canvas node IDs
	systemPrompt: string;
	contextTemplate: string; // template for context files
}

const DEFAULT_CONTEXT_TEMPLATE = `--- {filepath} ---
{content}`;

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. You help users with their questions and tasks. When context files are provided, use them to give more accurate and relevant answers. Be concise but thorough.`;

interface RabbitMapData {
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

class RabbitMapView extends TextFileView {
	private canvas: HTMLElement;
	private nodesContainer: HTMLElement;
	private nodes: Map<string, CanvasNode> = new Map();
	private nodeElements: Map<string, HTMLElement> = new Map();

	// Canvas transform state
	private scale = 1;
	private panX = 0;
	private panY = 0;

	// Interaction state
	private isPanning = false;
	private panStartX = 0;
	private panStartY = 0;
	private spacePressed = false;

	// Drag state
	private draggedNode: string | null = null;
	private dragOffsetX = 0;
	private dragOffsetY = 0;

	// Resize state
	private resizingNode: string | null = null;
	private resizeStartWidth = 0;
	private resizeStartHeight = 0;
	private resizeStartX = 0;
	private resizeStartY = 0;

	// Active context menu (prevent overlapping menus)
	private activeMenu: Menu | null = null;

	// Selection state
	private selectedNodes: Set<string> = new Set();
	private isSelecting = false;
	private selectionBox: HTMLElement | null = null;
	private selectionStartX = 0;
	private selectionStartY = 0;
	private dragStartPositions: Map<string, { x: number; y: number }> = new Map();
	private dragStartMouseX = 0;
	private dragStartMouseY = 0;

	// Minimap
	private minimap: HTMLElement;
	private minimapContent: HTMLElement;
	private minimapViewport: HTMLElement;
	private minimapNodes: Map<string, HTMLElement> = new Map();

	// Chat state
	private chatMessages: Map<string, ChatMessage[]> = new Map();
	private chatStates: Map<string, ChatNodeState> = new Map();

	// Edges
	private edges: Map<string, Edge> = new Map();
	private edgesContainer: SVGSVGElement;

	// Edge drawing state
	private isDrawingEdge = false;
	private edgeDrawFromNode: string | null = null;
	private edgeDrawFromSide: "top" | "right" | "bottom" | "left" | null = null;
	private edgeDrawTempLine: SVGLineElement | null = null;

	// Plugin reference
	plugin: RabbitMapPlugin;

	private isLoaded = false;
	private isSaving = false;
	private saveTimeout: number | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: RabbitMapPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_RABBITMAP;
	}

	getDisplayText(): string {
		return this.file?.basename || "RabbitMap";
	}

	getIcon(): string {
		return "layout-dashboard";
	}

	// Called by Obsidian to get current data for saving
	getViewData(): string {
		const data: RabbitMapData = {
			nodes: Array.from(this.nodes.values()),
			edges: Array.from(this.edges.values()),
			chatMessages: Object.fromEntries(this.chatMessages),
			chatStates: Object.fromEntries(this.chatStates),
			view: {
				scale: this.scale,
				panX: this.panX,
				panY: this.panY,
			},
		};
		return JSON.stringify(data, null, 2);
	}

	// Called by Obsidian when file content is loaded
	setViewData(data: string, clear: boolean): void {
		// Ignore if we triggered the save ourselves
		if (this.isSaving) {
			return;
		}

		if (clear) {
			this.clear();
		}

		try {
			if (data.trim()) {
				const parsed: RabbitMapData = JSON.parse(data);

				// Restore view state
				if (parsed.view) {
					this.scale = parsed.view.scale || 1;
					this.panX = parsed.view.panX || 0;
					this.panY = parsed.view.panY || 0;
				}

				// Restore chat messages
				if (parsed.chatMessages) {
					for (const [nodeId, messages] of Object.entries(parsed.chatMessages)) {
						this.chatMessages.set(nodeId, messages);
					}
				}

				// Restore chat states
				if (parsed.chatStates) {
					for (const [nodeId, state] of Object.entries(parsed.chatStates)) {
						this.chatStates.set(nodeId, state as ChatNodeState);
					}
				}

				// Restore nodes
				if (parsed.nodes && parsed.nodes.length > 0) {
					for (const node of parsed.nodes) {
						this.nodes.set(node.id, node);
						this.renderNode(node);
					}
				}

				// Restore edges
				if (parsed.edges && parsed.edges.length > 0) {
					for (const edge of parsed.edges) {
						this.edges.set(edge.id, edge);
					}
					this.renderAllEdges();
				}
			}
		} catch (e) {
			console.log("Error parsing rabbitmap file:", e);
		}

		// If no nodes after loading, add a default chat
		if (this.nodes.size === 0) {
			this.addNode({
				id: this.generateId(),
				x: 100,
				y: 100,
				width: 400,
				height: 500,
				type: "chat",
				content: "",
			}, false); // Don't trigger save on initial load
		}

		this.updateTransform();
		this.isLoaded = true;
	}

	clear(): void {
		this.nodes.clear();
		this.chatMessages.clear();
		this.chatStates.clear();
		this.edges.clear();
		this.nodeElements.forEach((el) => el.remove());
		this.nodeElements.clear();
		if (this.edgesContainer) {
			this.edgesContainer.innerHTML = "";
		}
		this.scale = 1;
		this.panX = 0;
		this.panY = 0;
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("rabbitmap-container");

		// Create canvas
		this.canvas = container.createDiv({ cls: "rabbitmap-canvas" });

		// Create SVG for edges
		this.edgesContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		this.edgesContainer.addClass("rabbitmap-edges");
		this.canvas.appendChild(this.edgesContainer);

		this.nodesContainer = this.canvas.createDiv({ cls: "rabbitmap-nodes" });

		// Create selection box
		this.selectionBox = this.canvas.createDiv({ cls: "rabbitmap-selection-box" });
		this.selectionBox.style.display = "none";

		// Create toolbar
		this.createToolbar(container);

		// Create minimap
		this.createMinimap(container);

		// Setup event listeners
		this.setupEventListeners();

		this.updateTransform();
	}

	private triggerSave(): void {
		if (!this.isLoaded || !this.file) return;

		// Debounce saves
		if (this.saveTimeout) {
			window.clearTimeout(this.saveTimeout);
		}

		this.saveTimeout = window.setTimeout(async () => {
			if (!this.file) return;

			this.isSaving = true;
			await this.app.vault.modify(this.file, this.getViewData());
			// Reset flag after a short delay to catch any setViewData calls
			setTimeout(() => {
				this.isSaving = false;
			}, 100);
		}, 300);
	}

	private createMinimap(container: Element): void {
		this.minimap = container.createDiv({ cls: "rabbitmap-minimap" });
		this.minimapContent = this.minimap.createDiv({ cls: "rabbitmap-minimap-content" });
		this.minimapViewport = this.minimap.createDiv({ cls: "rabbitmap-minimap-viewport" });

		// Click on minimap to navigate
		this.minimap.addEventListener("mousedown", (e) => {
			e.preventDefault();
			this.navigateFromMinimap(e);
		});

		this.minimap.addEventListener("mousemove", (e) => {
			if (e.buttons === 1) {
				this.navigateFromMinimap(e);
			}
		});
	}

	private navigateFromMinimap(e: MouseEvent): void {
		const bounds = this.getContentBounds();
		if (!bounds) return;

		const rect = this.minimap.getBoundingClientRect();
		const canvasRect = this.canvas.getBoundingClientRect();

		// Click position relative to minimap
		const clickX = e.clientX - rect.left;
		const clickY = e.clientY - rect.top;

		// Minimap dimensions
		const minimapWidth = rect.width;
		const minimapHeight = rect.height;

		// Content bounds with padding
		const padding = 50;
		const contentWidth = bounds.maxX - bounds.minX + padding * 2;
		const contentHeight = bounds.maxY - bounds.minY + padding * 2;

		// Scale from minimap to canvas
		const minimapScale = Math.min(minimapWidth / contentWidth, minimapHeight / contentHeight);

		// Offset for centering content in minimap
		const contentScaledWidth = contentWidth * minimapScale;
		const contentScaledHeight = contentHeight * minimapScale;
		const offsetX = (minimapWidth - contentScaledWidth) / 2;
		const offsetY = (minimapHeight - contentScaledHeight) / 2;

		// Convert click to canvas coordinates
		const canvasX = (clickX - offsetX) / minimapScale + bounds.minX - padding;
		const canvasY = (clickY - offsetY) / minimapScale + bounds.minY - padding;

		// Center view on clicked point
		this.panX = canvasRect.width / 2 - canvasX * this.scale;
		this.panY = canvasRect.height / 2 - canvasY * this.scale;

		// Clamp pan
		const clamped = this.clampPan(this.panX, this.panY);
		this.panX = clamped.x;
		this.panY = clamped.y;

		this.updateTransform();
		this.triggerSave();
	}

	private updateMinimap(): void {
		if (!this.minimap) return;

		const bounds = this.getContentBounds();
		if (!bounds) {
			this.minimapViewport.style.display = "none";
			return;
		}

		const canvasRect = this.canvas.getBoundingClientRect();
		const minimapRect = this.minimap.getBoundingClientRect();

		// Content bounds with padding
		const padding = 50;
		const contentMinX = bounds.minX - padding;
		const contentMinY = bounds.minY - padding;
		const contentWidth = bounds.maxX - bounds.minX + padding * 2;
		const contentHeight = bounds.maxY - bounds.minY + padding * 2;

		// Scale to fit in minimap
		const minimapScale = Math.min(
			minimapRect.width / contentWidth,
			minimapRect.height / contentHeight
		);

		// Offset for centering
		const contentScaledWidth = contentWidth * minimapScale;
		const contentScaledHeight = contentHeight * minimapScale;
		const offsetX = (minimapRect.width - contentScaledWidth) / 2;
		const offsetY = (minimapRect.height - contentScaledHeight) / 2;

		// Update minimap nodes
		for (const [nodeId, node] of this.nodes) {
			let minimapNode = this.minimapNodes.get(nodeId);
			if (!minimapNode) {
				minimapNode = this.minimapContent.createDiv({ cls: "rabbitmap-minimap-node" });
				if (node.type === "chat") {
					minimapNode.addClass("rabbitmap-minimap-node-chat");
				} else if (node.type === "link") {
					minimapNode.addClass("rabbitmap-minimap-node-link");
				} else if (node.type === "note") {
					minimapNode.addClass("rabbitmap-minimap-node-note");
				}
				this.minimapNodes.set(nodeId, minimapNode);
			}

			minimapNode.style.left = `${offsetX + (node.x - contentMinX) * minimapScale}px`;
			minimapNode.style.top = `${offsetY + (node.y - contentMinY) * minimapScale}px`;
			minimapNode.style.width = `${node.width * minimapScale}px`;
			minimapNode.style.height = `${node.height * minimapScale}px`;
		}

		// Remove deleted nodes from minimap
		for (const [nodeId, el] of this.minimapNodes) {
			if (!this.nodes.has(nodeId)) {
				el.remove();
				this.minimapNodes.delete(nodeId);
			}
		}

		// Update viewport indicator
		this.minimapViewport.style.display = "block";
		const viewLeft = (-this.panX / this.scale - contentMinX) * minimapScale + offsetX;
		const viewTop = (-this.panY / this.scale - contentMinY) * minimapScale + offsetY;
		const viewWidth = (canvasRect.width / this.scale) * minimapScale;
		const viewHeight = (canvasRect.height / this.scale) * minimapScale;

		this.minimapViewport.style.left = `${viewLeft}px`;
		this.minimapViewport.style.top = `${viewTop}px`;
		this.minimapViewport.style.width = `${viewWidth}px`;
		this.minimapViewport.style.height = `${viewHeight}px`;
	}

	private createToolbar(container: Element): void {
		const toolbar = container.createDiv({ cls: "rabbitmap-toolbar" });

		// Add elements button
		const addCardBtn = toolbar.createEl("button", { cls: "rabbitmap-btn rabbitmap-btn-icon", attr: { title: "Add Card" } });
		addCardBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
		addCardBtn.onclick = () => this.addCardAtCenter();

		const addChatBtn = toolbar.createEl("button", { cls: "rabbitmap-btn rabbitmap-btn-icon", attr: { title: "Add Chat" } });
		addChatBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
		addChatBtn.onclick = () => this.addChatAtCenter();

		const addLinkBtn = toolbar.createEl("button", { cls: "rabbitmap-btn rabbitmap-btn-icon", attr: { title: "Add Link" } });
		addLinkBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
		addLinkBtn.onclick = () => this.showAddLinkModal();

		// Separator
		toolbar.createDiv({ cls: "rabbitmap-toolbar-separator" });

		// Settings button
		const settingsBtn = toolbar.createEl("button", { cls: "rabbitmap-btn rabbitmap-btn-icon", attr: { title: "Settings" } });
		settingsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
		settingsBtn.onclick = () => this.openSettings();
	}

	private openSettings(): void {
		new SettingsModal(this.app, this.plugin).open();
	}

	private setupEventListeners(): void {
		// Mouse wheel / trackpad handling
		this.canvas.addEventListener("wheel", (e) => {
			e.preventDefault();

			// Pinch to zoom (ctrlKey is set for pinch gestures on trackpad)
			if (e.ctrlKey || e.metaKey) {
				const delta = -e.deltaY * 0.01; // Slower zoom
				this.zoomAtPoint(delta, e.clientX, e.clientY);
			} else {
				// Two-finger scroll = pan
				let newPanX = this.panX - e.deltaX;
				let newPanY = this.panY - e.deltaY;

				// Clamp pan to keep content visible
				const clamped = this.clampPan(newPanX, newPanY);
				this.panX = clamped.x;
				this.panY = clamped.y;
				this.updateTransform();
				this.triggerSave();
			}
		});

		// Pan with middle mouse or space + left mouse, or start selection
		this.canvas.addEventListener("mousedown", (e) => {
			if (e.button === 1 || (e.button === 0 && this.spacePressed)) {
				// Panning
				e.preventDefault();
				this.isPanning = true;
				this.panStartX = e.clientX - this.panX;
				this.panStartY = e.clientY - this.panY;
				this.canvas.addClass("panning");
			} else if (e.button === 0 && e.target === this.canvas) {
				// Start selection box (only if clicking on canvas itself, not on nodes)
				e.preventDefault();
				this.isSelecting = true;
				const rect = this.canvas.getBoundingClientRect();
				this.selectionStartX = e.clientX - rect.left;
				this.selectionStartY = e.clientY - rect.top;

				if (this.selectionBox) {
					this.selectionBox.style.left = `${this.selectionStartX}px`;
					this.selectionBox.style.top = `${this.selectionStartY}px`;
					this.selectionBox.style.width = "0px";
					this.selectionBox.style.height = "0px";
					this.selectionBox.style.display = "block";
				}

				// Clear selection if not holding shift
				if (!e.shiftKey) {
					this.clearSelection();
				}
			}
		});

		document.addEventListener("mousemove", (e) => {
			if (this.isPanning) {
				let newPanX = e.clientX - this.panStartX;
				let newPanY = e.clientY - this.panStartY;

				// Clamp pan to keep content visible
				const clamped = this.clampPan(newPanX, newPanY);
				this.panX = clamped.x;
				this.panY = clamped.y;
				this.updateTransform();
			} else if (this.isSelecting && this.selectionBox) {
				// Update selection box
				const rect = this.canvas.getBoundingClientRect();
				const currentX = e.clientX - rect.left;
				const currentY = e.clientY - rect.top;

				const left = Math.min(this.selectionStartX, currentX);
				const top = Math.min(this.selectionStartY, currentY);
				const width = Math.abs(currentX - this.selectionStartX);
				const height = Math.abs(currentY - this.selectionStartY);

				this.selectionBox.style.left = `${left}px`;
				this.selectionBox.style.top = `${top}px`;
				this.selectionBox.style.width = `${width}px`;
				this.selectionBox.style.height = `${height}px`;

				// Update selection based on intersection
				this.updateSelectionFromBox(left, top, width, height);
			} else if (this.isDrawingEdge && this.edgeDrawTempLine) {
				const rect = this.canvas.getBoundingClientRect();
				const canvasX = (e.clientX - rect.left - this.panX) / this.scale;
				const canvasY = (e.clientY - rect.top - this.panY) / this.scale;
				this.edgeDrawTempLine.setAttribute("x2", String(canvasX));
				this.edgeDrawTempLine.setAttribute("y2", String(canvasY));
			} else if (this.draggedNode) {
				const rect = this.canvas.getBoundingClientRect();
				const mouseX = (e.clientX - rect.left - this.panX) / this.scale;
				const mouseY = (e.clientY - rect.top - this.panY) / this.scale;

				// If dragging a selected node, move all selected nodes
				if (this.selectedNodes.has(this.draggedNode) && this.selectedNodes.size > 0) {
					const deltaX = mouseX - this.dragStartMouseX;
					const deltaY = mouseY - this.dragStartMouseY;

					for (const nodeId of this.selectedNodes) {
						const startPos = this.dragStartPositions.get(nodeId);
						if (startPos) {
							this.updateNodePosition(nodeId, startPos.x + deltaX, startPos.y + deltaY);
						}
					}
				} else {
					const x = mouseX - this.dragOffsetX;
					const y = mouseY - this.dragOffsetY;
					this.updateNodePosition(this.draggedNode, x, y);
				}

				// Visual feedback: highlight chat nodes when dragging a non-chat node over them
				const draggedNodeData = this.nodes.get(this.draggedNode);
				if (draggedNodeData && draggedNodeData.type !== "chat") {
					const dragCenterX = draggedNodeData.x + draggedNodeData.width / 2;
					const dragCenterY = draggedNodeData.y + draggedNodeData.height / 2;
					for (const [id, n] of this.nodes) {
						const el = this.nodeElements.get(id);
						if (!el || n.type !== "chat" || id === this.draggedNode) continue;
						const inside = dragCenterX >= n.x && dragCenterX <= n.x + n.width &&
							dragCenterY >= n.y && dragCenterY <= n.y + n.height;
						el.toggleClass("rabbitmap-drop-target", inside);
					}
				}
			} else if (this.resizingNode) {
				const deltaX = (e.clientX - this.resizeStartX) / this.scale;
				const deltaY = (e.clientY - this.resizeStartY) / this.scale;
				const newWidth = Math.max(200, this.resizeStartWidth + deltaX);
				const newHeight = Math.max(150, this.resizeStartHeight + deltaY);
				this.updateNodeSize(this.resizingNode, newWidth, newHeight);
			}
		});

		document.addEventListener("mouseup", (e) => {
			// Edge drawing completion
			if (this.isDrawingEdge) {
				const targetInfo = this.findTargetHandle(e);
				if (targetInfo && targetInfo.nodeId !== this.edgeDrawFromNode) {
					// Check for duplicate edges
					const duplicate = Array.from(this.edges.values()).some(
						(edge) =>
							(edge.from === this.edgeDrawFromNode && edge.to === targetInfo.nodeId) ||
							(edge.from === targetInfo.nodeId && edge.to === this.edgeDrawFromNode)
					);
					if (!duplicate) {
						this.addEdge(this.edgeDrawFromNode!, targetInfo.nodeId);
						this.triggerSave();
					}
				}
				// Cleanup
				if (this.edgeDrawTempLine) {
					this.edgeDrawTempLine.remove();
					this.edgeDrawTempLine = null;
				}
				this.isDrawingEdge = false;
				this.edgeDrawFromNode = null;
				this.edgeDrawFromSide = null;
				this.canvas.removeClass("drawing-edge");
				return;
			}

			if (this.isPanning || this.draggedNode || this.resizingNode) {
				this.triggerSave();
			}

			// Drag-to-contextualize: detect non-chat node dropped onto chat node
			if (this.draggedNode) {
				const draggedNodeData = this.nodes.get(this.draggedNode);
				if (draggedNodeData && draggedNodeData.type !== "chat") {
					const dragCenterX = draggedNodeData.x + draggedNodeData.width / 2;
					const dragCenterY = draggedNodeData.y + draggedNodeData.height / 2;
					for (const [id, n] of this.nodes) {
						if (n.type !== "chat" || id === this.draggedNode) continue;
						const inside = dragCenterX >= n.x && dragCenterX <= n.x + n.width &&
							dragCenterY >= n.y && dragCenterY <= n.y + n.height;
						if (inside) {
							const chatState = this.chatStates.get(id);
							if (chatState) {
								if (!chatState.contextNodes) chatState.contextNodes = [];
								if (!chatState.contextNodes.includes(this.draggedNode)) {
									chatState.contextNodes.push(this.draggedNode);
									this.chatStates.set(id, chatState);

									// Add edge if not already connected
									const hasEdge = Array.from(this.edges.values()).some(
										edge => (edge.from === id && edge.to === this.draggedNode) ||
											(edge.from === this.draggedNode && edge.to === id)
									);
									if (!hasEdge) {
										this.addEdge(id, this.draggedNode);
									}

									// Re-render chat node to show new context
									const nodeEl = this.nodeElements.get(id);
									if (nodeEl) {
										const content = nodeEl.querySelector(".rabbitmap-node-content");
										if (content) {
											content.empty();
											this.renderChatContent(id, content as HTMLElement);
										}
									}

									new Notice("Added to chat context");
									this.triggerSave();
								}
							}
							break;
						}
					}
				}

				// Clear drop target highlights
				for (const el of this.nodeElements.values()) {
					el.removeClass("rabbitmap-drop-target");
				}
			}

			this.isPanning = false;
			this.draggedNode = null;
			this.dragStartPositions.clear();
			this.resizingNode = null;
			this.canvas.removeClass("panning");

			// End selection
			if (this.isSelecting && this.selectionBox) {
				this.isSelecting = false;
				this.selectionBox.style.display = "none";
			}
		});

		// Space key for pan mode
		document.addEventListener("keydown", (e) => {
			if (e.code === "Space" && !this.isInputFocused()) {
				e.preventDefault();
				this.spacePressed = true;
				this.canvas.addClass("pan-mode");
			}
			// Delete selected nodes
			if ((e.code === "Delete" || e.code === "Backspace") && !this.isInputFocused() && this.selectedNodes.size > 0) {
				e.preventDefault();
				this.deleteSelectedNodes();
			}
			// Escape to clear selection
			if (e.code === "Escape" && this.selectedNodes.size > 0) {
				this.clearSelection();
			}
		});

		document.addEventListener("keyup", (e) => {
			if (e.code === "Space") {
				this.spacePressed = false;
				this.canvas.removeClass("pan-mode");
			}
		});

		// Paste handler for URLs
		this.canvas.addEventListener("paste", (e) => {
			if (this.isInputFocused()) return;
			const text = e.clipboardData?.getData("text/plain")?.trim();
			if (text && /^https?:\/\//i.test(text)) {
				e.preventDefault();
				this.addLinkAtCenter(text);
			}
		});

		// Canvas-level drag and drop for importing notes
		this.canvas.addEventListener("dragover", (e) => {
			e.preventDefault();
			this.canvas.addClass("rabbitmap-canvas-drag-over");
		});

		this.canvas.addEventListener("dragleave", (e) => {
			e.preventDefault();
			this.canvas.removeClass("rabbitmap-canvas-drag-over");
		});

		this.canvas.addEventListener("drop", async (e) => {
			e.preventDefault();
			this.canvas.removeClass("rabbitmap-canvas-drag-over");

			const plainText = e.dataTransfer?.getData("text/plain") || "";
			if (!plainText) return;

			const canvasRect = this.canvas.getBoundingClientRect();
			const dropX = (e.clientX - canvasRect.left - this.panX) / this.scale;
			const dropY = (e.clientY - canvasRect.top - this.panY) / this.scale;

			const lines = plainText.split("\n").map(l => l.trim()).filter(l => l);
			let offsetIndex = 0;

			for (const line of lines) {
				const path = this.parsePath(line);
				if (!path) continue;

				// Skip HTTP URLs — those are handled by the paste handler
				if (path.startsWith("http")) {
					this.addLinkNode(path, dropX - 150 + offsetIndex * 30, dropY - 100 + offsetIndex * 30);
					offsetIndex++;
					continue;
				}

				// Try to resolve as file or folder
				const item = this.resolveVaultItem(path);

				if (item instanceof TFolder) {
					// Add all markdown files from folder as note nodes
					const mdFiles = this.getMdFilesFromFolder(item);
					for (const file of mdFiles) {
						try {
							const content = await this.app.vault.read(file);
							this.addNoteNode(file.path, content, dropX + offsetIndex * 30, dropY + offsetIndex * 30);
							offsetIndex++;
						} catch {}
					}
				} else if (item instanceof TFile && item.extension === "md") {
					try {
						const content = await this.app.vault.read(item);
						this.addNoteNode(item.path, content, dropX + offsetIndex * 30, dropY + offsetIndex * 30);
						offsetIndex++;
					} catch {}
				}
			}
		});
	}

	private updateSelectionFromBox(left: number, top: number, width: number, height: number): void {
		// Convert screen coords to canvas coords
		const boxLeft = (left - this.panX) / this.scale;
		const boxTop = (top - this.panY) / this.scale;
		const boxRight = (left + width - this.panX) / this.scale;
		const boxBottom = (top + height - this.panY) / this.scale;

		for (const [nodeId, node] of this.nodes) {
			const nodeRight = node.x + node.width;
			const nodeBottom = node.y + node.height;

			// Check intersection
			const intersects =
				node.x < boxRight &&
				nodeRight > boxLeft &&
				node.y < boxBottom &&
				nodeBottom > boxTop;

			if (intersects) {
				this.selectNode(nodeId);
			} else {
				this.deselectNode(nodeId);
			}
		}
	}

	private selectNode(nodeId: string): void {
		if (!this.selectedNodes.has(nodeId)) {
			this.selectedNodes.add(nodeId);
			const el = this.nodeElements.get(nodeId);
			if (el) {
				el.addClass("rabbitmap-node-selected");
			}
		}
	}

	private deselectNode(nodeId: string): void {
		if (this.selectedNodes.has(nodeId)) {
			this.selectedNodes.delete(nodeId);
			const el = this.nodeElements.get(nodeId);
			if (el) {
				el.removeClass("rabbitmap-node-selected");
			}
		}
	}

	private clearSelection(): void {
		for (const nodeId of this.selectedNodes) {
			const el = this.nodeElements.get(nodeId);
			if (el) {
				el.removeClass("rabbitmap-node-selected");
			}
		}
		this.selectedNodes.clear();
	}

	private deleteSelectedNodes(): void {
		for (const nodeId of this.selectedNodes) {
			this.nodes.delete(nodeId);
			this.chatMessages.delete(nodeId);
			this.chatStates.delete(nodeId);
			const el = this.nodeElements.get(nodeId);
			if (el) {
				el.remove();
				this.nodeElements.delete(nodeId);
			}
			// Remove edges connected to this node
			for (const [edgeId, edge] of this.edges) {
				if (edge.from === nodeId || edge.to === nodeId) {
					this.edges.delete(edgeId);
				}
			}
		}
		this.selectedNodes.clear();
		this.updateEdges();
		this.updateMinimap();
		this.triggerSave();
	}

	private isInputFocused(): boolean {
		const active = document.activeElement;
		return (
			active instanceof HTMLInputElement ||
			active instanceof HTMLTextAreaElement ||
			(active as HTMLElement)?.isContentEditable
		);
	}

	private zoom(delta: number): void {
		const factor = Math.exp(delta);
		const newScale = Math.min(Math.max(this.scale * factor, 0.1), 2);
		this.scale = newScale;
		this.updateTransform();
		this.triggerSave();
	}

	private zoomAtPoint(delta: number, clientX: number, clientY: number): void {
		const rect = this.canvas.getBoundingClientRect();
		const mouseX = clientX - rect.left;
		const mouseY = clientY - rect.top;

		const oldScale = this.scale;
		const factor = Math.exp(delta);
		const newScale = Math.min(Math.max(this.scale * factor, 0.1), 2);

		if (newScale !== oldScale) {
			this.panX = mouseX - ((mouseX - this.panX) * newScale) / oldScale;
			this.panY = mouseY - ((mouseY - this.panY) * newScale) / oldScale;
			this.scale = newScale;

			this.updateTransform();
			this.triggerSave();
		}
	}

	private resetView(): void {
		this.scale = 1;
		this.panX = 0;
		this.panY = 0;
		this.updateTransform();
		this.triggerSave();
	}

	private getContentBounds(): { minX: number; minY: number; maxX: number; maxY: number } | null {
		if (this.nodes.size === 0) return null;

		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

		for (const node of this.nodes.values()) {
			minX = Math.min(minX, node.x);
			minY = Math.min(minY, node.y);
			maxX = Math.max(maxX, node.x + node.width);
			maxY = Math.max(maxY, node.y + node.height);
		}

		return { minX, minY, maxX, maxY };
	}

	private clampPan(panX: number, panY: number): { x: number; y: number } {
		const bounds = this.getContentBounds();
		if (!bounds) return { x: panX, y: panY };

		const rect = this.canvas.getBoundingClientRect();
		const viewWidth = rect.width;
		const viewHeight = rect.height;

		// Ensure minimum effective content area so few nodes don't over-constrain panning
		const minContentSize = 2000;
		const effectiveWidth = Math.max(bounds.maxX - bounds.minX, minContentSize);
		const effectiveHeight = Math.max(bounds.maxY - bounds.minY, minContentSize);
		const centerX = (bounds.minX + bounds.maxX) / 2;
		const centerY = (bounds.minY + bounds.maxY) / 2;
		const effectiveBounds = {
			minX: centerX - effectiveWidth / 2,
			maxX: centerX + effectiveWidth / 2,
			minY: centerY - effectiveHeight / 2,
			maxY: centerY + effectiveHeight / 2,
		};

		// Allow content to go off-screen but keep at least 20% visible
		const keepVisible = 0.2;
		const contentWidth = (effectiveBounds.maxX - effectiveBounds.minX) * this.scale;
		const contentHeight = (effectiveBounds.maxY - effectiveBounds.minY) * this.scale;

		// Min visible amount
		const minVisibleX = Math.min(contentWidth * keepVisible, 100);
		const minVisibleY = Math.min(contentHeight * keepVisible, 100);

		const contentLeft = effectiveBounds.minX * this.scale;
		const contentRight = effectiveBounds.maxX * this.scale;
		const contentTop = effectiveBounds.minY * this.scale;
		const contentBottom = effectiveBounds.maxY * this.scale;

		// Content can go mostly off-screen but not completely
		const minPanX = minVisibleX - contentRight;
		const maxPanX = viewWidth - minVisibleX - contentLeft;
		const minPanY = minVisibleY - contentBottom;
		const maxPanY = viewHeight - minVisibleY - contentTop;

		return {
			x: Math.min(Math.max(panX, minPanX), maxPanX),
			y: Math.min(Math.max(panY, minPanY), maxPanY),
		};
	}

	private zoomToNode(nodeId: string): void {
		const node = this.nodes.get(nodeId);
		if (!node) return;

		const rect = this.canvas.getBoundingClientRect();
		const viewWidth = rect.width;
		const viewHeight = rect.height;

		// Calculate scale to fit node with padding
		const padding = 100;
		const scaleX = viewWidth / (node.width + padding * 2);
		const scaleY = viewHeight / (node.height + padding * 2);
		const targetScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.1), 2);

		// Center node in view
		const nodeCenterX = node.x + node.width / 2;
		const nodeCenterY = node.y + node.height / 2;

		const targetPanX = viewWidth / 2 - nodeCenterX * targetScale;
		const targetPanY = viewHeight / 2 - nodeCenterY * targetScale;

		// Animate to target
		this.animateTo(targetScale, targetPanX, targetPanY);
	}

	private showMenu(menu: Menu, e: MouseEvent): void {
		this.activeMenu?.close();
		this.activeMenu = menu;
		menu.showAtMouseEvent(e);
	}

	private showChatContextMenu(nodeId: string, e: MouseEvent): void {
		const menu = new Menu();

		const connectedNodes = this.getConnectedNodes(nodeId);
		if (connectedNodes.length > 0) {
			menu.addItem((item) => {
				item.setTitle("Analyze connections")
					.setIcon("scan-search")
					.onClick(() => {
						this.analyzeConnections(nodeId);
					});
			});
			menu.addSeparator();
		}

		menu.addItem((item) => {
			item.setTitle("Branch")
				.setIcon("git-branch")
				.onClick(() => {
					this.branchChat(nodeId);
				});
		});

		menu.addItem((item) => {
			item.setTitle("Fork")
				.setIcon("git-fork")
				.onClick(() => {
					this.forkChat(nodeId);
				});
		});

		this.showMenu(menu, e);
	}

	private analyzeConnections(nodeId: string): void {
		const connectedNodes = this.getConnectedNodes(nodeId);
		if (connectedNodes.length === 0) return;

		const chatState = this.chatStates.get(nodeId);
		if (!chatState) return;

		chatState.contextNodes = connectedNodes;
		this.chatStates.set(nodeId, chatState);

		// Re-render the chat node to show connected nodes in context area
		const nodeEl = this.nodeElements.get(nodeId);
		if (nodeEl) {
			const content = nodeEl.querySelector(".rabbitmap-node-content");
			if (content) {
				content.empty();
				this.renderChatContent(nodeId, content as HTMLElement);
			}
		}

		// Focus the chat input
		setTimeout(() => {
			const input = nodeEl?.querySelector(".rabbitmap-chat-input") as HTMLTextAreaElement;
			if (input) input.focus();
		}, 100);

		this.triggerSave();
		new Notice(`Added ${connectedNodes.length} connected node(s) as context`);
	}

	private branchChat(nodeId: string, upToMsgIndex?: number): void {
		const sourceNode = this.nodes.get(nodeId);
		const sourceState = this.chatStates.get(nodeId);
		const sourceMessages = this.chatMessages.get(nodeId);
		if (!sourceNode || !sourceState) return;

		// Find free position
		const pos = this.findFreePosition(sourceNode);

		// Create new node with branch suffix
		const baseTitle = sourceNode.title || "Chat";
		const newNode: CanvasNode = {
			id: this.generateId(),
			x: pos.x,
			y: pos.y,
			width: sourceNode.width,
			height: sourceNode.height,
			type: "chat",
			content: "",
			title: `${baseTitle} (branch)`,
		};

		// Copy state
		const newState: ChatNodeState = {
			provider: sourceState.provider,
			model: sourceState.model,
			contextFiles: [...sourceState.contextFiles],
			contextNodes: [...(sourceState.contextNodes || [])],
			systemPrompt: sourceState.systemPrompt,
			contextTemplate: sourceState.contextTemplate,
		};

		// Copy messages up to specified index (or all if not specified)
		let newMessages: ChatMessage[] = [];
		if (sourceMessages) {
			if (upToMsgIndex !== undefined) {
				newMessages = sourceMessages.slice(0, upToMsgIndex + 1);
			} else {
				newMessages = [...sourceMessages];
			}
		}

		this.nodes.set(newNode.id, newNode);
		this.chatStates.set(newNode.id, newState);
		this.chatMessages.set(newNode.id, newMessages);
		this.renderNode(newNode);

		// Add edge from source to new node
		this.addEdge(nodeId, newNode.id);

		this.updateMinimap();
		this.triggerSave();

		// Zoom to new node, scroll to last message, and focus input
		this.zoomToNode(newNode.id);
		this.scrollChatToBottom(newNode.id);
		this.focusChatInput(newNode.id);
	}

	private scrollChatToBottom(nodeId: string): void {
		const nodeEl = this.nodeElements.get(nodeId);
		if (!nodeEl) return;

		const messagesContainer = nodeEl.querySelector(".rabbitmap-chat-messages") as HTMLElement;
		if (messagesContainer) {
			// Use setTimeout to ensure DOM is ready after render
			setTimeout(() => {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			}, 50);
		}
	}

	private focusChatInput(nodeId: string): void {
		const nodeEl = this.nodeElements.get(nodeId);
		if (!nodeEl) return;

		// Use setTimeout to ensure DOM and animations are ready
		setTimeout(() => {
			const input = nodeEl.querySelector(".rabbitmap-chat-input") as HTMLTextAreaElement;
			if (input) {
				input.focus();
			}
		}, 350); // After zoom animation (300ms)
	}

	// Public methods for ExpandedChatModal
	getNode(nodeId: string): CanvasNode | undefined {
		return this.nodes.get(nodeId);
	}

	getChatState(nodeId: string): ChatNodeState | undefined {
		return this.chatStates.get(nodeId);
	}

	getChatMessages(nodeId: string): ChatMessage[] | undefined {
		return this.chatMessages.get(nodeId);
	}

	private openExpandedChat(nodeId: string): void {
		new ExpandedChatModal(this.app, this, nodeId).open();
	}

	async sendChatMessage(nodeId: string, text: string): Promise<void> {
		const chatState = this.chatStates.get(nodeId);
		if (!chatState) return;

		const msg: ChatMessage = {
			role: "user",
			content: text,
			contextFiles: chatState.contextFiles ? [...chatState.contextFiles] : [],
			contextNodes: chatState.contextNodes ? [...chatState.contextNodes] : []
		};

		const messages = this.chatMessages.get(nodeId) || [];
		messages.push(msg);
		this.chatMessages.set(nodeId, messages);

		// Update node UI
		this.refreshChatNode(nodeId);
		this.triggerSave();

		// Get provider
		const provider = this.plugin.settings.providers.find(p => p.name === chatState.provider);
		if (!provider) return;

		// Get API key from provider config (with fallback to legacy fields for migration)
		let apiKey = provider.apiKey || "";
		if (!apiKey) {
			// Fallback to legacy API key fields for backward compatibility
			if (chatState.provider === "OpenAI" && this.plugin.settings.openaiApiKey) {
				apiKey = this.plugin.settings.openaiApiKey;
			} else if (chatState.provider === "OpenRouter" && this.plugin.settings.openrouterApiKey) {
				apiKey = this.plugin.settings.openrouterApiKey;
			}
		}

		if (!apiKey) {
			const errorMsg: ChatMessage = {
				role: "assistant",
				content: `Please set your ${chatState.provider} API key in settings.`,
			};
			messages.push(errorMsg);
			this.refreshChatNode(nodeId);
			this.triggerSave();
			return;
		}

		// Load context
		let contextContent = "";
		if (chatState.contextFiles && chatState.contextFiles.length > 0) {
			const template = chatState.contextTemplate || DEFAULT_CONTEXT_TEMPLATE;
			const contextParts: string[] = [];
			for (const filePath of chatState.contextFiles) {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (file && file instanceof TFile) {
					try {
						const content = await this.app.vault.read(file);
						const formatted = template
							.replace(/\{filepath\}/g, filePath)
							.replace(/\{filename\}/g, file.name)
							.replace(/\{content\}/g, content);
						contextParts.push(formatted);
					} catch {}
				}
			}
			if (contextParts.length > 0) {
				contextContent = "Context files:\n\n" + contextParts.join("\n\n");
			}
		}

		// Load connected node context
		if (chatState.contextNodes && chatState.contextNodes.length > 0) {
			const nodeContent = this.getConnectedContent(chatState.contextNodes);
			if (nodeContent) {
				contextContent = contextContent
					? contextContent + "\n\n" + nodeContent
					: nodeContent;
			}
		}

		try {
			const response = await this.callLLM(provider, apiKey, chatState.model, messages, contextContent, chatState.systemPrompt || "");
			const assistantMsg: ChatMessage = {
				role: "assistant",
				content: response,
			};
			messages.push(assistantMsg);
			this.refreshChatNode(nodeId);
			this.triggerSave();
		} catch (error) {
			const errorMsg: ChatMessage = {
				role: "assistant",
				content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
			messages.push(errorMsg);
			this.refreshChatNode(nodeId);
			this.triggerSave();
		}
	}

	private refreshChatNode(nodeId: string): void {
		const nodeEl = this.nodeElements.get(nodeId);
		if (!nodeEl) return;

		const messagesContainer = nodeEl.querySelector(".rabbitmap-chat-messages") as HTMLElement;
		if (!messagesContainer) return;

		messagesContainer.empty();
		const messages = this.chatMessages.get(nodeId) || [];
		messages.forEach((msg, index) => {
			this.renderChatMessage(messagesContainer, msg, nodeId, index);
		});
		messagesContainer.scrollTop = messagesContainer.scrollHeight;
	}

	private async exportChatToMd(node: CanvasNode): Promise<void> {
		const messages = this.chatMessages.get(node.id) || [];
		if (messages.length === 0) {
			new Notice("No messages to export");
			return;
		}

		const chatState = this.chatStates.get(node.id);
		const title = node.title || "Chat";

		// Build markdown content
		let md = `# ${title}\n\n`;

		if (chatState) {
			md += `> **Model:** ${chatState.provider} / ${chatState.model}\n\n`;
		}

		md += `---\n\n`;

		for (const msg of messages) {
			if (msg.role === "user") {
				md += `## User\n\n`;
				// Show context for this specific message
				if (msg.contextFiles && msg.contextFiles.length > 0) {
					md += `> **Context:** `;
					md += msg.contextFiles.map(f => `[[${f}]]`).join(", ");
					md += `\n\n`;
				}
				md += `${msg.content}\n\n`;
			} else {
				md += `## Assistant\n\n${msg.content}\n\n`;
			}
		}

		// Get folder path from current file
		const folder = this.file?.parent?.path || "";
		const now = new Date();
		const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		const hours = now.getHours();
		const ampm = hours >= 12 ? "PM" : "AM";
		const hours12 = hours % 12 || 12;
		const timestamp = `${now.getFullYear()} ${months[now.getMonth()]} ${now.getDate()} ${hours12}-${String(now.getMinutes()).padStart(2, "0")} ${ampm}`;
		const fileName = `${title.replace(/[\\/:*?"<>|]/g, "-")} ${timestamp}`;
		const filePath = folder ? `${folder}/${fileName}.md` : `${fileName}.md`;

		const file = await this.app.vault.create(filePath, md);
		new Notice(`Saved to ${filePath}`);

		// Open the file in a new tab
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.openFile(file);
	}

	private showTitleEditor(node: CanvasNode, titleSpan: HTMLElement, container: HTMLElement): void {
		const currentTitle = node.title || (node.type === "chat" ? "Chat" : "Card");

		// Hide title span
		titleSpan.style.display = "none";

		// Create input
		const input = container.createEl("input", {
			cls: "rabbitmap-title-input",
			attr: { type: "text", value: currentTitle }
		});
		input.value = currentTitle;
		input.focus();
		input.select();

		const finishEdit = () => {
			const newTitle = input.value.trim();
			if (newTitle && newTitle !== currentTitle) {
				node.title = newTitle;
				titleSpan.setText(newTitle);
				this.triggerSave();
			}
			input.remove();
			titleSpan.style.display = "";
		};

		input.addEventListener("blur", finishEdit);
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				input.blur();
			}
			if (e.key === "Escape") {
				input.value = currentTitle;
				input.blur();
			}
		});
	}

	private forkChat(nodeId: string): void {
		const sourceNode = this.nodes.get(nodeId);
		const sourceState = this.chatStates.get(nodeId);
		if (!sourceNode || !sourceState) return;

		// Find free position
		const pos = this.findFreePosition(sourceNode);

		// Create new node with fork suffix
		const baseTitle = sourceNode.title || "Chat";
		const newNode: CanvasNode = {
			id: this.generateId(),
			x: pos.x,
			y: pos.y,
			width: sourceNode.width,
			height: sourceNode.height,
			type: "chat",
			content: "",
			title: `${baseTitle} (fork)`,
		};

		// Copy state (context, prompts, model) but NOT messages
		const newState: ChatNodeState = {
			provider: sourceState.provider,
			model: sourceState.model,
			contextFiles: [...sourceState.contextFiles],
			contextNodes: [...(sourceState.contextNodes || [])],
			systemPrompt: sourceState.systemPrompt,
			contextTemplate: sourceState.contextTemplate,
		};

		this.nodes.set(newNode.id, newNode);
		this.chatStates.set(newNode.id, newState);
		this.chatMessages.set(newNode.id, []); // Empty messages
		this.renderNode(newNode);

		// Add edge from source to new node
		this.addEdge(nodeId, newNode.id);

		this.updateMinimap();
		this.triggerSave();

		// Zoom to new node and focus input
		this.zoomToNode(newNode.id);
		this.focusChatInput(newNode.id);
	}

	private findFreePosition(sourceNode: CanvasNode): { x: number; y: number } {
		const gap = 50; // Gap between nodes

		// Try right position first
		const rightX = sourceNode.x + sourceNode.width + gap;
		const rightY = sourceNode.y;

		if (!this.isPositionOccupied(rightX, rightY, sourceNode.width, sourceNode.height)) {
			return { x: rightX, y: rightY };
		}

		// Find blocking node on the right and place below it
		const blockingNode = this.findBlockingNode(rightX, rightY, sourceNode.width, sourceNode.height);
		if (blockingNode) {
			const belowBlockingY = blockingNode.y + blockingNode.height + gap;
			if (!this.isPositionOccupied(rightX, belowBlockingY, sourceNode.width, sourceNode.height)) {
				return { x: rightX, y: belowBlockingY };
			}
		}

		// Keep trying further down on the right side
		let tryY = rightY + sourceNode.height + gap;
		for (let i = 0; i < 5; i++) {
			if (!this.isPositionOccupied(rightX, tryY, sourceNode.width, sourceNode.height)) {
				return { x: rightX, y: tryY };
			}
			const blocker = this.findBlockingNode(rightX, tryY, sourceNode.width, sourceNode.height);
			if (blocker) {
				tryY = blocker.y + blocker.height + gap;
			} else {
				tryY += sourceNode.height + gap;
			}
		}

		// Fallback: offset from source
		return { x: sourceNode.x + 60, y: sourceNode.y + 60 };
	}

	private findBlockingNode(x: number, y: number, width: number, height: number): CanvasNode | null {
		const padding = 20;

		for (const node of this.nodes.values()) {
			const overlaps =
				x < node.x + node.width + padding &&
				x + width + padding > node.x &&
				y < node.y + node.height + padding &&
				y + height + padding > node.y;

			if (overlaps) return node;
		}
		return null;
	}

	private isPositionOccupied(x: number, y: number, width: number, height: number): boolean {
		const padding = 20; // Minimum gap

		for (const node of this.nodes.values()) {
			// Check if rectangles overlap
			const overlaps =
				x < node.x + node.width + padding &&
				x + width + padding > node.x &&
				y < node.y + node.height + padding &&
				y + height + padding > node.y;

			if (overlaps) return true;
		}
		return false;
	}

	// --- Connection Analysis Utilities ---

	private getConnectedNodes(nodeId: string): string[] {
		const connected = new Set<string>();
		for (const edge of this.edges.values()) {
			if (edge.from === nodeId) connected.add(edge.to);
			if (edge.to === nodeId) connected.add(edge.from);
		}
		return Array.from(connected);
	}

	private getNodeContent(nodeId: string): string {
		const node = this.nodes.get(nodeId);
		if (!node) return "";

		switch (node.type) {
			case "card":
				return `[Card: ${node.title || "Untitled"}]\n${node.content || ""}`;

			case "link": {
				const parts: string[] = [`[Link: ${node.linkTitle || node.url || "Untitled"}]`];
				if (node.url) parts.push(`URL: ${node.url}`);
				if (node.linkDescription) parts.push(node.linkDescription);
				if (node.linkContent) {
					const content = node.linkContent.length > 4000
						? node.linkContent.slice(0, 4000) + "\n... [truncated]"
						: node.linkContent;
					parts.push(content);
				}
				return parts.join("\n");
			}

			case "note":
				return `[Note: ${node.filePath || node.title || "Untitled"}]\n${node.content || ""}`;

			case "chat": {
				const messages = this.chatMessages.get(nodeId) || [];
				const recent = messages.slice(-10);
				let summary = `[Chat: ${node.title || "Chat"}]\n`;
				summary += recent.map(m => `${m.role}: ${m.content}`).join("\n");
				if (summary.length > 4000) {
					summary = summary.slice(0, 4000) + "\n... [truncated]";
				}
				return summary;
			}

			default:
				return node.content || "";
		}
	}

	private getConnectedContent(nodeIds: string[]): string {
		const parts = nodeIds
			.map(id => this.getNodeContent(id))
			.filter(content => content.length > 0);
		if (parts.length === 0) return "";
		return "Connected nodes:\n\n" + parts.join("\n\n---\n\n");
	}

	private addEdge(fromId: string, toId: string): void {
		const edge: Edge = {
			id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			from: fromId,
			to: toId,
		};
		this.edges.set(edge.id, edge);
		this.renderEdge(edge);

		// Auto-add connected node as context if one side is a chat node
		this.addEdgeContext(fromId, toId);
		this.addEdgeContext(toId, fromId);
	}

	private addEdgeContext(chatNodeId: string, otherNodeId: string): void {
		const chatNode = this.nodes.get(chatNodeId);
		if (!chatNode || chatNode.type !== "chat") return;

		const chatState = this.chatStates.get(chatNodeId);
		if (!chatState) return;

		if (!chatState.contextNodes) chatState.contextNodes = [];
		if (!chatState.contextNodes.includes(otherNodeId)) {
			chatState.contextNodes.push(otherNodeId);
			this.chatStates.set(chatNodeId, chatState);

			// Re-render chat node to show new context chip
			const nodeEl = this.nodeElements.get(chatNodeId);
			if (nodeEl) {
				const content = nodeEl.querySelector(".rabbitmap-node-content");
				if (content) {
					content.empty();
					this.renderChatContent(chatNodeId, content as HTMLElement);
				}
			}
			this.triggerSave();
		}
	}

	private renderAllEdges(): void {
		// Clear existing edge elements
		this.edgesContainer.innerHTML = "";

		for (const edge of this.edges.values()) {
			this.renderEdge(edge);
		}
	}

	private renderEdge(edge: Edge): void {
		const fromNode = this.nodes.get(edge.from);
		const toNode = this.nodes.get(edge.to);
		if (!fromNode || !toNode) return;

		// Calculate connection points
		const fromCenterX = fromNode.x + fromNode.width / 2;
		const fromCenterY = fromNode.y + fromNode.height / 2;
		const toCenterX = toNode.x + toNode.width / 2;
		const toCenterY = toNode.y + toNode.height / 2;

		// Determine which sides to connect
		let fromX: number, fromY: number, toX: number, toY: number;

		const dx = toCenterX - fromCenterX;
		const dy = toCenterY - fromCenterY;

		const arrowSize = 14;

		if (Math.abs(dx) > Math.abs(dy)) {
			// Horizontal connection
			if (dx > 0) {
				// To is on the right
				fromX = fromNode.x + fromNode.width;
				fromY = fromCenterY;
				toX = toNode.x;
				toY = toCenterY;
			} else {
				// To is on the left
				fromX = fromNode.x;
				fromY = fromCenterY;
				toX = toNode.x + toNode.width;
				toY = toCenterY;
			}
		} else {
			// Vertical connection
			if (dy > 0) {
				// To is below
				fromX = fromCenterX;
				fromY = fromNode.y + fromNode.height;
				toX = toCenterX;
				toY = toNode.y;
			} else {
				// To is above
				fromX = fromCenterX;
				fromY = fromNode.y;
				toX = toCenterX;
				toY = toNode.y + toNode.height;
			}
		}

		// Create group for edge
		const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
		group.setAttribute("id", edge.id);

		// Create path element
		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
		path.setAttribute("class", "rabbitmap-edge");

		// Create a curved path
		const midX = (fromX + toX) / 2;
		const midY = (fromY + toY) / 2;

		// Bezier curve control points
		let cx1: number, cy1: number, cx2: number, cy2: number;

		if (Math.abs(dx) > Math.abs(dy)) {
			// Horizontal: curve horizontally
			cx1 = midX;
			cy1 = fromY;
			cx2 = midX;
			cy2 = toY;
		} else {
			// Vertical: curve vertically
			cx1 = fromX;
			cy1 = midY;
			cx2 = toX;
			cy2 = midY;
		}

		const d = `M ${fromX} ${fromY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${toX} ${toY}`;
		path.setAttribute("d", d);

		// Hit area (invisible, wider stroke for easier clicking)
		const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "path");
		hitArea.setAttribute("d", d);
		hitArea.setAttribute("class", "rabbitmap-edge-hitarea");
		hitArea.setAttribute("data-edge-id", edge.id);
		group.appendChild(hitArea);
		group.appendChild(path);

		// Edge hover and context menu
		group.style.pointerEvents = "auto";
		group.addEventListener("mouseenter", () => {
			path.classList.add("rabbitmap-edge-hover");
		});
		group.addEventListener("mouseleave", () => {
			path.classList.remove("rabbitmap-edge-hover");
		});
		group.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.showEdgeContextMenu(edge.id, e as MouseEvent);
		});

		// Calculate arrow direction from curve end tangent
		// Tangent at t=1 for cubic bezier: 3*(P3-P2) = 3*(toX-cx2, toY-cy2)
		const tangentX = toX - cx2;
		const tangentY = toY - cy2;
		const len = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
		const normX = tangentX / len;
		const normY = tangentY / len;

		// Arrow points
		const arrowTipX = toX;
		const arrowTipY = toY;
		const arrowBaseX = toX - normX * arrowSize;
		const arrowBaseY = toY - normY * arrowSize;

		// Perpendicular for arrow width
		const perpX = -normY * (arrowSize / 2);
		const perpY = normX * (arrowSize / 2);

		const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
		const points = `${arrowTipX},${arrowTipY} ${arrowBaseX + perpX},${arrowBaseY + perpY} ${arrowBaseX - perpX},${arrowBaseY - perpY}`;
		arrow.setAttribute("points", points);
		arrow.setAttribute("class", "rabbitmap-arrow");
		group.appendChild(arrow);

		this.edgesContainer.appendChild(group);
	}

	private updateEdges(): void {
		this.renderAllEdges();
	}

	private getHandlePosition(node: CanvasNode, side: "top" | "right" | "bottom" | "left"): { x: number; y: number } {
		switch (side) {
			case "top": return { x: node.x + node.width / 2, y: node.y };
			case "right": return { x: node.x + node.width, y: node.y + node.height / 2 };
			case "bottom": return { x: node.x + node.width / 2, y: node.y + node.height };
			case "left": return { x: node.x, y: node.y + node.height / 2 };
		}
	}

	private startEdgeDrawing(nodeId: string, side: "top" | "right" | "bottom" | "left", e: MouseEvent): void {
		this.isDrawingEdge = true;
		this.edgeDrawFromNode = nodeId;
		this.edgeDrawFromSide = side;
		this.canvas.addClass("drawing-edge");

		const node = this.nodes.get(nodeId);
		if (!node) return;
		const anchor = this.getHandlePosition(node, side);

		const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
		line.setAttribute("x1", String(anchor.x));
		line.setAttribute("y1", String(anchor.y));
		line.setAttribute("x2", String(anchor.x));
		line.setAttribute("y2", String(anchor.y));
		line.setAttribute("class", "rabbitmap-edge-temp");
		this.edgesContainer.appendChild(line);
		this.edgeDrawTempLine = line;
	}

	private findTargetHandle(e: MouseEvent): { nodeId: string; side: string } | null {
		// First try elementFromPoint (exact hit)
		const el = document.elementFromPoint(e.clientX, e.clientY);
		if (el) {
			const handle = (el as HTMLElement).closest(".rabbitmap-connection-handle") as HTMLElement | null;
			if (handle) {
				const nodeId = handle.getAttribute("data-node-id");
				const side = handle.getAttribute("data-side");
				if (nodeId && side) return { nodeId, side };
			}
		}

		// Fallback: proximity-based — find nearest handle within 30px
		const rect = this.canvas.getBoundingClientRect();
		const canvasX = (e.clientX - rect.left - this.panX) / this.scale;
		const canvasY = (e.clientY - rect.top - this.panY) / this.scale;
		const threshold = 30;
		let best: { nodeId: string; side: string; dist: number } | null = null;
		const sides: Array<"top" | "right" | "bottom" | "left"> = ["top", "right", "bottom", "left"];

		for (const node of this.nodes.values()) {
			if (node.id === this.edgeDrawFromNode) continue;
			for (const side of sides) {
				const pos = this.getHandlePosition(node, side);
				const dist = Math.sqrt((canvasX - pos.x) ** 2 + (canvasY - pos.y) ** 2);
				if (dist < threshold && (!best || dist < best.dist)) {
					best = { nodeId: node.id, side, dist };
				}
			}
		}
		if (best) return { nodeId: best.nodeId, side: best.side };

		// Last resort: check if cursor is over any node body
		for (const node of this.nodes.values()) {
			if (node.id === this.edgeDrawFromNode) continue;
			if (canvasX >= node.x && canvasX <= node.x + node.width &&
				canvasY >= node.y && canvasY <= node.y + node.height) {
				// Pick the closest side
				const distances = sides.map(side => {
					const pos = this.getHandlePosition(node, side);
					return { side, dist: Math.sqrt((canvasX - pos.x) ** 2 + (canvasY - pos.y) ** 2) };
				});
				distances.sort((a, b) => a.dist - b.dist);
				return { nodeId: node.id, side: distances[0].side };
			}
		}
		return null;
	}

	private showEdgeContextMenu(edgeId: string, e: MouseEvent): void {
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle("Delete connection")
				.setIcon("trash-2")
				.onClick(() => {
					this.deleteEdge(edgeId);
				});
		});
		this.showMenu(menu, e);
	}

	private deleteEdge(edgeId: string): void {
		this.edges.delete(edgeId);
		this.renderAllEdges();
		this.triggerSave();
	}

	private animateTo(targetScale: number, targetPanX: number, targetPanY: number): void {
		const startScale = this.scale;
		const startPanX = this.panX;
		const startPanY = this.panY;
		const duration = 300;
		const startTime = performance.now();

		const animate = (currentTime: number) => {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);

			// Ease out cubic
			const eased = 1 - Math.pow(1 - progress, 3);

			this.scale = startScale + (targetScale - startScale) * eased;
			this.panX = startPanX + (targetPanX - startPanX) * eased;
			this.panY = startPanY + (targetPanY - startPanY) * eased;

			this.updateTransform();

			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				this.triggerSave();
			}
		};

		requestAnimationFrame(animate);
	}

	private updateTransform(): void {
		if (this.nodesContainer) {
			this.nodesContainer.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
		}
		// Transform edges container same as nodes
		if (this.edgesContainer) {
			this.edgesContainer.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
		}
		// Move grid with pan/zoom
		if (this.canvas) {
			const gridSize = 20 * this.scale;
			this.canvas.style.backgroundSize = `${gridSize}px ${gridSize}px`;
			this.canvas.style.backgroundPosition = `${this.panX}px ${this.panY}px`;
		}
		this.updateMinimap();
	}

	private generateId(): string {
		return "node-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
	}

	private addNode(node: CanvasNode, save: boolean = true): void {
		this.nodes.set(node.id, node);

		if (node.type === "chat") {
			if (!this.chatMessages.has(node.id)) {
				this.chatMessages.set(node.id, []);
			}
			if (!this.chatStates.has(node.id)) {
				const defaultProvider = this.plugin.settings.providers[0];
				this.chatStates.set(node.id, {
					provider: defaultProvider.name,
					model: defaultProvider.models[0],
					contextFiles: [],
					contextNodes: [],
					systemPrompt: DEFAULT_SYSTEM_PROMPT,
					contextTemplate: DEFAULT_CONTEXT_TEMPLATE
				});
			}
		}

		this.renderNode(node);

		if (save) {
			this.triggerSave();
		}
	}

	private renderNode(node: CanvasNode): void {
		if (!this.nodesContainer) return;

		const el = this.nodesContainer.createDiv({
			cls: `rabbitmap-node rabbitmap-node-${node.type}`,
		});
		el.style.left = `${node.x}px`;
		el.style.top = `${node.y}px`;
		el.style.width = `${node.width}px`;
		el.style.height = `${node.height}px`;

		// Header for dragging
		const header = el.createDiv({ cls: "rabbitmap-node-header" });

		const titleContainer = header.createDiv({ cls: "rabbitmap-node-title-container" });
		const defaultTitle = node.type === "chat" ? "Chat" : node.type === "link" ? (node.linkTitle || "Link") : node.type === "note" ? (node.title || "Note") : "Card";
		const titleSpan = titleContainer.createSpan({
			text: node.title || defaultTitle,
			cls: "rabbitmap-node-title"
		});

		// Edit title button (pencil icon)
		const editTitleBtn = titleContainer.createEl("button", { cls: "rabbitmap-edit-title-btn" });
		editTitleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;

		editTitleBtn.onclick = (e) => {
			e.stopPropagation();
			this.showTitleEditor(node, titleSpan, titleContainer);
		};

		// Export to MD button (only for chat nodes)
		if (node.type === "chat") {
			const exportBtn = titleContainer.createEl("button", { cls: "rabbitmap-export-btn" });
			exportBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
			exportBtn.title = "Save as MD";

			exportBtn.onclick = (e) => {
				e.stopPropagation();
				this.exportChatToMd(node);
			};

			// Expand chat button
			const expandBtn = titleContainer.createEl("button", { cls: "rabbitmap-expand-btn" });
			expandBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
			expandBtn.title = "Expand chat";

			expandBtn.onclick = (e) => {
				e.stopPropagation();
				this.openExpandedChat(node.id);
			};
		}

		// Delete button
		const deleteBtn = header.createEl("button", { text: "×", cls: "rabbitmap-delete-btn" });
		deleteBtn.onclick = (e) => {
			e.stopPropagation();
			this.deleteNode(node.id);
		};

		// Make header draggable
		header.addEventListener("mousedown", (e) => {
			if (e.button === 0 && !this.spacePressed) {
				e.stopPropagation();

				// Handle selection
				if (e.shiftKey) {
					// Toggle selection with shift
					if (this.selectedNodes.has(node.id)) {
						this.deselectNode(node.id);
					} else {
						this.selectNode(node.id);
					}
				} else if (!this.selectedNodes.has(node.id)) {
					// Click on unselected node - clear others and select this one
					this.clearSelection();
					this.selectNode(node.id);
				}

				// Start drag
				this.draggedNode = node.id;
				const rect = el.getBoundingClientRect();
				this.dragOffsetX = (e.clientX - rect.left) / this.scale;
				this.dragOffsetY = (e.clientY - rect.top) / this.scale;

				// Store start mouse position in canvas coords
				const canvasRect = this.canvas.getBoundingClientRect();
				this.dragStartMouseX = (e.clientX - canvasRect.left - this.panX) / this.scale;
				this.dragStartMouseY = (e.clientY - canvasRect.top - this.panY) / this.scale;

				// Store start positions for all selected nodes
				this.dragStartPositions.clear();
				for (const nodeId of this.selectedNodes) {
					const n = this.nodes.get(nodeId);
					if (n) {
						this.dragStartPositions.set(nodeId, { x: n.x, y: n.y });
					}
				}
			}
		});

		// Double-click to zoom to node
		header.addEventListener("dblclick", (e) => {
			e.stopPropagation();
			this.zoomToNode(node.id);
		});

		// Right-click context menu
		el.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			e.stopPropagation();

			// Multi-select context menu takes priority
			if (this.selectedNodes.size >= 2 && this.selectedNodes.has(node.id)) {
				this.showMultiSelectContextMenu(e);
				return;
			}

			if (node.type === "chat") {
				this.showChatContextMenu(node.id, e);
			} else if (node.type === "link") {
				this.showLinkContextMenu(node.id, e);
			} else if (node.type === "note") {
				this.showNoteContextMenu(node.id, e);
			}
		});

		// Content area
		const content = el.createDiv({ cls: "rabbitmap-node-content" });

		if (node.type === "chat") {
			this.renderChatContent(node.id, content);
		} else if (node.type === "link") {
			this.renderLinkContent(node, content);
		} else if (node.type === "note") {
			this.renderNoteContent(node, content);
		} else {
			this.renderCardContent(node, content);
		}

		// Connection handles
		const sides: Array<"top" | "right" | "bottom" | "left"> = ["top", "right", "bottom", "left"];
		for (const side of sides) {
			const handle = el.createDiv({ cls: `rabbitmap-connection-handle rabbitmap-handle-${side}` });
			handle.setAttribute("data-node-id", node.id);
			handle.setAttribute("data-side", side);
			handle.addEventListener("mousedown", (e) => {
				if (e.button !== 0) return;
				e.stopPropagation();
				e.preventDefault();
				this.startEdgeDrawing(node.id, side, e);
			});
		}

		// Resize handle
		const resizeHandle = el.createDiv({ cls: "rabbitmap-resize-handle" });
		resizeHandle.addEventListener("mousedown", (e) => {
			if (e.button === 0) {
				e.stopPropagation();
				e.preventDefault();
				this.resizingNode = node.id;
				this.resizeStartWidth = node.width;
				this.resizeStartHeight = node.height;
				this.resizeStartX = e.clientX;
				this.resizeStartY = e.clientY;
			}
		});

		this.nodeElements.set(node.id, el);
	}

	private renderLinkContent(node: CanvasNode, container: HTMLElement): void {
		container.addClass("rabbitmap-link-content");

		// Thumbnail / image
		if (node.linkImage) {
			const imgWrap = container.createDiv({ cls: "rabbitmap-link-thumbnail" });
			const img = imgWrap.createEl("img", { attr: { src: node.linkImage, alt: node.linkTitle || "" } });
			img.addEventListener("error", () => {
				imgWrap.remove();
			});
		}

		const info = container.createDiv({ cls: "rabbitmap-link-info" });

		// Title
		const title = info.createDiv({
			cls: "rabbitmap-link-title",
			text: node.linkTitle || "Loading...",
		});

		// URL
		if (node.url) {
			let displayUrl = node.url;
			try {
				const parsed = new URL(node.url);
				displayUrl = parsed.hostname + (parsed.pathname !== "/" ? parsed.pathname : "");
			} catch {}
			info.createDiv({
				cls: "rabbitmap-link-url",
				text: displayUrl,
			});
		}

		// Description
		if (node.linkDescription) {
			info.createDiv({
				cls: "rabbitmap-link-description",
				text: node.linkDescription,
			});
		}

		// Loading state
		if (node.linkTitle === "Loading...") {
			const spinner = info.createDiv({ cls: "rabbitmap-link-loading" });
			spinner.createSpan({ text: "Fetching content..." });
		}

		// Open button
		const openBtn = container.createEl("button", {
			cls: "rabbitmap-link-open-btn",
			text: "Open Link",
		});
		openBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			if (node.url) {
				window.open(node.url, "_blank");
			}
		});

		// Prevent wheel events from bubbling
		container.addEventListener("wheel", (e) => {
			e.stopPropagation();
		});
	}

	private showLinkContextMenu(nodeId: string, e: MouseEvent): void {
		const node = this.nodes.get(nodeId);
		if (!node) return;

		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle("Open URL")
				.setIcon("external-link")
				.onClick(() => {
					if (node.url) window.open(node.url, "_blank");
				});
		});

		menu.addItem((item) => {
			item.setTitle("Refresh metadata")
				.setIcon("refresh-cw")
				.onClick(() => {
					if (node.url) {
						node.linkTitle = "Loading...";
						node.linkDescription = "";
						node.linkImage = undefined;
						node.linkContent = undefined;
						this.rerenderNode(nodeId);
						this.fetchLinkMetadata(node.url, nodeId);
					}
				});
		});

		menu.addItem((item) => {
			item.setTitle("Copy URL")
				.setIcon("copy")
				.onClick(() => {
					if (node.url) {
						navigator.clipboard.writeText(node.url);
						new Notice("URL copied to clipboard");
					}
				});
		});

		this.showMenu(menu, e);
	}

	private showNoteContextMenu(nodeId: string, e: MouseEvent): void {
		const node = this.nodes.get(nodeId);
		if (!node) return;

		const menu = new Menu();

		if (node.filePath) {
			menu.addItem((item) => {
				item.setTitle("Open in Obsidian")
					.setIcon("file-text")
					.onClick(() => {
						this.app.workspace.openLinkText(node.filePath!, "", false);
					});
			});

			menu.addItem((item) => {
				item.setTitle("Refresh from file")
					.setIcon("refresh-cw")
					.onClick(async () => {
						const file = this.app.vault.getAbstractFileByPath(node.filePath!);
						if (file instanceof TFile) {
							const content = await this.app.vault.read(file);
							node.content = content;
							this.rerenderNode(nodeId);
							this.triggerSave();
							new Notice("Note refreshed from file");
						} else {
							new Notice("Source file not found");
						}
					});
			});
		}

		menu.addItem((item) => {
			item.setTitle("Copy content")
				.setIcon("copy")
				.onClick(() => {
					navigator.clipboard.writeText(node.content);
					new Notice("Content copied to clipboard");
				});
		});

		this.showMenu(menu, e);
	}

	private showMultiSelectContextMenu(e: MouseEvent): void {
		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle("Summarize selected with AI")
				.setIcon("sparkles")
				.onClick(() => {
					this.summarizeSelected();
				});
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item.setTitle("Delete selected")
				.setIcon("trash")
				.onClick(() => {
					this.deleteSelectedNodes();
				});
		});

		this.showMenu(menu, e);
	}

	private summarizeSelected(): void {
		const selectedIds = Array.from(this.selectedNodes);
		if (selectedIds.length < 2) return;

		// Calculate centroid of selected nodes and offset new chat node to the right
		let sumX = 0, sumY = 0, maxRight = 0;
		for (const id of selectedIds) {
			const n = this.nodes.get(id);
			if (n) {
				sumX += n.x;
				sumY += n.y;
				maxRight = Math.max(maxRight, n.x + n.width);
			}
		}
		const avgY = sumY / selectedIds.length;
		const newX = maxRight + 60;
		const newY = avgY;

		const defaultProvider = this.plugin.settings.providers[0];
		const newNode: CanvasNode = {
			id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
			x: newX,
			y: newY,
			width: 400,
			height: 500,
			type: "chat",
			content: "",
			title: "Analysis",
		};

		const newState: ChatNodeState = {
			provider: defaultProvider.name,
			model: defaultProvider.models[0],
			contextFiles: [],
			contextNodes: selectedIds,
			systemPrompt: DEFAULT_SYSTEM_PROMPT,
			contextTemplate: DEFAULT_CONTEXT_TEMPLATE,
		};

		this.nodes.set(newNode.id, newNode);
		this.chatStates.set(newNode.id, newState);
		this.chatMessages.set(newNode.id, []);
		this.renderNode(newNode);

		// Draw edges from new chat node to each selected node
		for (const id of selectedIds) {
			this.addEdge(newNode.id, id);
		}

		this.clearSelection();
		this.selectNode(newNode.id);
		this.zoomToNode(newNode.id);
		this.triggerSave();

		// Focus the chat input
		setTimeout(() => {
			const nodeEl = this.nodeElements.get(newNode.id);
			const input = nodeEl?.querySelector(".rabbitmap-chat-input") as HTMLTextAreaElement;
			if (input) input.focus();
		}, 200);

		new Notice(`Created analysis chat with ${selectedIds.length} connected nodes`);
	}

	private renderCardContent(node: CanvasNode, container: HTMLElement): void {
		const textarea = container.createEl("textarea", {
			cls: "rabbitmap-card-textarea",
			attr: { placeholder: "Write something..." },
		});
		textarea.value = node.content;
		textarea.addEventListener("input", () => {
			node.content = textarea.value;
			this.triggerSave();
		});
		// Prevent wheel events from bubbling to canvas
		textarea.addEventListener("wheel", (e) => {
			e.stopPropagation();
		});
	}

	private renderNoteContent(node: CanvasNode, container: HTMLElement): void {
		container.addClass("rabbitmap-note-content");

		// Rendered markdown area
		const markdownContainer = container.createDiv({ cls: "rabbitmap-note-markdown" });
		MarkdownRenderer.render(
			this.app,
			node.content,
			markdownContainer,
			node.filePath || "",
			new Component()
		);

		// Open in Obsidian button
		if (node.filePath) {
			const openBtn = container.createEl("button", {
				cls: "rabbitmap-note-open-btn",
				text: "Open in Obsidian",
			});
			openBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.app.workspace.openLinkText(node.filePath!, "", false);
			});
		}

		// Prevent wheel events from bubbling to canvas
		container.addEventListener("wheel", (e) => {
			e.stopPropagation();
		});
	}

	private renderChatContent(nodeId: string, container: HTMLElement): void {
		// Header bar
		const headerBar = container.createDiv({ cls: "rabbitmap-chat-header" });
		const headerIcon = headerBar.createSpan({ cls: "rabbitmap-chat-header-icon" });
		setIcon(headerIcon, "message-square");
		headerBar.createSpan({ text: "Canvas Chat", cls: "rabbitmap-chat-header-title" });

		// Click on header selects the node
		headerBar.addEventListener("mousedown", (e) => {
			e.stopPropagation();
			if (!this.selectedNodes.has(nodeId)) {
				this.clearSelection();
				this.selectNode(nodeId);
			}
		});

		// Get current state or use defaults
		let state = this.chatStates.get(nodeId);
		if (!state) {
			const defaultProvider = this.plugin.settings.providers[0];
			state = {
				provider: defaultProvider.name,
				model: defaultProvider.models[0],
				contextFiles: [],
				contextNodes: [],
				systemPrompt: DEFAULT_SYSTEM_PROMPT,
				contextTemplate: DEFAULT_CONTEXT_TEMPLATE
			};
			this.chatStates.set(nodeId, state);
		}
		// Ensure fields exist for old data
		if (!state.contextFiles) {
			state.contextFiles = [];
		}
		if (!state.systemPrompt) {
			state.systemPrompt = DEFAULT_SYSTEM_PROMPT;
		}
		if (!state.contextTemplate) {
			state.contextTemplate = DEFAULT_CONTEXT_TEMPLATE;
		}

		// --- Provider & model selects (created detached, placed in toolbar later) ---
		const providerSelect = document.createElement("select");
		providerSelect.className = "rabbitmap-select";
		for (const provider of this.plugin.settings.providers) {
			const option = document.createElement("option");
			option.text = provider.name;
			option.value = provider.name;
			if (provider.name === state.provider) {
				option.selected = true;
			}
			providerSelect.appendChild(option);
		}

		const modelSelect = document.createElement("select");
		modelSelect.className = "rabbitmap-select rabbitmap-model-select";

		const formatModelName = (model: string): string => {
			if (model.length <= 20) return model;
			const parts = model.split(/[-/]/);
			return parts.slice(-2).join("-").substring(0, 20);
		};

		// Will be set after toolbar is created
		let modelLabel: HTMLSpanElement;

		const updateModelOptions = () => {
			const currentState = this.chatStates.get(nodeId)!;
			const provider = this.plugin.settings.providers.find(p => p.name === currentState.provider);
			if (!provider) return;

			let models = provider.models;
			if (provider.name === "OpenRouter" && this.plugin.settings.customOpenRouterModels.trim()) {
				models = this.plugin.settings.customOpenRouterModels
					.split("\n")
					.map(m => m.trim())
					.filter(m => m.length > 0);
			}

			modelSelect.innerHTML = "";
			for (const model of models) {
				const option = document.createElement("option");
				option.text = model;
				option.value = model;
				if (model === currentState.model) {
					option.selected = true;
				}
				modelSelect.appendChild(option);
			}
			if (modelLabel) {
				modelLabel.textContent = formatModelName(currentState.model) + " \u25BE";
			}
		};

		updateModelOptions();

		providerSelect.onchange = () => {
			const newProvider = providerSelect.value;
			const provider = this.plugin.settings.providers.find(p => p.name === newProvider);
			if (provider) {
				let models = provider.models;
				if (provider.name === "OpenRouter" && this.plugin.settings.customOpenRouterModels.trim()) {
					models = this.plugin.settings.customOpenRouterModels
						.split("\n")
						.map(m => m.trim())
						.filter(m => m.length > 0);
				}

				const currentState = this.chatStates.get(nodeId);
				const newState: ChatNodeState = {
					provider: newProvider,
					model: models[0],
					contextFiles: currentState?.contextFiles || [],
					contextNodes: currentState?.contextNodes || [],
					systemPrompt: currentState?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
					contextTemplate: currentState?.contextTemplate || DEFAULT_CONTEXT_TEMPLATE
				};
				this.chatStates.set(nodeId, newState);
				updateModelOptions();
				this.triggerSave();
			}
		};

		modelSelect.onchange = () => {
			const currentState = this.chatStates.get(nodeId)!;
			currentState.model = modelSelect.value;
			this.chatStates.set(nodeId, currentState);
			this.triggerSave();
			if (modelLabel) {
				modelLabel.textContent = formatModelName(currentState.model) + " \u25BE";
			}
		};

		// --- Messages container ---
		const messagesContainer = container.createDiv({ cls: "rabbitmap-chat-messages" });

		messagesContainer.addEventListener("wheel", (e: WheelEvent) => {
			if (this.selectedNodes.has(nodeId)) {
				e.stopPropagation();
			}
		});

		messagesContainer.addEventListener("mousedown", (e: MouseEvent) => {
			e.stopPropagation();
			if (!this.selectedNodes.has(nodeId)) {
				this.clearSelection();
				this.selectNode(nodeId);
			}
		});

		const messages = this.chatMessages.get(nodeId) || [];
		messages.forEach((msg, index) => {
			this.renderChatMessage(messagesContainer, msg, nodeId, index);
		});

		// --- Bottom composite section ---
		const bottomSection = container.createDiv({ cls: "rabbitmap-chat-bottom" });

		// Context chips
		const contextChips = bottomSection.createDiv({ cls: "rabbitmap-chat-chips" });

		const renderContextFiles = () => {
			// Remove only file chips (not node chips)
			contextChips.querySelectorAll(".rabbitmap-chat-chip:not(.rabbitmap-chat-chip-node)").forEach(el => el.remove());
			const currentState = this.chatStates.get(nodeId);
			if (!currentState || currentState.contextFiles.length === 0) return;

			for (const filePath of currentState.contextFiles) {
				const chip = contextChips.createDiv({ cls: "rabbitmap-chat-chip" });
				const chipIcon = chip.createSpan({ cls: "rabbitmap-chat-chip-icon" });
				setIcon(chipIcon, "file-text");
				const fileName = filePath.split("/").pop() || filePath;
				chip.createSpan({ text: fileName, cls: "rabbitmap-chat-chip-name" });

				const removeBtn = chip.createEl("button", { text: "\u00D7", cls: "rabbitmap-chat-chip-remove" });
				removeBtn.onclick = (e: MouseEvent) => {
					e.stopPropagation();
					const s = this.chatStates.get(nodeId);
					if (s) {
						s.contextFiles = s.contextFiles.filter(f => f !== filePath);
						this.chatStates.set(nodeId, s);
						renderContextFiles();
						this.triggerSave();
					}
				};
			}
		};

		renderContextFiles();

		const renderContextNodes = () => {
			contextChips.querySelectorAll(".rabbitmap-chat-chip-node").forEach(el => el.remove());
			const currentState = this.chatStates.get(nodeId);
			if (!currentState || !currentState.contextNodes || currentState.contextNodes.length === 0) return;

			for (const connectedId of currentState.contextNodes) {
				const connectedNode = this.nodes.get(connectedId);
				if (!connectedNode) continue;

				const chip = contextChips.createDiv({ cls: "rabbitmap-chat-chip rabbitmap-chat-chip-node" });
				const chipIcon = chip.createSpan({ cls: "rabbitmap-chat-chip-icon" });
				setIcon(chipIcon, "share-2");
				const label = connectedNode.title || connectedNode.linkTitle || connectedNode.url || connectedNode.type;
				chip.createSpan({ text: `${label}`, cls: "rabbitmap-chat-chip-name" });

				const removeBtn = chip.createEl("button", { text: "\u00D7", cls: "rabbitmap-chat-chip-remove" });
				removeBtn.onclick = (e: MouseEvent) => {
					e.stopPropagation();
					const s = this.chatStates.get(nodeId);
					if (s) {
						s.contextNodes = s.contextNodes.filter(id => id !== connectedId);
						this.chatStates.set(nodeId, s);
						renderContextNodes();
						this.triggerSave();
					}
				};
			}
		};

		renderContextNodes();

		// Input wrapper
		const inputWrapper = bottomSection.createDiv({ cls: "rabbitmap-chat-input-wrapper" });
		const input = inputWrapper.createEl("textarea", {
			cls: "rabbitmap-chat-input",
			attr: { placeholder: "Plan, @ for context, / for commands" },
		});

		input.addEventListener("focus", () => {
			if (!this.selectedNodes.has(nodeId)) {
				this.clearSelection();
				this.selectNode(nodeId);
			}
		});

		// Toolbar
		const toolbar = bottomSection.createDiv({ cls: "rabbitmap-chat-toolbar" });
		const toolbarLeft = toolbar.createDiv({ cls: "rabbitmap-chat-toolbar-left" });
		const toolbarRight = toolbar.createDiv({ cls: "rabbitmap-chat-toolbar-right" });

		// Attach button (paperclip)
		const attachBtn = toolbarLeft.createEl("button", { cls: "rabbitmap-chat-toolbar-btn" });
		setIcon(attachBtn, "paperclip");
		attachBtn.setAttribute("aria-label", "Attach files");
		attachBtn.onclick = (e: MouseEvent) => {
			e.stopPropagation();
			new Notice("Drag files or folders onto this chat to add context");
		};

		// @ button
		const atBtn = toolbarLeft.createEl("button", { cls: "rabbitmap-chat-toolbar-btn" });
		setIcon(atBtn, "at-sign");
		atBtn.setAttribute("aria-label", "Add context");

		// Prompt edit button (sliders)
		const promptBtn = toolbarLeft.createEl("button", { cls: "rabbitmap-chat-toolbar-btn" });
		setIcon(promptBtn, "sliders-horizontal");
		promptBtn.setAttribute("aria-label", "Edit prompt");
		promptBtn.onclick = (e: MouseEvent) => {
			e.stopPropagation();
			const currentState = this.chatStates.get(nodeId);
			new PromptEditorModal(
				this.app,
				currentState?.systemPrompt || "",
				currentState?.contextTemplate || DEFAULT_CONTEXT_TEMPLATE,
				(newPrompt, newTemplate) => {
					const st = this.chatStates.get(nodeId);
					if (st) {
						st.systemPrompt = newPrompt;
						st.contextTemplate = newTemplate;
						this.chatStates.set(nodeId, st);
						this.triggerSave();
					}
				}
			).open();
		};

		// Model label + popover
		const modelLabelContainer = toolbarRight.createDiv({ cls: "rabbitmap-chat-model-container" });
		modelLabel = modelLabelContainer.createSpan({ cls: "rabbitmap-chat-model-label" });
		modelLabel.textContent = formatModelName(state.model) + " \u25BE";

		const popover = modelLabelContainer.createDiv({ cls: "rabbitmap-chat-model-popover" });
		popover.style.display = "none";
		popover.appendChild(providerSelect);
		popover.appendChild(modelSelect);

		let popoverOpen = false;
		modelLabel.onclick = (e: MouseEvent) => {
			e.stopPropagation();
			popoverOpen = !popoverOpen;
			popover.style.display = popoverOpen ? "flex" : "none";
		};

		document.addEventListener("click", () => {
			if (popoverOpen) {
				popoverOpen = false;
				popover.style.display = "none";
			}
		});

		popover.addEventListener("click", (e: MouseEvent) => {
			e.stopPropagation();
		});

		// Send button (circular with arrow)
		const sendBtn = toolbarRight.createEl("button", { cls: "rabbitmap-send-btn" });
		setIcon(sendBtn, "arrow-up");

		// --- Drag and drop handling (on container) ---
		container.addEventListener("dragover", (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			container.addClass("rabbitmap-drag-over");
		});

		container.addEventListener("dragleave", (e: DragEvent) => {
			e.preventDefault();
			container.removeClass("rabbitmap-drag-over");
		});

		container.addEventListener("drop", (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			container.removeClass("rabbitmap-drag-over");

			const plainText = e.dataTransfer?.getData("text/plain") || "";

			const parsePath = (input: string): string => {
				input = input.trim();

				if (input.startsWith("obsidian://")) {
					try {
						const url = new URL(input);
						const filePath = url.searchParams.get("file");
						if (filePath) {
							return decodeURIComponent(filePath);
						}
					} catch {}
				}

				try {
					input = decodeURIComponent(input);
				} catch {}

				const wikiMatch = input.match(/^\[\[(.+?)\]\]$/);
				if (wikiMatch) {
					return wikiMatch[1];
				}

				const mdMatch = input.match(/^\[.+?\]\((.+?)\)$/);
				if (mdMatch) {
					return mdMatch[1];
				}

				if (input.startsWith("/")) {
					input = input.slice(1);
				}

				return input;
			};

			const addFilesFromFolder = (folder: TFolder, state: ChatNodeState) => {
				for (const child of folder.children) {
					if (child instanceof TFile) {
						if (!state.contextFiles.includes(child.path)) {
							state.contextFiles.push(child.path);
						}
					} else if (child instanceof TFolder) {
						addFilesFromFolder(child, state);
					}
				}
			};

			const getAllFolders = (folder: TFolder): TFolder[] => {
				const folders: TFolder[] = [folder];
				for (const child of folder.children) {
					if (child instanceof TFolder) {
						folders.push(...getAllFolders(child));
					}
				}
				return folders;
			};

			const tryAddPath = (input: string) => {
				if (!input) return false;

				let path = parsePath(input);
				if (!path) return false;

				if (path.startsWith("http")) {
					const canvasRect = this.canvas.getBoundingClientRect();
					const x = (e.clientX - canvasRect.left - this.panX) / this.scale;
					const y = (e.clientY - canvasRect.top - this.panY) / this.scale;
					this.addLinkNode(path, x - 150, y - 100);
					return true;
				}

				let item = this.app.vault.getAbstractFileByPath(path);

				if (!item && !path.includes(".")) {
					item = this.app.vault.getAbstractFileByPath(path + ".md");
					if (item) path = path + ".md";
				}

				if (!item && !path.includes(".")) {
					const rootFolder = this.app.vault.getRoot();
					const allFolders = getAllFolders(rootFolder);
					const folderName = path.split("/").pop() || path;
					item = allFolders.find(f =>
						f.path === path ||
						f.name === folderName ||
						f.path.endsWith("/" + path)
					) || null;
				}

				if (!item) {
					const allFiles = this.app.vault.getFiles();
					const fileName = path.split("/").pop() || path;
					item = allFiles.find(f =>
						f.path === path ||
						f.name === fileName ||
						f.basename === fileName ||
						f.path.endsWith("/" + path)
					) || null;
					if (item) path = item.path;
				}

				const state = this.chatStates.get(nodeId);
				if (!state) return false;

				if (item instanceof TFolder) {
					addFilesFromFolder(item, state);
					return true;
				}

				if (item instanceof TFile) {
					if (!state.contextFiles.includes(path)) {
						state.contextFiles.push(path);
						return true;
					}
				}
				return false;
			};

			let added = false;

			if (plainText) {
				const lines = plainText.split("\n");
				for (const line of lines) {
					if (tryAddPath(line.trim())) {
						added = true;
					}
				}
			}

			if (added) {
				const state = this.chatStates.get(nodeId);
				if (state) {
					this.chatStates.set(nodeId, state);
					renderContextFiles();
					this.triggerSave();
				}
			}
		});

		// --- Send message logic ---
		const sendMessage = async () => {
			const text = input.value.trim();
			if (!text) return;

			const chatState = this.chatStates.get(nodeId)!;

			const msg: ChatMessage = {
				role: "user",
				content: text,
				contextFiles: chatState.contextFiles ? [...chatState.contextFiles] : []
			};
			const messages = this.chatMessages.get(nodeId) || [];
			messages.push(msg);
			this.chatMessages.set(nodeId, messages);
			this.renderChatMessage(messagesContainer, msg, nodeId, messages.length - 1);
			input.value = "";
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
			this.triggerSave();
			const provider = this.plugin.settings.providers.find(p => p.name === chatState.provider);
			if (!provider) return;

			let apiKey = provider.apiKey || "";
			if (!apiKey) {
				if (chatState.provider === "OpenAI" && this.plugin.settings.openaiApiKey) {
					apiKey = this.plugin.settings.openaiApiKey;
				} else if (chatState.provider === "OpenRouter" && this.plugin.settings.openrouterApiKey) {
					apiKey = this.plugin.settings.openrouterApiKey;
				}
			}

			if (!apiKey) {
				const errorMsg: ChatMessage = {
					role: "assistant",
					content: `Please set your ${chatState.provider} API key in settings.`,
				};
				messages.push(errorMsg);
				this.renderChatMessage(messagesContainer, errorMsg, nodeId, messages.length - 1);
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
				this.triggerSave();
				return;
			}

			const loadingEl = messagesContainer.createDiv({
				cls: "rabbitmap-chat-message rabbitmap-chat-assistant rabbitmap-chat-loading",
			});
			loadingEl.createSpan({ text: "..." });
			messagesContainer.scrollTop = messagesContainer.scrollHeight;

			let contextContent = "";
			if (chatState.contextFiles && chatState.contextFiles.length > 0) {
				const template = chatState.contextTemplate || DEFAULT_CONTEXT_TEMPLATE;
				const contextParts: string[] = [];
				for (const filePath of chatState.contextFiles) {
					const file = this.app.vault.getAbstractFileByPath(filePath);
					if (file && file instanceof TFile) {
						try {
							const content = await this.app.vault.read(file);
							const formatted = template
								.replace(/\{filepath\}/g, filePath)
								.replace(/\{filename\}/g, file.name)
								.replace(/\{content\}/g, content);
							contextParts.push(formatted);
						} catch {}
					}
				}
				if (contextParts.length > 0) {
					contextContent = "Context files:\n\n" + contextParts.join("\n\n");
				}
			}

			if (chatState.contextNodes && chatState.contextNodes.length > 0) {
				const nodeContent = this.getConnectedContent(chatState.contextNodes);
				if (nodeContent) {
					contextContent = contextContent
						? contextContent + "\n\n" + nodeContent
						: nodeContent;
				}
			}

			try {
				const response = await this.callLLM(provider, apiKey, chatState.model, messages, contextContent, chatState.systemPrompt || "");
				loadingEl.remove();

				const assistantMsg: ChatMessage = {
					role: "assistant",
					content: response,
				};
				messages.push(assistantMsg);
				this.renderChatMessage(messagesContainer, assistantMsg, nodeId, messages.length - 1);
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
				this.triggerSave();
			} catch (error) {
				loadingEl.remove();
				const errorMsg: ChatMessage = {
					role: "assistant",
					content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
				};
				messages.push(errorMsg);
				this.renderChatMessage(messagesContainer, errorMsg, nodeId, messages.length - 1);
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
				this.triggerSave();
			}
		};

		sendBtn.onclick = sendMessage;
		input.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				sendMessage();
			}
		});
	}

	private async callLLM(provider: ProviderConfig, apiKey: string, model: string, messages: ChatMessage[], context: string = "", systemPrompt: string = ""): Promise<string> {
		const apiFormat = provider.apiFormat || "openai";

		switch (apiFormat) {
			case "anthropic":
				return this.callAnthropicAPI(provider, apiKey, model, messages, context, systemPrompt);
			case "google":
				return this.callGoogleAPI(provider, apiKey, model, messages, context, systemPrompt);
			case "openai":
			default:
				return this.callOpenAIAPI(provider, apiKey, model, messages, context, systemPrompt);
		}
	}

	private async callOpenAIAPI(provider: ProviderConfig, apiKey: string, model: string, messages: ChatMessage[], context: string, systemPrompt: string): Promise<string> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${apiKey}`,
		};

		// OpenRouter requires additional headers
		if (provider.name === "OpenRouter") {
			headers["HTTP-Referer"] = "https://obsidian.md";
			headers["X-Title"] = "RabbitMap";
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

	private async callAnthropicAPI(provider: ProviderConfig, apiKey: string, model: string, messages: ChatMessage[], context: string, systemPrompt: string): Promise<string> {
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

	private async callGoogleAPI(provider: ProviderConfig, apiKey: string, model: string, messages: ChatMessage[], context: string, systemPrompt: string): Promise<string> {
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

	private renderChatMessage(container: HTMLElement, msg: ChatMessage, nodeId: string, msgIndex: number): void {
		const msgEl = container.createDiv({
			cls: `rabbitmap-chat-message rabbitmap-chat-${msg.role}`,
		});

		// Render markdown for assistant messages, plain text for user
		if (msg.role === "assistant") {
			const contentEl = msgEl.createDiv({ cls: "rabbitmap-message-content" });
			MarkdownRenderer.render(
				this.app,
				msg.content,
				contentEl,
				"",
				new Component()
			);
		} else {
			msgEl.createSpan({ text: msg.content });
		}

		// Context menu on right click
		msgEl.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.showMessageContextMenu(nodeId, msgIndex, e);
		});
	}

	private showMessageContextMenu(nodeId: string, msgIndex: number, e: MouseEvent): void {
		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle("Branch from here")
				.setIcon("git-branch")
				.onClick(() => {
					this.branchChat(nodeId, msgIndex);
				});
		});

		menu.addItem((item) => {
			item.setTitle("Fork")
				.setIcon("git-fork")
				.onClick(() => {
					this.forkChat(nodeId);
				});
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item.setTitle("Save this message")
				.setIcon("file-text")
				.onClick(() => {
					this.exportMessageToMd(nodeId, msgIndex, false);
				});
		});

		menu.addItem((item) => {
			item.setTitle("Save chat up to here")
				.setIcon("files")
				.onClick(() => {
					this.exportMessageToMd(nodeId, msgIndex, true);
				});
		});

		this.showMenu(menu, e);
	}

	private async exportMessageToMd(nodeId: string, msgIndex: number, includeHistory: boolean): Promise<void> {
		const messages = this.chatMessages.get(nodeId) || [];
		const node = this.nodes.get(nodeId);
		const chatState = this.chatStates.get(nodeId);

		if (!node || msgIndex >= messages.length) return;

		const title = node.title || "Chat";
		let md = `# ${title}\n\n`;

		if (chatState) {
			md += `> **Model:** ${chatState.provider} / ${chatState.model}\n\n`;
		}

		md += `---\n\n`;

		if (includeHistory) {
			// Export all messages up to and including msgIndex
			for (let i = 0; i <= msgIndex; i++) {
				const msg = messages[i];
				if (msg.role === "user") {
					md += `## User\n\n`;
					if (msg.contextFiles && msg.contextFiles.length > 0) {
						md += `> **Context:** `;
						md += msg.contextFiles.map(f => `[[${f}]]`).join(", ");
						md += `\n\n`;
					}
					md += `${msg.content}\n\n`;
				} else {
					md += `## Assistant\n\n${msg.content}\n\n`;
				}
			}
		} else {
			// Export only this message
			const msg = messages[msgIndex];
			if (msg.role === "user") {
				md += `## User\n\n`;
				if (msg.contextFiles && msg.contextFiles.length > 0) {
					md += `> **Context:** `;
					md += msg.contextFiles.map(f => `[[${f}]]`).join(", ");
					md += `\n\n`;
				}
				md += `${msg.content}\n\n`;
			} else {
				md += `## Assistant\n\n${msg.content}\n\n`;
			}
		}

		// Get folder path from current file
		const folder = this.file?.parent?.path || "";
		const now = new Date();
		const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		const hours = now.getHours();
		const ampm = hours >= 12 ? "PM" : "AM";
		const hours12 = hours % 12 || 12;
		const timestamp = `${now.getFullYear()} ${months[now.getMonth()]} ${now.getDate()} ${hours12}-${String(now.getMinutes()).padStart(2, "0")} ${ampm}`;
		const suffix = includeHistory ? "" : "-message";
		const fileName = `${title}${suffix} ${timestamp}`.replace(/[\\/:*?"<>|]/g, "-");
		const filePath = folder ? `${folder}/${fileName}.md` : `${fileName}.md`;

		const file = await this.app.vault.create(filePath, md);
		new Notice(`Saved to ${filePath}`);

		// Open the file in a new tab
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.openFile(file);
	}

	private updateNodePosition(nodeId: string, x: number, y: number): void {
		const node = this.nodes.get(nodeId);
		const el = this.nodeElements.get(nodeId);
		if (node && el) {
			node.x = x;
			node.y = y;
			el.style.left = `${x}px`;
			el.style.top = `${y}px`;
			this.updateEdges();
		}
	}

	private updateNodeSize(nodeId: string, width: number, height: number): void {
		const node = this.nodes.get(nodeId);
		const el = this.nodeElements.get(nodeId);
		if (node && el) {
			node.width = width;
			node.height = height;
			el.style.width = `${width}px`;
			el.style.height = `${height}px`;
			this.updateMinimap();
			this.updateEdges();
		}
	}

	private deleteNode(nodeId: string): void {
		this.nodes.delete(nodeId);
		this.chatMessages.delete(nodeId);
		this.chatStates.delete(nodeId);
		const el = this.nodeElements.get(nodeId);
		if (el) {
			el.remove();
			this.nodeElements.delete(nodeId);
		}
		// Remove edges connected to this node
		for (const [edgeId, edge] of this.edges) {
			if (edge.from === nodeId || edge.to === nodeId) {
				this.edges.delete(edgeId);
			}
		}
		// Remove this node from any chat's contextNodes
		for (const [id, state] of this.chatStates) {
			if (state.contextNodes && state.contextNodes.includes(nodeId)) {
				state.contextNodes = state.contextNodes.filter(n => n !== nodeId);
				this.chatStates.set(id, state);
			}
		}
		this.updateEdges();
		this.updateMinimap();
		this.triggerSave();
	}

	private addCardAtCenter(): void {
		const rect = this.canvas.getBoundingClientRect();
		const centerX = (rect.width / 2 - this.panX) / this.scale;
		const centerY = (rect.height / 2 - this.panY) / this.scale;

		this.addNode({
			id: this.generateId(),
			x: centerX - 150,
			y: centerY - 100,
			width: 300,
			height: 200,
			type: "card",
			content: "",
		});
	}

	private addChatAtCenter(): void {
		const rect = this.canvas.getBoundingClientRect();
		const centerX = (rect.width / 2 - this.panX) / this.scale;
		const centerY = (rect.height / 2 - this.panY) / this.scale;

		this.addNode({
			id: this.generateId(),
			x: centerX - 200,
			y: centerY - 250,
			width: 400,
			height: 500,
			type: "chat",
			content: "",
		});
	}

	private showAddLinkModal(): void {
		const modal = new Modal(this.app);
		modal.titleEl.setText("Add Link");
		const input = modal.contentEl.createEl("input", {
			cls: "rabbitmap-link-input",
			attr: { type: "text", placeholder: "Paste a URL (e.g. https://...)" },
		});
		input.style.width = "100%";
		input.style.padding = "8px";
		input.style.marginBottom = "12px";

		const btn = modal.contentEl.createEl("button", {
			text: "Add to Canvas",
			cls: "mod-cta",
		});
		btn.onclick = () => {
			const url = input.value.trim();
			if (url && /^https?:\/\//i.test(url)) {
				this.addLinkAtCenter(url);
				modal.close();
			} else {
				new Notice("Please enter a valid URL");
			}
		};

		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				btn.click();
			}
		});

		modal.open();
		input.focus();
	}

	private addLinkAtCenter(url: string): void {
		const rect = this.canvas.getBoundingClientRect();
		const centerX = (rect.width / 2 - this.panX) / this.scale;
		const centerY = (rect.height / 2 - this.panY) / this.scale;
		this.addLinkNode(url, centerX - 150, centerY - 100);
	}

	private addLinkNode(url: string, x: number, y: number): void {
		const nodeId = this.generateId();
		const node: CanvasNode = {
			id: nodeId,
			x,
			y,
			width: 300,
			height: 200,
			type: "link",
			content: "",
			url,
			linkTitle: "Loading...",
			linkType: "webpage",
		};

		// Detect YouTube
		const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
		if (ytMatch) {
			node.linkType = "youtube";
			node.linkImage = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
		}

		// Detect Twitter/X
		const twitterMatch = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
		if (twitterMatch) {
			node.linkType = "twitter";
		}

		this.addNode(node);
		this.fetchLinkMetadata(url, nodeId);
	}

	private parsePath(input: string): string {
		input = input.trim();

		// Handle obsidian:// URL format
		if (input.startsWith("obsidian://")) {
			try {
				const url = new URL(input);
				const filePath = url.searchParams.get("file");
				if (filePath) {
					return decodeURIComponent(filePath);
				}
			} catch {}
		}

		// Handle URL encoding
		try {
			input = decodeURIComponent(input);
		} catch {}

		// Handle [[wikilink]] format
		const wikiMatch = input.match(/^\[\[(.+?)\]\]$/);
		if (wikiMatch) {
			return wikiMatch[1];
		}

		// Handle [name](path) format
		const mdMatch = input.match(/^\[.+?\]\((.+?)\)$/);
		if (mdMatch) {
			return mdMatch[1];
		}

		// Remove leading slash if present
		if (input.startsWith("/")) {
			input = input.slice(1);
		}

		return input;
	}

	private resolveVaultItem(path: string): TFile | TFolder | null {
		let item = this.app.vault.getAbstractFileByPath(path);

		// Try adding .md extension
		if (!item && !path.includes(".")) {
			item = this.app.vault.getAbstractFileByPath(path + ".md");
		}

		// Try to find by name in all files
		if (!item) {
			const allFiles = this.app.vault.getFiles();
			const fileName = path.split("/").pop() || path;
			const found = allFiles.find(f =>
				f.path === path ||
				f.name === fileName ||
				f.basename === fileName ||
				f.path.endsWith("/" + path)
			);
			if (found) return found;
		}

		// Try to find folder by name
		if (!item && !path.includes(".")) {
			const rootFolder = this.app.vault.getRoot();
			const allFolders = this.getAllFolders(rootFolder);
			const folderName = path.split("/").pop() || path;
			const found = allFolders.find(f =>
				f.path === path ||
				f.name === folderName ||
				f.path.endsWith("/" + path)
			);
			if (found) return found;
		}

		return item as TFile | TFolder | null;
	}

	private getAllFolders(folder: TFolder): TFolder[] {
		const folders: TFolder[] = [folder];
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				folders.push(...this.getAllFolders(child));
			}
		}
		return folders;
	}

	private getMdFilesFromFolder(folder: TFolder): TFile[] {
		const files: TFile[] = [];
		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === "md") {
				files.push(child);
			} else if (child instanceof TFolder) {
				files.push(...this.getMdFilesFromFolder(child));
			}
		}
		return files;
	}

	private addNoteNode(filePath: string, content: string, x: number, y: number): void {
		const node: CanvasNode = {
			id: this.generateId(),
			x,
			y,
			width: 350,
			height: 300,
			type: "note",
			content,
			title: filePath.split("/").pop()?.replace(".md", "") || "Note",
			filePath,
		};
		this.addNode(node);
	}

	private async fetchLinkMetadata(url: string, nodeId: string): Promise<void> {
		const node = this.nodes.get(nodeId);
		if (!node) return;

		try {
			if (node.linkType === "youtube") {
				await this.fetchYouTubeMetadata(url, node);
			} else if (node.linkType === "twitter") {
				await this.fetchTwitterMetadata(url, node);
			} else {
				await this.fetchWebPageMetadata(url, node);
			}
		} catch (e) {
			// Fallback: show URL only
			try {
				node.linkTitle = new URL(url).hostname;
			} catch {
				node.linkTitle = url;
			}
			node.linkDescription = "Could not fetch content";
		}

		this.rerenderNode(nodeId);
		this.triggerSave();
	}

	private async fetchYouTubeMetadata(url: string, node: CanvasNode): Promise<void> {
		try {
			const resp = await requestUrl({
				url: `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
			});
			const data = resp.json;
			node.linkTitle = data.title || "YouTube Video";
			node.linkDescription = data.author_name ? `by ${data.author_name}` : "";
		} catch {
			node.linkTitle = "YouTube Video";
		}

		// Fetch page HTML to extract video description for LLM context
		try {
			const pageResp = await requestUrl({ url });
			const parser = new DOMParser();
			const doc = parser.parseFromString(pageResp.text, "text/html");

			// YouTube puts the description in og:description and also in JSON-LD
			const parts: string[] = [];

			// Title context
			if (node.linkTitle && node.linkTitle !== "YouTube Video") {
				parts.push(`Title: ${node.linkTitle}`);
			}
			if (node.linkDescription) {
				parts.push(`Channel: ${node.linkDescription.replace(/^by /, "")}`);
			}

			// og:description often has a truncated video description
			const ogDesc = doc.querySelector('meta[property="og:description"]');
			const descText = ogDesc?.getAttribute("content")?.trim();
			if (descText) {
				parts.push(`Description: ${descText}`);
			}

			// JSON-LD can have richer data
			const jsonLdContent = this.extractJsonLdContent(doc);
			if (jsonLdContent) {
				parts.push(jsonLdContent);
			}

			node.linkContent = parts.join("\n\n").slice(0, 10000);
		} catch {
			// Page fetch failed; linkContent stays empty, which is fine
		}
	}

	private async fetchTwitterMetadata(url: string, node: CanvasNode): Promise<void> {
		// Use fxtwitter API which returns rich tweet data as JSON
		const match = url.match(/(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/);
		if (!match) {
			node.linkTitle = "Tweet";
			return;
		}

		const [, username, statusId] = match;

		try {
			const resp = await requestUrl({
				url: `https://api.fxtwitter.com/${username}/status/${statusId}`,
			});
			const data = resp.json;
			const tweet = data.tweet;

			if (tweet) {
				// Title: author name and handle
				node.linkTitle = tweet.author?.name
					? `${tweet.author.name} (@${tweet.author.screen_name})`
					: `@${username}`;

				// Description: tweet text (truncated for display)
				node.linkDescription = tweet.text
					? (tweet.text.length > 200 ? tweet.text.slice(0, 200) + "…" : tweet.text)
					: "";

				// Image: author avatar or media
				if (tweet.media?.photos?.[0]?.url) {
					node.linkImage = tweet.media.photos[0].url;
				} else if (tweet.author?.avatar_url) {
					node.linkImage = tweet.author.avatar_url;
				}

				// Full content for LLM context
				const contentParts: string[] = [];
				contentParts.push(`Tweet by ${tweet.author?.name || username} (@${tweet.author?.screen_name || username})`);
				if (tweet.created_at) {
					contentParts.push(`Posted: ${tweet.created_at}`);
				}
				if (tweet.text) {
					contentParts.push(`\n${tweet.text}`);
				}
				if (tweet.replies !== undefined) {
					contentParts.push(`\nReplies: ${tweet.replies} | Retweets: ${tweet.retweets} | Likes: ${tweet.likes}`);
				}
				if (tweet.replying_to) {
					contentParts.push(`Replying to: @${tweet.replying_to}`);
				}

				node.linkContent = contentParts.join("\n").slice(0, 10000);
			} else {
				node.linkTitle = `@${username}`;
				node.linkDescription = "Could not load tweet";
			}
		} catch {
			// Fallback: try generic web fetch
			try {
				await this.fetchWebPageMetadata(url, node);
			} catch {
				node.linkTitle = `@${username}`;
				node.linkDescription = "Could not load tweet";
			}
		}
	}

	private async fetchWebPageMetadata(url: string, node: CanvasNode): Promise<void> {
		const resp = await requestUrl({ url });
		const html = resp.text;

		// Parse with DOMParser
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, "text/html");

		// Title — prefer og:title, fall back to <title>
		const ogTitle = doc.querySelector('meta[property="og:title"]');
		const titleEl = doc.querySelector("title");
		node.linkTitle = ogTitle?.getAttribute("content")?.trim()
			|| titleEl?.textContent?.trim()
			|| new URL(url).hostname;

		// Meta description — check multiple sources
		const descSources = [
			doc.querySelector('meta[property="og:description"]'),
			doc.querySelector('meta[name="description"]'),
			doc.querySelector('meta[name="twitter:description"]'),
		];
		node.linkDescription = descSources
			.map(el => el?.getAttribute("content")?.trim())
			.find(d => d && d.length > 0) || "";

		// OG image
		const ogImage = doc.querySelector('meta[property="og:image"]');
		const imgContent = ogImage?.getAttribute("content");
		if (imgContent) {
			try {
				node.linkImage = new URL(imgContent, url).href;
			} catch {
				node.linkImage = imgContent;
			}
		}

		// --- Extract rich content via multiple strategies ---
		node.linkContent = this.extractPageContent(doc, url);
	}

	private extractPageContent(doc: Document, url: string): string {
		// Strategy 1: JSON-LD structured data (best for Twitter/X, news, blogs)
		const jsonLdContent = this.extractJsonLdContent(doc);
		if (jsonLdContent && jsonLdContent.length > 200) {
			return jsonLdContent.slice(0, 10000);
		}

		// Strategy 2: Enhanced HTML extraction
		const htmlContent = this.extractHtmlContent(doc);

		// If JSON-LD had something short, prepend it to HTML content
		if (jsonLdContent && jsonLdContent.length > 0) {
			const combined = jsonLdContent + "\n\n" + htmlContent;
			return combined.slice(0, 10000);
		}

		// Strategy 3: Fall back to meta description if HTML extraction is too thin
		if (htmlContent.length < 100) {
			const metaFallback = this.extractMetaContent(doc);
			if (metaFallback.length > htmlContent.length) {
				return metaFallback.slice(0, 10000);
			}
		}

		return htmlContent.slice(0, 10000);
	}

	private extractJsonLdContent(doc: Document): string {
		const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
		const parts: string[] = [];

		scripts.forEach(script => {
			try {
				const data = JSON.parse(script.textContent || "");
				const items = Array.isArray(data) ? data : [data];
				for (const item of items) {
					// Extract article/post body text
					if (item.articleBody) {
						parts.push(item.articleBody);
					}
					if (item.text) {
						parts.push(item.text);
					}
					if (item.description && !parts.includes(item.description)) {
						parts.push(item.description);
					}
					// Handle nested @graph structure (common in WordPress, news sites)
					if (item["@graph"] && Array.isArray(item["@graph"])) {
						for (const graphItem of item["@graph"]) {
							if (graphItem.articleBody) parts.push(graphItem.articleBody);
							if (graphItem.text) parts.push(graphItem.text);
							if (graphItem.description && !parts.includes(graphItem.description)) {
								parts.push(graphItem.description);
							}
							if (graphItem.abstract) parts.push(graphItem.abstract);
						}
					}
					// Academic papers
					if (item.abstract) {
						parts.push(item.abstract);
					}
				}
			} catch {
				// Invalid JSON-LD, skip
			}
		});

		return parts.join("\n\n").trim();
	}

	private extractHtmlContent(doc: Document): string {
		// Remove non-content elements
		const removeSelectors = [
			"script", "style", "nav", "footer", "header", "aside", "iframe", "noscript",
			"[role='navigation']", "[role='banner']", "[role='contentinfo']",
			".sidebar", ".comments", ".comment", ".related", ".advertisement", ".ad",
			"form", "[aria-hidden='true']", ".social-share", ".share-buttons",
			".cookie-banner", ".popup", ".modal",
		];
		for (const sel of removeSelectors) {
			try {
				doc.querySelectorAll(sel).forEach(el => el.remove());
			} catch {
				// Invalid selector in this context, skip
			}
		}

		// Try progressively broader content selectors
		const contentSelectors = [
			"article",
			"[role='main']",
			"main",
			".post-content",
			".entry-content",
			".article-body",
			".article-content",
			".story-body",
			"#content",
			".content",
			"body",
		];

		let contentEl: Element | null = null;
		for (const sel of contentSelectors) {
			contentEl = doc.querySelector(sel);
			if (contentEl) break;
		}

		if (!contentEl) return "";

		// Extract text preserving paragraph structure
		const paragraphs: string[] = [];
		const pElements = contentEl.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, td");

		if (pElements.length > 0) {
			pElements.forEach(el => {
				const text = (el.textContent || "").replace(/\s+/g, " ").trim();
				if (text.length > 0) {
					paragraphs.push(text);
				}
			});
			return paragraphs.join("\n\n").trim();
		}

		// Fallback: raw textContent if no paragraph elements found
		return (contentEl.textContent || "").replace(/\s+/g, " ").trim();
	}

	private extractMetaContent(doc: Document): string {
		const metaSelectors = [
			'meta[property="og:description"]',
			'meta[name="description"]',
			'meta[name="twitter:description"]',
			'meta[name="abstract"]', // Academic papers
			'meta[name="citation_abstract"]', // Scholar/academic
		];

		const parts: string[] = [];
		for (const sel of metaSelectors) {
			const el = doc.querySelector(sel);
			const content = el?.getAttribute("content")?.trim();
			if (content && !parts.includes(content)) {
				parts.push(content);
			}
		}

		return parts.join("\n\n").trim();
	}

	private rerenderNode(nodeId: string): void {
		const el = this.nodeElements.get(nodeId);
		const node = this.nodes.get(nodeId);
		if (!el || !node) return;

		el.remove();
		this.nodeElements.delete(nodeId);
		this.renderNode(node);
	}

	async onClose(): Promise<void> {
		// Final save before closing
		this.triggerSave();
	}
}

class PromptEditorModal extends Modal {
	private prompt: string;
	private contextTemplate: string;
	private onSave: (prompt: string, template: string) => void;

	constructor(app: any, prompt: string, contextTemplate: string, onSave: (prompt: string, template: string) => void) {
		super(app);
		this.prompt = prompt;
		this.contextTemplate = contextTemplate;
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("rabbitmap-prompt-modal");

		// System Prompt section
		contentEl.createEl("h3", { text: "System Prompt" });
		const promptTextarea = contentEl.createEl("textarea", {
			cls: "rabbitmap-prompt-textarea",
			attr: { placeholder: "Enter system prompt for this chat..." }
		});
		promptTextarea.value = this.prompt;

		// Context Template section
		contentEl.createEl("h3", { text: "Context Template", cls: "rabbitmap-prompt-section-title" });
		contentEl.createEl("p", {
			text: "Variables: {filepath}, {filename}, {content}",
			cls: "rabbitmap-prompt-hint"
		});
		const templateTextarea = contentEl.createEl("textarea", {
			cls: "rabbitmap-prompt-textarea rabbitmap-template-textarea",
			attr: { placeholder: "Template for each context file..." }
		});
		templateTextarea.value = this.contextTemplate;

		// Preview
		contentEl.createEl("h4", { text: "Preview", cls: "rabbitmap-prompt-section-title" });
		const preview = contentEl.createDiv({ cls: "rabbitmap-prompt-preview" });

		const updatePreview = () => {
			const template = templateTextarea.value;
			const example = template
				.replace(/\{filepath\}/g, "folder/example.md")
				.replace(/\{filename\}/g, "example.md")
				.replace(/\{content\}/g, "File content here...");
			preview.setText(example);
		};
		updatePreview();
		templateTextarea.addEventListener("input", updatePreview);

		const buttonContainer = contentEl.createDiv({ cls: "rabbitmap-prompt-buttons" });

		const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
		cancelBtn.onclick = () => this.close();

		const saveBtn = buttonContainer.createEl("button", { text: "Save", cls: "mod-cta" });
		saveBtn.onclick = () => {
			this.onSave(promptTextarea.value, templateTextarea.value);
			this.close();
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ExpandedChatModal extends Modal {
	private view: RabbitMapView;
	private nodeId: string;
	private messagesContainer: HTMLElement;
	private input: HTMLTextAreaElement;
	private updateInterval: number;

	constructor(app: any, view: RabbitMapView, nodeId: string) {
		super(app);
		this.view = view;
		this.nodeId = nodeId;
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		modalEl.addClass("rabbitmap-expanded-chat-modal");
		contentEl.empty();

		const node = this.view.getNode(this.nodeId);
		const chatState = this.view.getChatState(this.nodeId);

		// Header
		const header = contentEl.createDiv({ cls: "rabbitmap-expanded-header" });
		header.createEl("h2", { text: node?.title || "Chat" });

		if (chatState) {
			header.createEl("span", {
				text: `${chatState.provider} / ${chatState.model}`,
				cls: "rabbitmap-expanded-model"
			});
		}

		// Messages
		this.messagesContainer = contentEl.createDiv({ cls: "rabbitmap-expanded-messages" });
		this.renderMessages();

		// Input area
		const inputArea = contentEl.createDiv({ cls: "rabbitmap-expanded-input-area" });
		this.input = inputArea.createEl("textarea", {
			cls: "rabbitmap-expanded-input",
			attr: { placeholder: "Type a message...", rows: "3" }
		});

		const sendBtn = inputArea.createEl("button", {
			text: "Send",
			cls: "rabbitmap-expanded-send-btn"
		});

		sendBtn.onclick = () => this.sendMessage();
		this.input.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				this.sendMessage();
			}
		});

		// Focus input and scroll to bottom
		this.input.focus();
		setTimeout(() => {
			this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
		}, 50);

		// Sync messages periodically
		this.updateInterval = window.setInterval(() => {
			this.renderMessages();
		}, 500);
	}

	private renderMessages(showLoading: boolean = false) {
		const messages = this.view.getChatMessages(this.nodeId) || [];
		const scrolledToBottom = this.messagesContainer.scrollTop + this.messagesContainer.clientHeight >= this.messagesContainer.scrollHeight - 10;

		this.messagesContainer.empty();

		for (const msg of messages) {
			const msgEl = this.messagesContainer.createDiv({
				cls: `rabbitmap-expanded-message rabbitmap-expanded-${msg.role}`
			});

			if (msg.role === "user" && msg.contextFiles && msg.contextFiles.length > 0) {
				const contextEl = msgEl.createDiv({ cls: "rabbitmap-expanded-context" });
				contextEl.createSpan({ text: "Context: " });
				contextEl.createSpan({ text: msg.contextFiles.map(f => f.split("/").pop()).join(", ") });
			}

			msgEl.createDiv({ cls: "rabbitmap-expanded-content", text: msg.content });
		}

		// Show loading indicator
		if (showLoading) {
			const loadingEl = this.messagesContainer.createDiv({
				cls: "rabbitmap-expanded-message rabbitmap-expanded-assistant rabbitmap-expanded-loading"
			});
			loadingEl.createDiv({ cls: "rabbitmap-expanded-content", text: "..." });
		}

		if (scrolledToBottom || showLoading) {
			this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
		}
	}

	private async sendMessage() {
		const text = this.input.value.trim();
		if (!text) return;

		this.input.value = "";
		this.input.disabled = true;

		// Show user message + loading
		this.renderMessages(true);

		await this.view.sendChatMessage(this.nodeId, text);

		this.input.disabled = false;
		this.input.focus();
		this.renderMessages();
		this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
	}

	onClose() {
		if (this.updateInterval) {
			window.clearInterval(this.updateInterval);
		}
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SettingsModal extends Modal {
	plugin: RabbitMapPlugin;

	constructor(app: any, plugin: RabbitMapPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("rabbitmap-settings-modal");

		contentEl.createEl("h2", { text: "Provider Settings" });

		// Providers section
		const providersContainer = contentEl.createDiv({ cls: "rabbitmap-providers-container" });

		const renderProviders = () => {
			providersContainer.empty();

			for (let i = 0; i < this.plugin.settings.providers.length; i++) {
				const provider = this.plugin.settings.providers[i];
				const providerSection = providersContainer.createDiv({ cls: "rabbitmap-provider-section" });

				// Provider header with name and toggle
				const headerRow = providerSection.createDiv({ cls: "rabbitmap-provider-header" });
				headerRow.createEl("h3", { text: provider.name });

				// Enabled toggle
				const toggleContainer = headerRow.createDiv({ cls: "rabbitmap-provider-toggle" });
				const toggleLabel = toggleContainer.createEl("label", { cls: "rabbitmap-toggle-label" });
				const toggleInput = toggleLabel.createEl("input", { type: "checkbox" });
				toggleInput.checked = provider.enabled;
				toggleLabel.createSpan({ text: provider.enabled ? "Enabled" : "Disabled" });
				toggleInput.onchange = async () => {
					provider.enabled = toggleInput.checked;
					toggleLabel.querySelector("span")!.textContent = provider.enabled ? "Enabled" : "Disabled";
					await this.plugin.saveSettings();
				};

				// Base URL setting
				new Setting(providerSection)
					.setName("Base URL")
					.setDesc("API endpoint URL (change for custom/proxy deployments)")
					.addText((text) =>
						text
							.setPlaceholder("https://api.example.com/v1")
							.setValue(provider.baseUrl)
							.onChange(async (value) => {
								provider.baseUrl = value;
								await this.plugin.saveSettings();
							})
					);

				// API Key setting
				new Setting(providerSection)
					.setName("API Key")
					.setDesc(`Enter your ${provider.name} API key`)
					.addText((text) =>
						text
							.setPlaceholder("sk-...")
							.setValue(provider.apiKey)
							.onChange(async (value) => {
								provider.apiKey = value;
								await this.plugin.saveSettings();
							})
					);

				// API Format setting
				new Setting(providerSection)
					.setName("API Format")
					.setDesc("Select the API format for this provider")
					.addDropdown((dropdown) =>
						dropdown
							.addOption("openai", "OpenAI Compatible")
							.addOption("anthropic", "Anthropic (Claude)")
							.addOption("google", "Google (Gemini)")
							.setValue(provider.apiFormat || "openai")
							.onChange(async (value) => {
								provider.apiFormat = value as "openai" | "anthropic" | "google";
								await this.plugin.saveSettings();
							})
					);

				// Models section
				const modelsHeader = providerSection.createDiv({ cls: "rabbitmap-models-header" });
				modelsHeader.createEl("h4", { text: "Models" });

				// Models input row
				const inputRow = providerSection.createDiv({ cls: "rabbitmap-models-input-row" });
				const modelInput = inputRow.createEl("input", {
					type: "text",
					placeholder: "e.g. gpt-4o or anthropic/claude-3.5-sonnet",
					cls: "rabbitmap-models-input"
				});
				const addButton = inputRow.createEl("button", {
					text: "Add",
					cls: "rabbitmap-models-add-btn"
				});

				// Models list
				const modelsList = providerSection.createDiv({ cls: "rabbitmap-models-list" });

				const renderModelsList = () => {
					modelsList.empty();
					if (provider.models.length === 0) {
						modelsList.createEl("div", {
							text: "No models configured.",
							cls: "rabbitmap-models-empty"
						});
						return;
					}

					for (const model of provider.models) {
						const item = modelsList.createDiv({ cls: "rabbitmap-models-item" });
						item.createSpan({ text: model, cls: "rabbitmap-models-name" });
						const removeBtn = item.createEl("button", {
							text: "×",
							cls: "rabbitmap-models-remove-btn"
						});
						removeBtn.onclick = async () => {
							provider.models = provider.models.filter(m => m !== model);
							await this.plugin.saveSettings();
							renderModelsList();
						};
					}
				};

				addButton.onclick = async () => {
					const newModel = modelInput.value.trim();
					if (!newModel) return;
					if (!provider.models.includes(newModel)) {
						provider.models.push(newModel);
						await this.plugin.saveSettings();
					}
					modelInput.value = "";
					renderModelsList();
				};

				modelInput.onkeydown = (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						addButton.click();
					}
				};

				renderModelsList();
			}

			// Add new provider button
			const addProviderRow = providersContainer.createDiv({ cls: "rabbitmap-add-provider-row" });
			const newProviderInput = addProviderRow.createEl("input", {
				type: "text",
				placeholder: "New provider name (e.g. Ollama)",
				cls: "rabbitmap-new-provider-input"
			});
			const addProviderBtn = addProviderRow.createEl("button", {
				text: "Add Provider",
				cls: "rabbitmap-add-provider-btn"
			});

			addProviderBtn.onclick = async () => {
				const name = newProviderInput.value.trim();
				if (!name) return;
				if (this.plugin.settings.providers.some(p => p.name === name)) {
					new Notice(`Provider "${name}" already exists.`);
					return;
				}
				this.plugin.settings.providers.push({
					name,
					baseUrl: "https://api.example.com/v1",
					apiKey: "",
					models: [],
					enabled: true
				});
				await this.plugin.saveSettings();
				newProviderInput.value = "";
				renderProviders();
			};
		};

		renderProviders();

		// Help links
		contentEl.createEl("p", {
			text: "Get your API keys from:",
			cls: "rabbitmap-settings-info",
		});

		const linkContainer = contentEl.createDiv({ cls: "rabbitmap-settings-links" });
		linkContainer.createEl("a", {
			text: "OpenAI Platform",
			href: "https://platform.openai.com/api-keys",
		});
		linkContainer.createEl("span", { text: " | " });
		linkContainer.createEl("a", {
			text: "OpenRouter",
			href: "https://openrouter.ai/keys",
		});
		linkContainer.createEl("span", { text: " | " });
		linkContainer.createEl("a", {
			text: "Google AI Studio",
			href: "https://aistudio.google.com/apikey",
		});
		linkContainer.createEl("span", { text: " | " });
		linkContainer.createEl("a", {
			text: "Anthropic Console",
			href: "https://console.anthropic.com/settings/keys",
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export default class RabbitMapPlugin extends Plugin {
	settings: PluginSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		// Register the view
		this.registerView(VIEW_TYPE_RABBITMAP, (leaf) => new RabbitMapView(leaf, this));

		// Register file extension
		this.registerExtensions([FILE_EXTENSION], VIEW_TYPE_RABBITMAP);

		// Add ribbon icon
		this.addRibbonIcon("layout-dashboard", "Create new RabbitMap", async () => {
			await this.createNewCanvas();
		});

		// Add command to create new canvas
		this.addCommand({
			id: "create-new-rabbitmap",
			name: "Create new RabbitMap canvas",
			callback: async () => {
				await this.createNewCanvas();
			},
		});

		// Add context menu for folders
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file) => {
				if (file instanceof TFolder) {
					menu.addItem((item) => {
						item.setTitle("New RabbitMap")
							.setIcon("layout-dashboard")
							.onClick(async () => {
								await this.createNewCanvas(file.path);
							});
					});
				}
			})
		);
	}

	async createNewCanvas(folderPath?: string): Promise<void> {
		const folder = folderPath || "";
		let fileName = "Untitled";
		let counter = 1;
		let filePath = folder ? `${folder}/${fileName}.${FILE_EXTENSION}` : `${fileName}.${FILE_EXTENSION}`;

		// Find unique name
		while (this.app.vault.getAbstractFileByPath(filePath)) {
			fileName = `Untitled ${counter}`;
			filePath = folder ? `${folder}/${fileName}.${FILE_EXTENSION}` : `${fileName}.${FILE_EXTENSION}`;
			counter++;
		}

		// Create file with empty data structure
		const initialData: RabbitMapData = {
			nodes: [],
			edges: [],
			chatMessages: {},
			chatStates: {},
			view: { scale: 1, panX: 0, panY: 0 }
		};
		const file = await this.app.vault.create(filePath, JSON.stringify(initialData, null, 2));

		// Open it
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.openFile(file);

		new Notice(`Created ${fileName}.${FILE_EXTENSION}`);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		// Merge in any default providers that are missing from saved settings
		for (const defaultProvider of DEFAULT_SETTINGS.providers) {
			if (!this.settings.providers.some(p => p.name === defaultProvider.name)) {
				this.settings.providers.push(defaultProvider);
			}
		}
		// Ensure all providers have apiFormat (backfill for old data)
		for (const provider of this.settings.providers) {
			if (!provider.apiFormat) {
				const defaultMatch = DEFAULT_SETTINGS.providers.find(p => p.name === provider.name);
				(provider as any).apiFormat = defaultMatch?.apiFormat || "openai";
			}
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	onunload(): void {}
}
