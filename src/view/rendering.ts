import {
	Menu,
	Notice,
	MarkdownRenderer,
	Component,
	setIcon,
	TFile,
	TFolder,
} from "obsidian";
import type { CanvasChatView } from "../../main";
import type { CanvasNode, ChatMessage, Edge, ChatNodeState } from "../types";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_CONTEXT_TEMPLATE } from "../constants";
import { PromptEditorModal } from "../modals";
import { callLLM } from "../llm";
import { updateMinimap } from "./minimap";

export function renderAllEdges(view: CanvasChatView): void {
	// Clear existing edge elements
	view.edgesContainer.innerHTML = "";

	for (const edge of view.edges.values()) {
		renderEdge(view, edge);
	}
}

export function renderEdge(view: CanvasChatView, edge: Edge): void {
	const fromNode = view.nodes.get(edge.from);
	const toNode = view.nodes.get(edge.to);
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
		view.showEdgeContextMenu(edge.id, e as MouseEvent);
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

	view.edgesContainer.appendChild(group);
}

export function renderNode(view: CanvasChatView, node: CanvasNode): void {
	if (!view.nodesContainer) return;

	const el = view.nodesContainer.createDiv({
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
		view.showTitleEditor(node, titleSpan, titleContainer);
	};

	// Export to MD button (only for chat nodes)
	if (node.type === "chat") {
		const exportBtn = titleContainer.createEl("button", { cls: "rabbitmap-export-btn" });
		exportBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
		exportBtn.title = "Save as MD";

		exportBtn.onclick = (e) => {
			e.stopPropagation();
			view.exportChatToMd(node);
		};

		// Expand chat button
		const expandBtn = titleContainer.createEl("button", { cls: "rabbitmap-expand-btn" });
		expandBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
		expandBtn.title = "Expand chat";

		expandBtn.onclick = (e) => {
			e.stopPropagation();
			view.openExpandedChat(node.id);
		};
	}

	// Delete button
	const deleteBtn = header.createEl("button", { text: "\u00D7", cls: "rabbitmap-delete-btn" });
	deleteBtn.onclick = (e) => {
		e.stopPropagation();
		view.deleteNode(node.id);
	};

	// Make header draggable
	header.addEventListener("mousedown", (e) => {
		if (e.button === 0 && !view.spacePressed) {
			e.stopPropagation();

			// Handle selection
			if (e.shiftKey) {
				// Toggle selection with shift
				if (view.selectedNodes.has(node.id)) {
					view.deselectNode(node.id);
				} else {
					view.selectNode(node.id);
				}
			} else if (!view.selectedNodes.has(node.id)) {
				// Click on unselected node - clear others and select this one
				view.clearSelection();
				view.selectNode(node.id);
			}

			// Start drag
			view.draggedNode = node.id;
			const rect = el.getBoundingClientRect();
			view.dragOffsetX = (e.clientX - rect.left) / view.scale;
			view.dragOffsetY = (e.clientY - rect.top) / view.scale;

			// Store start mouse position in canvas coords
			const canvasRect = view.canvas.getBoundingClientRect();
			view.dragStartMouseX = (e.clientX - canvasRect.left - view.panX) / view.scale;
			view.dragStartMouseY = (e.clientY - canvasRect.top - view.panY) / view.scale;

			// Store start positions for all selected nodes
			view.dragStartPositions.clear();
			for (const nodeId of view.selectedNodes) {
				const n = view.nodes.get(nodeId);
				if (n) {
					view.dragStartPositions.set(nodeId, { x: n.x, y: n.y });
				}
			}
		}
	});

	// Double-click to zoom to node
	header.addEventListener("dblclick", (e) => {
		e.stopPropagation();
		view.zoomToNode(node.id);
	});

	// Right-click context menu
	el.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		e.stopPropagation();

		// Multi-select context menu takes priority
		if (view.selectedNodes.size >= 2 && view.selectedNodes.has(node.id)) {
			view.showMultiSelectContextMenu(e);
			return;
		}

		if (node.type === "chat") {
			view.showChatContextMenu(node.id, e);
		} else if (node.type === "link") {
			view.showLinkContextMenu(node.id, e);
		} else if (node.type === "note") {
			view.showNoteContextMenu(node.id, e);
		}
	});

	// Content area
	const content = el.createDiv({ cls: "rabbitmap-node-content" });

	if (node.type === "chat") {
		renderChatContent(view, node.id, content);
	} else if (node.type === "link") {
		renderLinkContent(view, node, content);
	} else if (node.type === "note") {
		renderNoteContent(view, node, content);
	} else {
		renderCardContent(view, node, content);
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
			view.startEdgeDrawing(node.id, side, e);
		});
	}

	// Resize handle
	const resizeHandle = el.createDiv({ cls: "rabbitmap-resize-handle" });
	resizeHandle.addEventListener("mousedown", (e) => {
		if (e.button === 0) {
			e.stopPropagation();
			e.preventDefault();
			view.resizingNode = node.id;
			view.resizeStartWidth = node.width;
			view.resizeStartHeight = node.height;
			view.resizeStartX = e.clientX;
			view.resizeStartY = e.clientY;
		}
	});

	view.nodeElements.set(node.id, el);
}

export function renderLinkContent(view: CanvasChatView, node: CanvasNode, container: HTMLElement): void {
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
	info.createDiv({
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

export function renderCardContent(view: CanvasChatView, node: CanvasNode, container: HTMLElement): void {
	const textarea = container.createEl("textarea", {
		cls: "rabbitmap-card-textarea",
		attr: { placeholder: "Write something..." },
	});
	textarea.value = node.content;
	textarea.addEventListener("input", () => {
		node.content = textarea.value;
		view.triggerSave();
	});
	// Prevent wheel events from bubbling to canvas
	textarea.addEventListener("wheel", (e) => {
		e.stopPropagation();
	});
}

export function renderNoteContent(view: CanvasChatView, node: CanvasNode, container: HTMLElement): void {
	container.addClass("rabbitmap-note-content");

	// Rendered markdown area
	const markdownContainer = container.createDiv({ cls: "rabbitmap-note-markdown" });
	MarkdownRenderer.render(
		view.app,
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
			view.app.workspace.openLinkText(node.filePath!, "", false);
		});
	}

	// Prevent wheel events from bubbling to canvas
	container.addEventListener("wheel", (e) => {
		e.stopPropagation();
	});
}

export function renderChatContent(view: CanvasChatView, nodeId: string, container: HTMLElement): void {
	// Header bar
	const headerBar = container.createDiv({ cls: "rabbitmap-chat-header" });
	const headerIcon = headerBar.createSpan({ cls: "rabbitmap-chat-header-icon" });
	setIcon(headerIcon, "message-square");
	headerBar.createSpan({ text: "Canvas Chat", cls: "rabbitmap-chat-header-title" });

	// Click on header selects the node
	headerBar.addEventListener("mousedown", (e) => {
		e.stopPropagation();
		if (!view.selectedNodes.has(nodeId)) {
			view.clearSelection();
			view.selectNode(nodeId);
		}
	});

	// Get current state or use defaults
	let state = view.chatStates.get(nodeId);
	if (!state) {
		const defaultProvider = view.plugin.settings.providers[0];
		state = {
			provider: defaultProvider.name,
			model: defaultProvider.models[0],
			contextFiles: [],
			contextNodes: [],
			systemPrompt: DEFAULT_SYSTEM_PROMPT,
			contextTemplate: DEFAULT_CONTEXT_TEMPLATE
		};
		view.chatStates.set(nodeId, state);
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
	for (const provider of view.plugin.settings.providers) {
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
		const currentState = view.chatStates.get(nodeId)!;
		const provider = view.plugin.settings.providers.find(p => p.name === currentState.provider);
		if (!provider) return;

		let models = provider.models;
		if (provider.name === "OpenRouter" && view.plugin.settings.customOpenRouterModels.trim()) {
			models = view.plugin.settings.customOpenRouterModels
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
		const provider = view.plugin.settings.providers.find(p => p.name === newProvider);
		if (provider) {
			let models = provider.models;
			if (provider.name === "OpenRouter" && view.plugin.settings.customOpenRouterModels.trim()) {
				models = view.plugin.settings.customOpenRouterModels
					.split("\n")
					.map(m => m.trim())
					.filter(m => m.length > 0);
			}

			const currentState = view.chatStates.get(nodeId);
			const newState: ChatNodeState = {
				provider: newProvider,
				model: models[0],
				contextFiles: currentState?.contextFiles || [],
				contextNodes: currentState?.contextNodes || [],
				systemPrompt: currentState?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
				contextTemplate: currentState?.contextTemplate || DEFAULT_CONTEXT_TEMPLATE
			};
			view.chatStates.set(nodeId, newState);
			updateModelOptions();
			view.triggerSave();
		}
	};

	modelSelect.onchange = () => {
		const currentState = view.chatStates.get(nodeId)!;
		currentState.model = modelSelect.value;
		view.chatStates.set(nodeId, currentState);
		view.triggerSave();
		if (modelLabel) {
			modelLabel.textContent = formatModelName(currentState.model) + " \u25BE";
		}
	};

	// --- Messages container ---
	const messagesContainer = container.createDiv({ cls: "rabbitmap-chat-messages" });

	messagesContainer.addEventListener("wheel", (e: WheelEvent) => {
		if (view.selectedNodes.has(nodeId)) {
			e.stopPropagation();
		}
	});

	messagesContainer.addEventListener("mousedown", (e: MouseEvent) => {
		e.stopPropagation();
		if (!view.selectedNodes.has(nodeId)) {
			view.clearSelection();
			view.selectNode(nodeId);
		}
	});

	const messages = view.chatMessages.get(nodeId) || [];
	messages.forEach((msg, index) => {
		renderChatMessage(view, messagesContainer, msg, nodeId, index);
	});

	// --- Bottom composite section ---
	const bottomSection = container.createDiv({ cls: "rabbitmap-chat-bottom" });

	// Context chips
	const contextChips = bottomSection.createDiv({ cls: "rabbitmap-chat-chips" });

	const renderContextFiles = () => {
		// Remove only file chips (not node chips)
		contextChips.querySelectorAll(".rabbitmap-chat-chip:not(.rabbitmap-chat-chip-node)").forEach(el => el.remove());
		const currentState = view.chatStates.get(nodeId);
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
				const s = view.chatStates.get(nodeId);
				if (s) {
					s.contextFiles = s.contextFiles.filter(f => f !== filePath);
					view.chatStates.set(nodeId, s);
					renderContextFiles();
					view.triggerSave();
				}
			};
		}
	};

	renderContextFiles();

	const renderContextNodes = () => {
		contextChips.querySelectorAll(".rabbitmap-chat-chip-node").forEach(el => el.remove());
		const currentState = view.chatStates.get(nodeId);
		if (!currentState || !currentState.contextNodes || currentState.contextNodes.length === 0) return;

		for (const connectedId of currentState.contextNodes) {
			const connectedNode = view.nodes.get(connectedId);
			if (!connectedNode) continue;

			const chip = contextChips.createDiv({ cls: "rabbitmap-chat-chip rabbitmap-chat-chip-node" });
			const chipIcon = chip.createSpan({ cls: "rabbitmap-chat-chip-icon" });
			setIcon(chipIcon, "share-2");
			const label = connectedNode.title || connectedNode.linkTitle || connectedNode.url || connectedNode.type;
			chip.createSpan({ text: `${label}`, cls: "rabbitmap-chat-chip-name" });

			const removeBtn = chip.createEl("button", { text: "\u00D7", cls: "rabbitmap-chat-chip-remove" });
			removeBtn.onclick = (e: MouseEvent) => {
				e.stopPropagation();
				const s = view.chatStates.get(nodeId);
				if (s) {
					s.contextNodes = s.contextNodes.filter(id => id !== connectedId);
					view.chatStates.set(nodeId, s);
					renderContextNodes();
					view.triggerSave();
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
		if (!view.selectedNodes.has(nodeId)) {
			view.clearSelection();
			view.selectNode(nodeId);
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
		const currentState = view.chatStates.get(nodeId);
		new PromptEditorModal(
			view.app,
			currentState?.systemPrompt || "",
			currentState?.contextTemplate || DEFAULT_CONTEXT_TEMPLATE,
			(newPrompt, newTemplate) => {
				const st = view.chatStates.get(nodeId);
				if (st) {
					st.systemPrompt = newPrompt;
					st.contextTemplate = newTemplate;
					view.chatStates.set(nodeId, st);
					view.triggerSave();
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

		const parsePath = (inputStr: string): string => {
			inputStr = inputStr.trim();

			if (inputStr.startsWith("obsidian://")) {
				try {
					const url = new URL(inputStr);
					const filePath = url.searchParams.get("file");
					if (filePath) {
						return decodeURIComponent(filePath);
					}
				} catch {}
			}

			try {
				inputStr = decodeURIComponent(inputStr);
			} catch {}

			const wikiMatch = inputStr.match(/^\[\[(.+?)\]\]$/);
			if (wikiMatch) {
				return wikiMatch[1];
			}

			const mdMatch = inputStr.match(/^\[.+?\]\((.+?)\)$/);
			if (mdMatch) {
				return mdMatch[1];
			}

			if (inputStr.startsWith("/")) {
				inputStr = inputStr.slice(1);
			}

			return inputStr;
		};

		const addFilesFromFolder = (folder: TFolder, chatState: ChatNodeState) => {
			for (const child of folder.children) {
				if (child instanceof TFile) {
					if (!chatState.contextFiles.includes(child.path)) {
						chatState.contextFiles.push(child.path);
					}
				} else if (child instanceof TFolder) {
					addFilesFromFolder(child, chatState);
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

		const tryAddPath = (inputStr: string) => {
			if (!inputStr) return false;

			let path = parsePath(inputStr);
			if (!path) return false;

			if (path.startsWith("http")) {
				const canvasRect = view.canvas.getBoundingClientRect();
				const x = (e.clientX - canvasRect.left - view.panX) / view.scale;
				const y = (e.clientY - canvasRect.top - view.panY) / view.scale;
				view.addLinkNode(path, x - 150, y - 100);
				return true;
			}

			let item = view.app.vault.getAbstractFileByPath(path);

			if (!item && !path.includes(".")) {
				item = view.app.vault.getAbstractFileByPath(path + ".md");
				if (item) path = path + ".md";
			}

			if (!item && !path.includes(".")) {
				const rootFolder = view.app.vault.getRoot();
				const allFolders = getAllFolders(rootFolder);
				const folderName = path.split("/").pop() || path;
				item = allFolders.find(f =>
					f.path === path ||
					f.name === folderName ||
					f.path.endsWith("/" + path)
				) || null;
			}

			if (!item) {
				const allFiles = view.app.vault.getFiles();
				const fileName = path.split("/").pop() || path;
				item = allFiles.find(f =>
					f.path === path ||
					f.name === fileName ||
					f.basename === fileName ||
					f.path.endsWith("/" + path)
				) || null;
				if (item) path = item.path;
			}

			const chatState = view.chatStates.get(nodeId);
			if (!chatState) return false;

			if (item instanceof TFolder) {
				addFilesFromFolder(item, chatState);
				return true;
			}

			if (item instanceof TFile) {
				if (!chatState.contextFiles.includes(path)) {
					chatState.contextFiles.push(path);
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
			const chatState = view.chatStates.get(nodeId);
			if (chatState) {
				view.chatStates.set(nodeId, chatState);
				renderContextFiles();
				view.triggerSave();
			}
		}
	});

	// --- Send message logic ---
	const sendMessage = async () => {
		const text = input.value.trim();
		if (!text) return;

		const chatState = view.chatStates.get(nodeId)!;

		const msg: ChatMessage = {
			role: "user",
			content: text,
			contextFiles: chatState.contextFiles ? [...chatState.contextFiles] : []
		};
		const allMessages = view.chatMessages.get(nodeId) || [];
		allMessages.push(msg);
		view.chatMessages.set(nodeId, allMessages);
		renderChatMessage(view, messagesContainer, msg, nodeId, allMessages.length - 1);
		input.value = "";
		messagesContainer.scrollTop = messagesContainer.scrollHeight;
		view.triggerSave();
		const provider = view.plugin.settings.providers.find(p => p.name === chatState.provider);
		if (!provider) return;

		const apiKey = provider.apiKey || "";

		if (!apiKey) {
			const errorMsg: ChatMessage = {
				role: "assistant",
				content: `Please set your ${chatState.provider} API key in settings.`,
			};
			allMessages.push(errorMsg);
			renderChatMessage(view, messagesContainer, errorMsg, nodeId, allMessages.length - 1);
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
			view.triggerSave();
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
				const file = view.app.vault.getAbstractFileByPath(filePath);
				if (file && file instanceof TFile) {
					try {
						const content = await view.app.vault.read(file);
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
			const nodeContent = view.getConnectedContent(chatState.contextNodes);
			if (nodeContent) {
				contextContent = contextContent
					? contextContent + "\n\n" + nodeContent
					: nodeContent;
			}
		}

		try {
			const response = await callLLM(provider, apiKey, chatState.model, allMessages, contextContent, chatState.systemPrompt || "");
			loadingEl.remove();

			const assistantMsg: ChatMessage = {
				role: "assistant",
				content: response,
			};
			allMessages.push(assistantMsg);
			renderChatMessage(view, messagesContainer, assistantMsg, nodeId, allMessages.length - 1);
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
			view.triggerSave();
		} catch (error) {
			loadingEl.remove();
			const errorMsg: ChatMessage = {
				role: "assistant",
				content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
			allMessages.push(errorMsg);
			renderChatMessage(view, messagesContainer, errorMsg, nodeId, allMessages.length - 1);
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
			view.triggerSave();
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

export function renderChatMessage(view: CanvasChatView, container: HTMLElement, msg: ChatMessage, nodeId: string, msgIndex: number): void {
	const msgEl = container.createDiv({
		cls: `rabbitmap-chat-message rabbitmap-chat-${msg.role}`,
	});

	// Render markdown for assistant messages, plain text for user
	if (msg.role === "assistant") {
		const contentEl = msgEl.createDiv({ cls: "rabbitmap-message-content" });
		MarkdownRenderer.render(
			view.app,
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
		view.showMessageContextMenu(nodeId, msgIndex, e);
	});
}

export function rerenderNode(view: CanvasChatView, nodeId: string): void {
	const el = view.nodeElements.get(nodeId);
	const node = view.nodes.get(nodeId);
	if (!el || !node) return;

	el.remove();
	view.nodeElements.delete(nodeId);
	renderNode(view, node);
}
