import {
	TextFileView,
	Plugin,
	WorkspaceLeaf,
	TFile,
	Menu,
	TFolder,
	Notice,
	Modal,
	MarkdownRenderer,
	Component,
	requestUrl,
	setIcon,
} from "obsidian";
import {
	CanvasNode,
	ChatMessage,
	Edge,
	PluginSettings,
	ChatNodeState,
	CanvasChatData,
	ChatViewHandle,
} from "./src/types";
import { callLLM } from "./src/llm";
import {
	VIEW_TYPE_CANVAS_CHAT,
	FILE_EXTENSION,
	DEFAULT_SETTINGS,
	DEFAULT_SYSTEM_PROMPT,
	DEFAULT_CONTEXT_TEMPLATE,
} from "./src/constants";
import {
	PromptEditorModal,
	ExpandedChatModal,
} from "./src/modals";
import {
	createMinimap,
	updateMinimap,
	createToolbar,
	setupEventListeners,
} from "./src/view";

export class CanvasChatView extends TextFileView implements ChatViewHandle {
	canvas: HTMLElement;
	nodesContainer: HTMLElement;
	nodes: Map<string, CanvasNode> = new Map();
	nodeElements: Map<string, HTMLElement> = new Map();

	// Canvas transform state
	scale = 1;
	panX = 0;
	panY = 0;

	// Interaction state
	isPanning = false;
	panStartX = 0;
	panStartY = 0;
	spacePressed = false;

	// Drag state
	draggedNode: string | null = null;
	dragOffsetX = 0;
	dragOffsetY = 0;

	// Resize state
	resizingNode: string | null = null;
	resizeStartWidth = 0;
	resizeStartHeight = 0;
	resizeStartX = 0;
	resizeStartY = 0;

	// Active context menu (prevent overlapping menus)
	activeMenu: Menu | null = null;

	// Selection state
	selectedNodes: Set<string> = new Set();
	isSelecting = false;
	selectionBox: HTMLElement | null = null;
	selectionStartX = 0;
	selectionStartY = 0;
	dragStartPositions: Map<string, { x: number; y: number }> = new Map();
	dragStartMouseX = 0;
	dragStartMouseY = 0;

	// Minimap
	minimap: HTMLElement;
	minimapContent: HTMLElement;
	minimapViewport: HTMLElement;
	minimapNodes: Map<string, HTMLElement> = new Map();

	// Chat state
	chatMessages: Map<string, ChatMessage[]> = new Map();
	chatStates: Map<string, ChatNodeState> = new Map();

	// Edges
	edges: Map<string, Edge> = new Map();
	edgesContainer: SVGSVGElement;

	// Edge drawing state
	isDrawingEdge = false;
	edgeDrawFromNode: string | null = null;
	edgeDrawFromSide: "top" | "right" | "bottom" | "left" | null = null;
	edgeDrawTempLine: SVGLineElement | null = null;

	// Plugin reference
	plugin: CanvasChatPlugin;

	isLoaded = false;
	isSaving = false;
	saveTimeout: number | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: CanvasChatPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_CANVAS_CHAT;
	}

	getDisplayText(): string {
		return this.file?.basename || "Canvas Chat";
	}

	getIcon(): string {
		return "layout-dashboard";
	}

	// Called by Obsidian to get current data for saving
	getViewData(): string {
		const data: CanvasChatData = {
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
				const parsed: CanvasChatData = JSON.parse(data);

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
			console.log("Error parsing canvas chat file:", e);
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
		createToolbar(this, container);

		// Create minimap
		createMinimap(this, container);

		// Setup event listeners
		setupEventListeners(this);

		this.updateTransform();
	}

	triggerSave(): void {
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


	updateSelectionFromBox(left: number, top: number, width: number, height: number): void {
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

	selectNode(nodeId: string): void {
		if (!this.selectedNodes.has(nodeId)) {
			this.selectedNodes.add(nodeId);
			const el = this.nodeElements.get(nodeId);
			if (el) {
				el.addClass("rabbitmap-node-selected");
			}
		}
	}

	deselectNode(nodeId: string): void {
		if (this.selectedNodes.has(nodeId)) {
			this.selectedNodes.delete(nodeId);
			const el = this.nodeElements.get(nodeId);
			if (el) {
				el.removeClass("rabbitmap-node-selected");
			}
		}
	}

	clearSelection(): void {
		for (const nodeId of this.selectedNodes) {
			const el = this.nodeElements.get(nodeId);
			if (el) {
				el.removeClass("rabbitmap-node-selected");
			}
		}
		this.selectedNodes.clear();
	}

	deleteSelectedNodes(): void {
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
		updateMinimap(this);
		this.triggerSave();
	}

	isInputFocused(): boolean {
		const active = document.activeElement;
		return (
			active instanceof HTMLInputElement ||
			active instanceof HTMLTextAreaElement ||
			(active as HTMLElement)?.isContentEditable
		);
	}

	zoom(delta: number): void {
		const factor = Math.exp(delta);
		const newScale = Math.min(Math.max(this.scale * factor, 0.1), 2);
		this.scale = newScale;
		this.updateTransform();
		this.triggerSave();
	}

	zoomAtPoint(delta: number, clientX: number, clientY: number): void {
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

	resetView(): void {
		this.scale = 1;
		this.panX = 0;
		this.panY = 0;
		this.updateTransform();
		this.triggerSave();
	}

	getContentBounds(): { minX: number; minY: number; maxX: number; maxY: number } | null {
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

	clampPan(panX: number, panY: number): { x: number; y: number } {
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

	zoomToNode(nodeId: string): void {
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

	showMenu(menu: Menu, e: MouseEvent): void {
		this.activeMenu?.close();
		this.activeMenu = menu;
		menu.showAtMouseEvent(e);
	}

	showChatContextMenu(nodeId: string, e: MouseEvent): void {
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

	analyzeConnections(nodeId: string): void {
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

	branchChat(nodeId: string, upToMsgIndex?: number): void {
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

		updateMinimap(this);
		this.triggerSave();

		// Zoom to new node, scroll to last message, and focus input
		this.zoomToNode(newNode.id);
		this.scrollChatToBottom(newNode.id);
		this.focusChatInput(newNode.id);
	}

	scrollChatToBottom(nodeId: string): void {
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

	focusChatInput(nodeId: string): void {
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

	openExpandedChat(nodeId: string): void {
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

		const apiKey = provider.apiKey || "";

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
			const response = await callLLM(provider, apiKey, chatState.model, messages, contextContent, chatState.systemPrompt || "");
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

	refreshChatNode(nodeId: string): void {
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

	async exportChatToMd(node: CanvasNode): Promise<void> {
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

	showTitleEditor(node: CanvasNode, titleSpan: HTMLElement, container: HTMLElement): void {
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

	forkChat(nodeId: string): void {
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

		updateMinimap(this);
		this.triggerSave();

		// Zoom to new node and focus input
		this.zoomToNode(newNode.id);
		this.focusChatInput(newNode.id);
	}

	findFreePosition(sourceNode: CanvasNode): { x: number; y: number } {
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

	findBlockingNode(x: number, y: number, width: number, height: number): CanvasNode | null {
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

	isPositionOccupied(x: number, y: number, width: number, height: number): boolean {
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

	getConnectedNodes(nodeId: string): string[] {
		const connected = new Set<string>();
		for (const edge of this.edges.values()) {
			if (edge.from === nodeId) connected.add(edge.to);
			if (edge.to === nodeId) connected.add(edge.from);
		}
		return Array.from(connected);
	}

	getNodeContent(nodeId: string): string {
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

	getConnectedContent(nodeIds: string[]): string {
		const parts = nodeIds
			.map(id => this.getNodeContent(id))
			.filter(content => content.length > 0);
		if (parts.length === 0) return "";
		return "Connected nodes:\n\n" + parts.join("\n\n---\n\n");
	}

	addEdge(fromId: string, toId: string): void {
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

	addEdgeContext(chatNodeId: string, otherNodeId: string): void {
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

	renderAllEdges(): void {
		// Clear existing edge elements
		this.edgesContainer.innerHTML = "";

		for (const edge of this.edges.values()) {
			this.renderEdge(edge);
		}
	}

	renderEdge(edge: Edge): void {
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

	updateEdges(): void {
		this.renderAllEdges();
	}

	getHandlePosition(node: CanvasNode, side: "top" | "right" | "bottom" | "left"): { x: number; y: number } {
		switch (side) {
			case "top": return { x: node.x + node.width / 2, y: node.y };
			case "right": return { x: node.x + node.width, y: node.y + node.height / 2 };
			case "bottom": return { x: node.x + node.width / 2, y: node.y + node.height };
			case "left": return { x: node.x, y: node.y + node.height / 2 };
		}
	}

	startEdgeDrawing(nodeId: string, side: "top" | "right" | "bottom" | "left", e: MouseEvent): void {
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

	findTargetHandle(e: MouseEvent): { nodeId: string; side: string } | null {
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

	showEdgeContextMenu(edgeId: string, e: MouseEvent): void {
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

	deleteEdge(edgeId: string): void {
		this.edges.delete(edgeId);
		this.renderAllEdges();
		this.triggerSave();
	}

	animateTo(targetScale: number, targetPanX: number, targetPanY: number): void {
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

	updateTransform(): void {
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
		updateMinimap(this);
	}

	generateId(): string {
		return "node-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
	}

	addNode(node: CanvasNode, save: boolean = true): void {
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

	renderNode(node: CanvasNode): void {
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

	renderLinkContent(node: CanvasNode, container: HTMLElement): void {
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

	showLinkContextMenu(nodeId: string, e: MouseEvent): void {
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

	showNoteContextMenu(nodeId: string, e: MouseEvent): void {
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

	showMultiSelectContextMenu(e: MouseEvent): void {
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

	summarizeSelected(): void {
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

	renderCardContent(node: CanvasNode, container: HTMLElement): void {
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

	renderNoteContent(node: CanvasNode, container: HTMLElement): void {
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

	renderChatContent(nodeId: string, container: HTMLElement): void {
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

			const apiKey = provider.apiKey || "";

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
				const response = await callLLM(provider, apiKey, chatState.model, messages, contextContent, chatState.systemPrompt || "");
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

	renderChatMessage(container: HTMLElement, msg: ChatMessage, nodeId: string, msgIndex: number): void {
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

	showMessageContextMenu(nodeId: string, msgIndex: number, e: MouseEvent): void {
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

	async exportMessageToMd(nodeId: string, msgIndex: number, includeHistory: boolean): Promise<void> {
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

	updateNodePosition(nodeId: string, x: number, y: number): void {
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

	updateNodeSize(nodeId: string, width: number, height: number): void {
		const node = this.nodes.get(nodeId);
		const el = this.nodeElements.get(nodeId);
		if (node && el) {
			node.width = width;
			node.height = height;
			el.style.width = `${width}px`;
			el.style.height = `${height}px`;
			updateMinimap(this);
			this.updateEdges();
		}
	}

	deleteNode(nodeId: string): void {
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
		updateMinimap(this);
		this.triggerSave();
	}

	addCardAtCenter(): void {
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

	addChatAtCenter(): void {
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

	showAddLinkModal(): void {
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

	addLinkAtCenter(url: string): void {
		const rect = this.canvas.getBoundingClientRect();
		const centerX = (rect.width / 2 - this.panX) / this.scale;
		const centerY = (rect.height / 2 - this.panY) / this.scale;
		this.addLinkNode(url, centerX - 150, centerY - 100);
	}

	addLinkNode(url: string, x: number, y: number): void {
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

	parsePath(input: string): string {
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

	resolveVaultItem(path: string): TFile | TFolder | null {
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

	getAllFolders(folder: TFolder): TFolder[] {
		const folders: TFolder[] = [folder];
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				folders.push(...this.getAllFolders(child));
			}
		}
		return folders;
	}

	getMdFilesFromFolder(folder: TFolder): TFile[] {
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

	addNoteNode(filePath: string, content: string, x: number, y: number): void {
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

	async fetchLinkMetadata(url: string, nodeId: string): Promise<void> {
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

	async fetchYouTubeMetadata(url: string, node: CanvasNode): Promise<void> {
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

	async fetchTwitterMetadata(url: string, node: CanvasNode): Promise<void> {
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

	async fetchWebPageMetadata(url: string, node: CanvasNode): Promise<void> {
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

	extractPageContent(doc: Document, url: string): string {
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

	extractJsonLdContent(doc: Document): string {
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

	extractHtmlContent(doc: Document): string {
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

	extractMetaContent(doc: Document): string {
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

	rerenderNode(nodeId: string): void {
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

export default class CanvasChatPlugin extends Plugin {
	settings: PluginSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		// Register the view
		this.registerView(VIEW_TYPE_CANVAS_CHAT, (leaf) => new CanvasChatView(leaf, this));

		// Register file extension
		this.registerExtensions([FILE_EXTENSION], VIEW_TYPE_CANVAS_CHAT);

		// Add ribbon icon
		this.addRibbonIcon("layout-dashboard", "Create new Canvas Chat", async () => {
			await this.createNewCanvas();
		});

		// Add command to create new canvas
		this.addCommand({
			id: "create-new-canvas-chat",
			name: "Create new Canvas Chat canvas",
			callback: async () => {
				await this.createNewCanvas();
			},
		});

		// Add context menu for folders
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file) => {
				if (file instanceof TFolder) {
					menu.addItem((item) => {
						item.setTitle("New Canvas Chat")
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
		const initialData: CanvasChatData = {
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
