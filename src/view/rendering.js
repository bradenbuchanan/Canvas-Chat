var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Notice, MarkdownRenderer, setIcon, TFile, TFolder, } from "obsidian";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_CONTEXT_TEMPLATE } from "../constants";
import { PromptEditorModal } from "../modals";
import { callLLM } from "../llm";
export function renderAllEdges(view) {
    // Clear existing edge elements
    while (view.edgesContainer.firstChild)
        view.edgesContainer.firstChild.remove();
    for (const edge of view.edges.values()) {
        renderEdge(view, edge);
    }
}
export function renderEdge(view, edge) {
    const fromNode = view.nodes.get(edge.from);
    const toNode = view.nodes.get(edge.to);
    if (!fromNode || !toNode)
        return;
    // Calculate connection points
    const fromCenterX = fromNode.x + fromNode.width / 2;
    const fromCenterY = fromNode.y + fromNode.height / 2;
    const toCenterX = toNode.x + toNode.width / 2;
    const toCenterY = toNode.y + toNode.height / 2;
    // Determine which sides to connect
    let fromX, fromY, toX, toY;
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
        }
        else {
            // To is on the left
            fromX = fromNode.x;
            fromY = fromCenterY;
            toX = toNode.x + toNode.width;
            toY = toCenterY;
        }
    }
    else {
        // Vertical connection
        if (dy > 0) {
            // To is below
            fromX = fromCenterX;
            fromY = fromNode.y + fromNode.height;
            toX = toCenterX;
            toY = toNode.y;
        }
        else {
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
    group.setAttribute("class", "rabbitmap-edge-group");
    // Create path element
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "rabbitmap-edge");
    // Create a curved path
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    // Bezier curve control points
    let cx1, cy1, cx2, cy2;
    if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal: curve horizontally
        cx1 = midX;
        cy1 = fromY;
        cx2 = midX;
        cy2 = toY;
    }
    else {
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
    group.addEventListener("mouseenter", () => {
        path.classList.add("rabbitmap-edge-hover");
    });
    group.addEventListener("mouseleave", () => {
        path.classList.remove("rabbitmap-edge-hover");
    });
    group.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        view.showEdgeContextMenu(edge.id, e);
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
export function renderNode(view, node) {
    if (!view.nodesContainer)
        return;
    const el = view.nodesContainer.createDiv({
        cls: `rabbitmap-node rabbitmap-node-${node.type}`,
    });
    el.setCssStyles({
        left: `${node.x}px`,
        top: `${node.y}px`,
        width: `${node.width}px`,
        height: `${node.height}px`,
    });
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
    setIcon(editTitleBtn, "pencil");
    editTitleBtn.onclick = (e) => {
        e.stopPropagation();
        view.showTitleEditor(node, titleSpan, titleContainer);
    };
    // Export to MD button (only for chat nodes)
    if (node.type === "chat") {
        const exportBtn = titleContainer.createEl("button", { cls: "rabbitmap-export-btn" });
        setIcon(exportBtn, "download");
        exportBtn.title = "Save as Markdown";
        exportBtn.onclick = (e) => {
            e.stopPropagation();
            void view.exportChatToMd(node);
        };
        // Expand chat button
        const expandBtn = titleContainer.createEl("button", { cls: "rabbitmap-expand-btn" });
        setIcon(expandBtn, "maximize-2");
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
                }
                else {
                    view.selectNode(node.id);
                }
            }
            else if (!view.selectedNodes.has(node.id)) {
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
        }
        else if (node.type === "link") {
            view.showLinkContextMenu(node.id, e);
        }
        else if (node.type === "note") {
            view.showNoteContextMenu(node.id, e);
        }
    });
    // Content area
    const content = el.createDiv({ cls: "rabbitmap-node-content" });
    if (node.type === "chat") {
        renderChatContent(view, node.id, content);
    }
    else if (node.type === "link") {
        renderLinkContent(view, node, content);
    }
    else if (node.type === "note") {
        renderNoteContent(view, node, content);
    }
    else {
        renderCardContent(view, node, content);
    }
    // Connection handles
    const sides = ["top", "right", "bottom", "left"];
    for (const side of sides) {
        const handle = el.createDiv({ cls: `rabbitmap-connection-handle rabbitmap-handle-${side}` });
        handle.setAttribute("data-node-id", node.id);
        handle.setAttribute("data-side", side);
        handle.addEventListener("mousedown", (e) => {
            if (e.button !== 0)
                return;
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
export function renderLinkContent(view, node, container) {
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
        }
        catch ( /* noop */_a) { /* noop */ }
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
        text: "Open link",
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
export function renderCardContent(view, node, container) {
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
export function renderNoteContent(view, node, container) {
    container.addClass("rabbitmap-note-content");
    // Rendered markdown area
    const markdownContainer = container.createDiv({ cls: "rabbitmap-note-markdown" });
    void MarkdownRenderer.render(view.app, node.content, markdownContainer, node.filePath || "", view);
    // Open in Obsidian button
    if (node.filePath) {
        const openBtn = container.createEl("button", {
            cls: "rabbitmap-note-open-btn",
            text: "Open in Obsidian",
        });
        openBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            void view.app.workspace.openLinkText(node.filePath, "", false);
        });
    }
    // Prevent wheel events from bubbling to canvas
    container.addEventListener("wheel", (e) => {
        e.stopPropagation();
    });
}
export function renderChatContent(view, nodeId, container) {
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
    const formatModelName = (model) => {
        if (model.length <= 20)
            return model;
        const parts = model.split(/[-/]/);
        return parts.slice(-2).join("-").substring(0, 20);
    };
    // Will be set after toolbar is created
    let modelLabel;
    const updateModelOptions = () => {
        const currentState = view.chatStates.get(nodeId);
        const provider = view.plugin.settings.providers.find(p => p.name === currentState.provider);
        if (!provider)
            return;
        let models = provider.models;
        if (provider.name === "OpenRouter" && view.plugin.settings.customOpenRouterModels.trim()) {
            models = view.plugin.settings.customOpenRouterModels
                .split("\n")
                .map(m => m.trim())
                .filter(m => m.length > 0);
        }
        while (modelSelect.firstChild)
            modelSelect.firstChild.remove();
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
            const newState = {
                provider: newProvider,
                model: models[0],
                contextFiles: (currentState === null || currentState === void 0 ? void 0 : currentState.contextFiles) || [],
                contextNodes: (currentState === null || currentState === void 0 ? void 0 : currentState.contextNodes) || [],
                systemPrompt: (currentState === null || currentState === void 0 ? void 0 : currentState.systemPrompt) || DEFAULT_SYSTEM_PROMPT,
                contextTemplate: (currentState === null || currentState === void 0 ? void 0 : currentState.contextTemplate) || DEFAULT_CONTEXT_TEMPLATE
            };
            view.chatStates.set(nodeId, newState);
            updateModelOptions();
            view.triggerSave();
        }
    };
    modelSelect.onchange = () => {
        const currentState = view.chatStates.get(nodeId);
        currentState.model = modelSelect.value;
        view.chatStates.set(nodeId, currentState);
        view.triggerSave();
        if (modelLabel) {
            modelLabel.textContent = formatModelName(currentState.model) + " \u25BE";
        }
    };
    // --- Messages container ---
    const messagesContainer = container.createDiv({ cls: "rabbitmap-chat-messages" });
    messagesContainer.addEventListener("wheel", (e) => {
        if (view.selectedNodes.has(nodeId)) {
            e.stopPropagation();
        }
    });
    messagesContainer.addEventListener("mousedown", (e) => {
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
        if (!currentState || currentState.contextFiles.length === 0)
            return;
        for (const filePath of currentState.contextFiles) {
            const chip = contextChips.createDiv({ cls: "rabbitmap-chat-chip" });
            const chipIcon = chip.createSpan({ cls: "rabbitmap-chat-chip-icon" });
            setIcon(chipIcon, "file-text");
            const fileName = filePath.split("/").pop() || filePath;
            chip.createSpan({ text: fileName, cls: "rabbitmap-chat-chip-name" });
            const removeBtn = chip.createEl("button", { text: "\u00D7", cls: "rabbitmap-chat-chip-remove" });
            removeBtn.onclick = (e) => {
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
        if (!currentState || !currentState.contextNodes || currentState.contextNodes.length === 0)
            return;
        for (const connectedId of currentState.contextNodes) {
            const connectedNode = view.nodes.get(connectedId);
            if (!connectedNode)
                continue;
            const chip = contextChips.createDiv({ cls: "rabbitmap-chat-chip rabbitmap-chat-chip-node" });
            const chipIcon = chip.createSpan({ cls: "rabbitmap-chat-chip-icon" });
            setIcon(chipIcon, "share-2");
            const label = connectedNode.title || connectedNode.linkTitle || connectedNode.url || connectedNode.type;
            chip.createSpan({ text: `${label}`, cls: "rabbitmap-chat-chip-name" });
            const removeBtn = chip.createEl("button", { text: "\u00D7", cls: "rabbitmap-chat-chip-remove" });
            removeBtn.onclick = (e) => {
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
    attachBtn.onclick = (e) => {
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
    promptBtn.onclick = (e) => {
        e.stopPropagation();
        const currentState = view.chatStates.get(nodeId);
        new PromptEditorModal(view.app, (currentState === null || currentState === void 0 ? void 0 : currentState.systemPrompt) || "", (currentState === null || currentState === void 0 ? void 0 : currentState.contextTemplate) || DEFAULT_CONTEXT_TEMPLATE, (newPrompt, newTemplate) => {
            const st = view.chatStates.get(nodeId);
            if (st) {
                st.systemPrompt = newPrompt;
                st.contextTemplate = newTemplate;
                view.chatStates.set(nodeId, st);
                view.triggerSave();
            }
        }).open();
    };
    // Model label + popover
    const modelLabelContainer = toolbarRight.createDiv({ cls: "rabbitmap-chat-model-container" });
    modelLabel = modelLabelContainer.createSpan({ cls: "rabbitmap-chat-model-label" });
    modelLabel.textContent = formatModelName(state.model) + " \u25BE";
    const popover = modelLabelContainer.createDiv({ cls: "rabbitmap-chat-model-popover" });
    popover.addClass("is-hidden");
    popover.appendChild(providerSelect);
    popover.appendChild(modelSelect);
    let popoverOpen = false;
    modelLabel.onclick = (e) => {
        e.stopPropagation();
        popoverOpen = !popoverOpen;
        popover.toggleClass("is-hidden", !popoverOpen);
    };
    document.addEventListener("click", () => {
        if (popoverOpen) {
            popoverOpen = false;
            popover.addClass("is-hidden");
        }
    });
    popover.addEventListener("click", (e) => {
        e.stopPropagation();
    });
    // Send button (circular with arrow)
    const sendBtn = toolbarRight.createEl("button", { cls: "rabbitmap-send-btn" });
    setIcon(sendBtn, "arrow-up");
    // --- Drag and drop handling (on container) ---
    container.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        container.addClass("rabbitmap-drag-over");
    });
    container.addEventListener("dragleave", (e) => {
        e.preventDefault();
        container.removeClass("rabbitmap-drag-over");
    });
    container.addEventListener("drop", (e) => {
        var _a;
        e.preventDefault();
        e.stopPropagation();
        container.removeClass("rabbitmap-drag-over");
        const plainText = ((_a = e.dataTransfer) === null || _a === void 0 ? void 0 : _a.getData("text/plain")) || "";
        const parsePath = (inputStr) => {
            inputStr = inputStr.trim();
            if (inputStr.startsWith("obsidian://")) {
                try {
                    const url = new URL(inputStr);
                    const filePath = url.searchParams.get("file");
                    if (filePath) {
                        return decodeURIComponent(filePath);
                    }
                }
                catch ( /* noop */_a) { /* noop */ }
            }
            try {
                inputStr = decodeURIComponent(inputStr);
            }
            catch ( /* noop */_b) { /* noop */ }
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
        const addFilesFromFolder = (folder, chatState) => {
            for (const child of folder.children) {
                if (child instanceof TFile) {
                    if (!chatState.contextFiles.includes(child.path)) {
                        chatState.contextFiles.push(child.path);
                    }
                }
                else if (child instanceof TFolder) {
                    addFilesFromFolder(child, chatState);
                }
            }
        };
        const getAllFolders = (folder) => {
            const folders = [folder];
            for (const child of folder.children) {
                if (child instanceof TFolder) {
                    folders.push(...getAllFolders(child));
                }
            }
            return folders;
        };
        const tryAddPath = (inputStr) => {
            if (!inputStr)
                return false;
            let path = parsePath(inputStr);
            if (!path)
                return false;
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
                if (item)
                    path = path + ".md";
            }
            if (!item && !path.includes(".")) {
                const rootFolder = view.app.vault.getRoot();
                const allFolders = getAllFolders(rootFolder);
                const folderName = path.split("/").pop() || path;
                item = allFolders.find(f => f.path === path ||
                    f.name === folderName ||
                    f.path.endsWith("/" + path)) || null;
            }
            if (!item) {
                const allFiles = view.app.vault.getFiles();
                const fileName = path.split("/").pop() || path;
                item = allFiles.find(f => f.path === path ||
                    f.name === fileName ||
                    f.basename === fileName ||
                    f.path.endsWith("/" + path)) || null;
                if (item)
                    path = item.path;
            }
            const chatState = view.chatStates.get(nodeId);
            if (!chatState)
                return false;
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
    const sendMessage = () => __awaiter(this, void 0, void 0, function* () {
        const text = input.value.trim();
        if (!text)
            return;
        const chatState = view.chatStates.get(nodeId);
        const msg = {
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
        if (!provider)
            return;
        const apiKey = provider.apiKey || "";
        if (!apiKey) {
            const errorMsg = {
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
            const contextParts = [];
            for (const filePath of chatState.contextFiles) {
                const file = view.app.vault.getAbstractFileByPath(filePath);
                if (file && file instanceof TFile) {
                    try {
                        const content = yield view.app.vault.read(file);
                        const formatted = template
                            .replace(/\{filepath\}/g, filePath)
                            .replace(/\{filename\}/g, file.name)
                            .replace(/\{content\}/g, content);
                        contextParts.push(formatted);
                    }
                    catch ( /* noop */_a) { /* noop */ }
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
            const response = yield callLLM(provider, apiKey, chatState.model, allMessages, contextContent, chatState.systemPrompt || "");
            loadingEl.remove();
            const assistantMsg = {
                role: "assistant",
                content: response,
            };
            allMessages.push(assistantMsg);
            renderChatMessage(view, messagesContainer, assistantMsg, nodeId, allMessages.length - 1);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            view.triggerSave();
        }
        catch (error) {
            loadingEl.remove();
            const errorMsg = {
                role: "assistant",
                content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
            allMessages.push(errorMsg);
            renderChatMessage(view, messagesContainer, errorMsg, nodeId, allMessages.length - 1);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            view.triggerSave();
        }
    });
    sendBtn.onclick = () => void sendMessage();
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void sendMessage();
        }
    });
}
export function renderChatMessage(view, container, msg, nodeId, msgIndex) {
    const msgEl = container.createDiv({
        cls: `rabbitmap-chat-message rabbitmap-chat-${msg.role}`,
    });
    // Render markdown for assistant messages, plain text for user
    if (msg.role === "assistant") {
        const contentEl = msgEl.createDiv({ cls: "rabbitmap-message-content" });
        void MarkdownRenderer.render(view.app, msg.content, contentEl, "", view);
    }
    else {
        msgEl.createSpan({ text: msg.content });
    }
    // Context menu on right click
    msgEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        view.showMessageContextMenu(nodeId, msgIndex, e);
    });
}
export function rerenderNode(view, nodeId) {
    const el = view.nodeElements.get(nodeId);
    const node = view.nodes.get(nodeId);
    if (!el || !node)
        return;
    el.remove();
    view.nodeElements.delete(nodeId);
    renderNode(view, node);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicmVuZGVyaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLE9BQU8sRUFDTixNQUFNLEVBQ04sZ0JBQWdCLEVBQ2hCLE9BQU8sRUFDUCxLQUFLLEVBQ0wsT0FBTyxHQUNQLE1BQU0sVUFBVSxDQUFDO0FBR2xCLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSx3QkFBd0IsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUMvRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFDOUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUVqQyxNQUFNLFVBQVUsY0FBYyxDQUFDLElBQW9CO0lBQ2xELCtCQUErQjtJQUMvQixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsVUFBVTtRQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDO0lBRS9FLEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDO1FBQ3hDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDeEIsQ0FBQztBQUNGLENBQUM7QUFFRCxNQUFNLFVBQVUsVUFBVSxDQUFDLElBQW9CLEVBQUUsSUFBVTtJQUMxRCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDM0MsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZDLElBQUksQ0FBQyxRQUFRLElBQUksQ0FBQyxNQUFNO1FBQUUsT0FBTztJQUVqQyw4QkFBOEI7SUFDOUIsTUFBTSxXQUFXLEdBQUcsUUFBUSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsS0FBSyxH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cEIsSUFBSSxDQUFDLHNCQUFzQixDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDbEQsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQsTUFBTSxVQUFVLFlBQVksQ0FBQyxJQUFvQixFQUFFLE1BQWM7SUFDaEUsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDekMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDcEMsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUk7UUFBRSxPQUFPO0lBRXpCLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUNaLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2pDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDeEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG5cdE5vdGljZSxcblx0TWFya2Rvd25SZW5kZXJlcixcblx0c2V0SWNvbixcblx0VEZpbGUsXG5cdFRGb2xkZXIsXG59IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgeyBDYW52YXNDaGF0VmlldyB9IGZyb20gXCIuLi9tYWluXCI7XG5pbXBvcnQgdHlwZSB7IENhbnZhc05vZGUsIENoYXRNZXNzYWdlLCBFZGdlLCBDaGF0Tm9kZVN0YXRlIH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5pbXBvcnQgeyBERUZBVUxUX1NZU1RFTV9QUk9NUFQsIERFRkFVTFRfQ09OVEVYVF9URU1QTEFURSB9IGZyb20gXCIuLi9jb25zdGFudHNcIjtcbmltcG9ydCB7IFByb21wdEVkaXRvck1vZGFsIH0gZnJvbSBcIi4uL21vZGFsc1wiO1xuaW1wb3J0IHsgY2FsbExMTSB9IGZyb20gXCIuLi9sbG1cIjtcblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckFsbEVkZ2VzKHZpZXc6IENhbnZhc0NoYXRWaWV3KTogdm9pZCB7XG5cdC8vIENsZWFyIGV4aXN0aW5nIGVkZ2UgZWxlbWVudHNcblx0d2hpbGUgKHZpZXcuZWRnZXNDb250YWluZXIuZmlyc3RDaGlsZCkgdmlldy5lZGdlc0NvbnRhaW5lci5maXJzdENoaWxkLnJlbW92ZSgpO1xuXG5cdGZvciAoY29uc3QgZWRnZSBvZiB2aWV3LmVkZ2VzLnZhbHVlcygpKSB7XG5cdFx0cmVuZGVyRWRnZSh2aWV3LCBlZGdlKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyRWRnZSh2aWV3OiBDYW52YXNDaGF0VmlldywgZWRnZTogRWRnZSk6IHZvaWQge1xuXHRjb25zdCBmcm9tTm9kZSA9IHZpZXcubm9kZXMuZ2V0KGVkZ2UuZnJvbSk7XG5cdGNvbnN0IHRvTm9kZSA9IHZpZXcubm9kZXMuZ2V0KGVkZ2UudG8pO1xuXHRpZiAoIWZyb21Ob2RlIHx8ICF0b05vZGUpIHJldHVybjtcblxuXHQvLyBDYWxjdWxhdGUgY29ubmVjdGlvbiBwb2ludHNcblx0Y29uc3QgZnJvbUNlbnRlclggPSBmcm9tTm9kZS54ICsgZnJvbU5vZGUud2lkdGggLyAyO1xuXHRjb25zdCBmcm9tQ2VudGVyWSA9IGZyb21Ob2RlLnkgKyBmcm9tTm9kZS5oZWlnaHQgLyAyO1xuXHRjb25zdCB0b0NlbnRlclggPSB0b05vZGUueCArIHRvTm9kZS53aWR0aCAvIDI7XG5cdGNvbnN0IHRvQ2VudGVyWSA9IHRvTm9kZS55ICsgdG9Ob2RlLmhlaWdodCAvIDI7XG5cblx0Ly8gRGV0ZXJtaW5lIHdoaWNoIHNpZGVzIHRvIGNvbm5lY3Rcblx0bGV0IGZyb21YOiBudW1iZXIsIGZyb21ZOiBudW1iZXIsIHRvWDogbnVtYmVyLCB0b1k6IG51bWJlcjtcblxuXHRjb25zdCBkeCA9IHRvQ2VudGVyWCAtIGZyb21DZW50ZXJYO1xuXHRjb25zdCBkeSA9IHRvQ2VudGVyWSAtIGZyb21DZW50ZXJZO1xuXG5cdGNvbnN0IGFycm93U2l6ZSA9IDE0O1xuXG5cdGlmIChNYXRoLmFicyhkeCkgPiBNYXRoLmFicyhkeSkpIHtcblx0XHQvLyBIb3Jpem9udGFsIGNvbm5lY3Rpb25cblx0XHRpZiAoZHggPiAwKSB7XG5cdFx0XHQvLyBUbyBpcyBvbiB0aGUgcmlnaHRcblx0XHRcdGZyb21YID0gZnJvbU5vZGUueCArIGZyb21Ob2RlLndpZHRoO1xuXHRcdFx0ZnJvbVkgPSBmcm9tQ2VudGVyWTtcblx0XHRcdHRvWCA9IHRvTm9kZS54O1xuXHRcdFx0dG9ZID0gdG9DZW50ZXJZO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBUbyBpcyBvbiB0aGUgbGVmdFxuXHRcdFx0ZnJvbVggPSBmcm9tTm9kZS54O1xuXHRcdFx0ZnJvbVkgPSBmcm9tQ2VudGVyWTtcblx0XHRcdHRvWCA9IHRvTm9kZS54ICsgdG9Ob2RlLndpZHRoO1xuXHRcdFx0dG9ZID0gdG9DZW50ZXJZO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHQvLyBWZXJ0aWNhbCBjb25uZWN0aW9uXG5cdFx0aWYgKGR5ID4gMCkge1xuXHRcdFx0Ly8gVG8gaXMgYmVsb3dcblx0XHRcdGZyb21YID0gZnJvbUNlbnRlclg7XG5cdFx0XHRmcm9tWSA9IGZyb21Ob2RlLnkgKyBmcm9tTm9kZS5oZWlnaHQ7XG5cdFx0XHR0b1ggPSB0b0NlbnRlclg7XG5cdFx0XHR0b1kgPSB0b05vZGUueTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gVG8gaXMgYWJvdmVcblx0XHRcdGZyb21YID0gZnJvbUNlbnRlclg7XG5cdFx0XHRmcm9tWSA9IGZyb21Ob2RlLnk7XG5cdFx0XHR0b1ggPSB0b0NlbnRlclg7XG5cdFx0XHR0b1kgPSB0b05vZGUueSArIHRvTm9kZS5oZWlnaHQ7XG5cdFx0fVxuXHR9XG5cblx0Ly8gQ3JlYXRlIGdyb3VwIGZvciBlZGdlXG5cdGNvbnN0IGdyb3VwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJnXCIpO1xuXHRncm91cC5zZXRBdHRyaWJ1dGUoXCJpZFwiLCBlZGdlLmlkKTtcblx0Z3JvdXAuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJyYWJiaXRtYXAtZWRnZS1ncm91cFwiKTtcblxuXHQvLyBDcmVhdGUgcGF0aCBlbGVtZW50XG5cdGNvbnN0IHBhdGggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIik7XG5cdHBhdGguc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJyYWJiaXRtYXAtZWRnZVwiKTtcblxuXHQvLyBDcmVhdGUgYSBjdXJ2ZWQgcGF0aFxuXHRjb25zdCBtaWRYID0gKGZyb21YICsgdG9YKSAvIDI7XG5cdGNvbnN0IG1pZFkgPSAoZnJvbVkgKyB0b1kpIC8gMjtcblxuXHQvLyBCZXppZXIgY3VydmUgY29udHJvbCBwb2ludHNcblx0bGV0IGN4MTogbnVtYmVyLCBjeTE6IG51bWJlciwgY3gyOiBudW1iZXIsIGN5MjogbnVtYmVyO1xuXG5cdGlmIChNYXRoLmFicyhkeCkgPiBNYXRoLmFicyhkeSkpIHtcblx0XHQvLyBIb3Jpem9udGFsOiBjdXJ2ZSBob3Jpem9udGFsbHlcblx0XHRjeDEgPSBtaWRYO1xuXHRcdGN5MSA9IGZyb21ZO1xuXHRcdGN4MiA9IG1pZFg7XG5cdFx0Y3kyID0gdG9ZO1xuXHR9IGVsc2Uge1xuXHRcdC8vIFZlcnRpY2FsOiBjdXJ2ZSB2ZXJ0aWNhbGx5XG5cdFx0Y3gxID0gZnJvbVg7XG5cdFx0Y3kxID0gbWlkWTtcblx0XHRjeDIgPSB0b1g7XG5cdFx0Y3kyID0gbWlkWTtcblx0fVxuXG5cdGNvbnN0IGQgPSBgTSAke2Zyb21YfSAke2Zyb21ZfSBDICR7Y3gxfSAke2N5MX0sICR7Y3gyfSAke2N5Mn0sICR7dG9YfSAke3RvWX1gO1xuXHRwYXRoLnNldEF0dHJpYnV0ZShcImRcIiwgZCk7XG5cblx0Ly8gSGl0IGFyZWEgKGludmlzaWJsZSwgd2lkZXIgc3Ryb2tlIGZvciBlYXNpZXIgY2xpY2tpbmcpXG5cdGNvbnN0IGhpdEFyZWEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIik7XG5cdGhpdEFyZWEuc2V0QXR0cmlidXRlKFwiZFwiLCBkKTtcblx0aGl0QXJlYS5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcInJhYmJpdG1hcC1lZGdlLWhpdGFyZWFcIik7XG5cdGhpdEFyZWEuc2V0QXR0cmlidXRlKFwiZGF0YS1lZGdlLWlkXCIsIGVkZ2UuaWQpO1xuXHRncm91cC5hcHBlbmRDaGlsZChoaXRBcmVhKTtcblx0Z3JvdXAuYXBwZW5kQ2hpbGQocGF0aCk7XG5cblx0Ly8gRWRnZSBob3ZlciBhbmQgY29udGV4dCBtZW51XG5cdGdyb3VwLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWVudGVyXCIsICgpID0+IHtcblx0XHRwYXRoLmNsYXNzTGlzdC5hZGQoXCJyYWJiaXRtYXAtZWRnZS1ob3ZlclwiKTtcblx0fSk7XG5cdGdyb3VwLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWxlYXZlXCIsICgpID0+IHtcblx0XHRwYXRoLmNsYXNzTGlzdC5yZW1vdmUoXCJyYWJiaXRtYXAtZWRnZS1ob3ZlclwiKTtcblx0fSk7XG5cdGdyb3VwLmFkZEV2ZW50TGlzdGVuZXIoXCJjb250ZXh0bWVudVwiLCAoZSkgPT4ge1xuXHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdHZpZXcuc2hvd0VkZ2VDb250ZXh0TWVudShlZGdlLmlkLCBlIGFzIE1vdXNlRXZlbnQpO1xuXHR9KTtcblxuXHQvLyBDYWxjdWxhdGUgYXJyb3cgZGlyZWN0aW9uIGZyb20gY3VydmUgZW5kIHRhbmdlbnRcblx0Ly8gVGFuZ2VudCBhdCB0PTEgZm9yIGN1YmljIGJlemllcjogMyooUDMtUDIpID0gMyoodG9YLWN4MiwgdG9ZLWN5Milcblx0Y29uc3QgdGFuZ2VudFggPSB0b1ggLSBjeDI7XG5cdGNvbnN0IHRhbmdlbnRZID0gdG9ZIC0gY3kyO1xuXHRjb25zdCBsZW4gPSBNYXRoLnNxcnQodGFuZ2VudFggKiB0YW5nZW50WCArIHRhbmdlbnRZICogdGFuZ2VudFkpO1xuXHRjb25zdCBub3JtWCA9IHRhbmdlbnRYIC8gbGVuO1xuXHRjb25zdCBub3JtWSA9IHRhbmdlbnRZIC8gbGVuO1xuXG5cdC8vIEFycm93IHBvaW50c1xuXHRjb25zdCBhcnJvd1RpcFggPSB0b1g7XG5cdGNvbnN0IGFycm93VGlwWSA9IHRvWTtcblx0Y29uc3QgYXJyb3dCYXNlWCA9IHRvWCAtIG5vcm1YICogYXJyb3dTaXplO1xuXHRjb25zdCBhcnJvd0Jhc2VZID0gdG9ZIC0gbm9ybVkgKiBhcnJvd1NpemU7XG5cblx0Ly8gUGVycGVuZGljdWxhciBmb3IgYXJyb3cgd2lkdGhcblx0Y29uc3QgcGVycFggPSAtbm9ybVkgKiAoYXJyb3dTaXplIC8gMik7XG5cdGNvbnN0IHBlcnBZID0gbm9ybVggKiAoYXJyb3dTaXplIC8gMik7XG5cblx0Y29uc3QgYXJyb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBvbHlnb25cIik7XG5cdGNvbnN0IHBvaW50cyA9IGAke2Fycm93VGlwWH0sJHthcnJvd1RpcFl9ICR7YXJyb3dCYXNlWCArIHBlcnBYfSwke2Fycm93QmFzZVkgKyBwZXJwWX0gJHthcnJvd0Jhc2VYIC0gcGVycFh9LCR7YXJyb3dCYXNlWSAtIHBlcnBZfWA7XG5cdGFycm93LnNldEF0dHJpYnV0ZShcInBvaW50c1wiLCBwb2ludHMpO1xuXHRhcnJvdy5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcInJhYmJpdG1hcC1hcnJvd1wiKTtcblx0Z3JvdXAuYXBwZW5kQ2hpbGQoYXJyb3cpO1xuXG5cdHZpZXcuZWRnZXNDb250YWluZXIuYXBwZW5kQ2hpbGQoZ3JvdXApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyTm9kZSh2aWV3OiBDYW52YXNDaGF0Vmlldywgbm9kZTogQ2FudmFzTm9kZSk6IHZvaWQge1xuXHRpZiAoIXZpZXcubm9kZXNDb250YWluZXIpIHJldHVybjtcblxuXHRjb25zdCBlbCA9IHZpZXcubm9kZXNDb250YWluZXIuY3JlYXRlRGl2KHtcblx0XHRjbHM6IGByYWJiaXRtYXAtbm9kZSByYWJiaXRtYXAtbm9kZS0ke25vZGUudHlwZX1gLFxuXHR9KTtcblx0ZWwuc2V0Q3NzU3R5bGVzKHtcblx0XHRsZWZ0OiBgJHtub2RlLnh9cHhgLFxuXHRcdHRvcDogYCR7bm9kZS55fXB4YCxcblx0XHR3aWR0aDogYCR7bm9kZS53aWR0aH1weGAsXG5cdFx0aGVpZ2h0OiBgJHtub2RlLmhlaWdodH1weGAsXG5cdH0pO1xuXG5cdC8vIEhlYWRlciBmb3IgZHJhZ2dpbmdcblx0Y29uc3QgaGVhZGVyID0gZWwuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1ub2RlLWhlYWRlclwiIH0pO1xuXG5cdGNvbnN0IHRpdGxlQ29udGFpbmVyID0gaGVhZGVyLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtbm9kZS10aXRsZS1jb250YWluZXJcIiB9KTtcblx0Y29uc3QgZGVmYXVsdFRpdGxlID0gbm9kZS50eXBlID09PSBcImNoYXRcIiA/IFwiQ2hhdFwiIDogbm9kZS50eXBlID09PSBcImxpbmtcIiA/IChub2RlLmxpbmtUaXRsZSB8fCBcIkxpbmtcIikgOiBub2RlLnR5cGUgPT09IFwibm90ZVwiID8gKG5vZGUudGl0bGUgfHwgXCJOb3RlXCIpIDogXCJDYXJkXCI7XG5cdGNvbnN0IHRpdGxlU3BhbiA9IHRpdGxlQ29udGFpbmVyLmNyZWF0ZVNwYW4oe1xuXHRcdHRleHQ6IG5vZGUudGl0bGUgfHwgZGVmYXVsdFRpdGxlLFxuXHRcdGNsczogXCJyYWJiaXRtYXAtbm9kZS10aXRsZVwiXG5cdH0pO1xuXG5cdC8vIEVkaXQgdGl0bGUgYnV0dG9uIChwZW5jaWwgaWNvbilcblx0Y29uc3QgZWRpdFRpdGxlQnRuID0gdGl0bGVDb250YWluZXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwicmFiYml0bWFwLWVkaXQtdGl0bGUtYnRuXCIgfSk7XG5cdHNldEljb24oZWRpdFRpdGxlQnRuLCBcInBlbmNpbFwiKTtcblxuXHRlZGl0VGl0bGVCdG4ub25jbGljayA9IChlKSA9PiB7XG5cdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHR2aWV3LnNob3dUaXRsZUVkaXRvcihub2RlLCB0aXRsZVNwYW4sIHRpdGxlQ29udGFpbmVyKTtcblx0fTtcblxuXHQvLyBFeHBvcnQgdG8gTUQgYnV0dG9uIChvbmx5IGZvciBjaGF0IG5vZGVzKVxuXHRpZiAobm9kZS50eXBlID09PSBcImNoYXRcIikge1xuXHRcdGNvbnN0IGV4cG9ydEJ0biA9IHRpdGxlQ29udGFpbmVyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcInJhYmJpdG1hcC1leHBvcnQtYnRuXCIgfSk7XG5cdFx0c2V0SWNvbihleHBvcnRCdG4sIFwiZG93bmxvYWRcIik7XG5cdFx0ZXhwb3J0QnRuLnRpdGxlID0gXCJTYXZlIGFzIE1hcmtkb3duXCI7XG5cblx0XHRleHBvcnRCdG4ub25jbGljayA9IChlKSA9PiB7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0dm9pZCB2aWV3LmV4cG9ydENoYXRUb01kKG5vZGUpO1xuXHRcdH07XG5cblx0XHQvLyBFeHBhbmQgY2hhdCBidXR0b25cblx0XHRjb25zdCBleHBhbmRCdG4gPSB0aXRsZUNvbnRhaW5lci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJyYWJiaXRtYXAtZXhwYW5kLWJ0blwiIH0pO1xuXHRcdHNldEljb24oZXhwYW5kQnRuLCBcIm1heGltaXplLTJcIik7XG5cdFx0ZXhwYW5kQnRuLnRpdGxlID0gXCJFeHBhbmQgY2hhdFwiO1xuXG5cdFx0ZXhwYW5kQnRuLm9uY2xpY2sgPSAoZSkgPT4ge1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdHZpZXcub3BlbkV4cGFuZGVkQ2hhdChub2RlLmlkKTtcblx0XHR9O1xuXHR9XG5cblx0Ly8gRGVsZXRlIGJ1dHRvblxuXHRjb25zdCBkZWxldGVCdG4gPSBoZWFkZXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlxcdTAwRDdcIiwgY2xzOiBcInJhYmJpdG1hcC1kZWxldGUtYnRuXCIgfSk7XG5cdGRlbGV0ZUJ0bi5vbmNsaWNrID0gKGUpID0+IHtcblx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdHZpZXcuZGVsZXRlTm9kZShub2RlLmlkKTtcblx0fTtcblxuXHQvLyBNYWtlIGhlYWRlciBkcmFnZ2FibGVcblx0aGVhZGVyLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgKGUpID0+IHtcblx0XHRpZiAoZS5idXR0b24gPT09IDAgJiYgIXZpZXcuc3BhY2VQcmVzc2VkKSB7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cdFx0XHQvLyBIYW5kbGUgc2VsZWN0aW9uXG5cdFx0XHRpZiAoZS5zaGlmdEtleSkge1xuXHRcdFx0XHQvLyBUb2dnbGUgc2VsZWN0aW9uIHdpdGggc2hpZnRcblx0XHRcdFx0aWYgKHZpZXcuc2VsZWN0ZWROb2Rlcy5oYXMobm9kZS5pZCkpIHtcblx0XHRcdFx0XHR2aWV3LmRlc2VsZWN0Tm9kZShub2RlLmlkKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR2aWV3LnNlbGVjdE5vZGUobm9kZS5pZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoIXZpZXcuc2VsZWN0ZWROb2Rlcy5oYXMobm9kZS5pZCkpIHtcblx0XHRcdFx0Ly8gQ2xpY2sgb24gdW5zZWxlY3RlZCBub2RlIC0gY2xlYXIgb3RoZXJzIGFuZCBzZWxlY3QgdGhpcyBvbmVcblx0XHRcdFx0dmlldy5jbGVhclNlbGVjdGlvbigpO1xuXHRcdFx0XHR2aWV3LnNlbGVjdE5vZGUobm9kZS5pZCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFN0YXJ0IGRyYWdcblx0XHRcdHZpZXcuZHJhZ2dlZE5vZGUgPSBub2RlLmlkO1xuXHRcdFx0Y29uc3QgcmVjdCA9IGVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0dmlldy5kcmFnT2Zmc2V0WCA9IChlLmNsaWVudFggLSByZWN0LmxlZnQpIC8gdmlldy5zY2FsZTtcblx0XHRcdHZpZXcuZHJhZ09mZnNldFkgPSAoZS5jbGllbnRZIC0gcmVjdC50b3ApIC8gdmlldy5zY2FsZTtcblxuXHRcdFx0Ly8gU3RvcmUgc3RhcnQgbW91c2UgcG9zaXRpb24gaW4gY2FudmFzIGNvb3Jkc1xuXHRcdFx0Y29uc3QgY2FudmFzUmVjdCA9IHZpZXcuY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0dmlldy5kcmFnU3RhcnRNb3VzZVggPSAoZS5jbGllbnRYIC0gY2FudmFzUmVjdC5sZWZ0IC0gdmlldy5wYW5YKSAvIHZpZXcuc2NhbGU7XG5cdFx0XHR2aWV3LmRyYWdTdGFydE1vdXNlWSA9IChlLmNsaWVudFkgLSBjYW52YXNSZWN0LnRvcCAtIHZpZXcucGFuWSkgLyB2aWV3LnNjYWxlO1xuXG5cdFx0XHQvLyBTdG9yZSBzdGFydCBwb3NpdGlvbnMgZm9yIGFsbCBzZWxlY3RlZCBub2Rlc1xuXHRcdFx0dmlldy5kcmFnU3RhcnRQb3NpdGlvbnMuY2xlYXIoKTtcblx0XHRcdGZvciAoY29uc3Qgbm9kZUlkIG9mIHZpZXcuc2VsZWN0ZWROb2Rlcykge1xuXHRcdFx0XHRjb25zdCBuID0gdmlldy5ub2Rlcy5nZXQobm9kZUlkKTtcblx0XHRcdFx0aWYgKG4pIHtcblx0XHRcdFx0XHR2aWV3LmRyYWdTdGFydFBvc2l0aW9ucy5zZXQobm9kZUlkLCB7IHg6IG4ueCwgeTogbi55IH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblxuXHQvLyBEb3VibGUtY2xpY2sgdG8gem9vbSB0byBub2RlXG5cdGhlYWRlci5hZGRFdmVudExpc3RlbmVyKFwiZGJsY2xpY2tcIiwgKGUpID0+IHtcblx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdHZpZXcuem9vbVRvTm9kZShub2RlLmlkKTtcblx0fSk7XG5cblx0Ly8gUmlnaHQtY2xpY2sgY29udGV4dCBtZW51XG5cdGVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjb250ZXh0bWVudVwiLCAoZSkgPT4ge1xuXHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cdFx0Ly8gTXVsdGktc2VsZWN0IGNvbnRleHQgbWVudSB0YWtlcyBwcmlvcml0eVxuXHRcdGlmICh2aWV3LnNlbGVjdGVkTm9kZXMuc2l6ZSA+PSAyICYmIHZpZXcuc2VsZWN0ZWROb2Rlcy5oYXMobm9kZS5pZCkpIHtcblx0XHRcdHZpZXcuc2hvd011bHRpU2VsZWN0Q29udGV4dE1lbnUoZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKG5vZGUudHlwZSA9PT0gXCJjaGF0XCIpIHtcblx0XHRcdHZpZXcuc2hvd0NoYXRDb250ZXh0TWVudShub2RlLmlkLCBlKTtcblx0XHR9IGVsc2UgaWYgKG5vZGUudHlwZSA9PT0gXCJsaW5rXCIpIHtcblx0XHRcdHZpZXcuc2hvd0xpbmtDb250ZXh0TWVudShub2RlLmlkLCBlKTtcblx0XHR9IGVsc2UgaWYgKG5vZGUudHlwZSA9PT0gXCJub3RlXCIpIHtcblx0XHRcdHZpZXcuc2hvd05vdGVDb250ZXh0TWVudShub2RlLmlkLCBlKTtcblx0XHR9XG5cdH0pO1xuXG5cdC8vIENvbnRlbnQgYXJlYVxuXHRjb25zdCBjb250ZW50ID0gZWwuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1ub2RlLWNvbnRlbnRcIiB9KTtcblxuXHRpZiAobm9kZS50eXBlID09PSBcImNoYXRcIikge1xuXHRcdHJlbmRlckNoYXRDb250ZW50KHZpZXcsIG5vZGUuaWQsIGNvbnRlbnQpO1xuXHR9IGVsc2UgaWYgKG5vZGUudHlwZSA9PT0gXCJsaW5rXCIpIHtcblx0XHRyZW5kZXJMaW5rQ29udGVudCh2aWV3LCBub2RlLCBjb250ZW50KTtcblx0fSBlbHNlIGlmIChub2RlLnR5cGUgPT09IFwibm90ZVwiKSB7XG5cdFx0cmVuZGVyTm90ZUNvbnRlbnQodmlldywgbm9kZSwgY29udGVudCk7XG5cdH0gZWxzZSB7XG5cdFx0cmVuZGVyQ2FyZENvbnRlbnQodmlldywgbm9kZSwgY29udGVudCk7XG5cdH1cblxuXHQvLyBDb25uZWN0aW9uIGhhbmRsZXNcblx0Y29uc3Qgc2lkZXM6IEFycmF5PFwidG9wXCIgfCBcInJpZ2h0XCIgfCBcImJvdHRvbVwiIHwgXCJsZWZ0XCI+ID0gW1widG9wXCIsIFwicmlnaHRcIiwgXCJib3R0b21cIiwgXCJsZWZ0XCJdO1xuXHRmb3IgKGNvbnN0IHNpZGUgb2Ygc2lkZXMpIHtcblx0XHRjb25zdCBoYW5kbGUgPSBlbC5jcmVhdGVEaXYoeyBjbHM6IGByYWJiaXRtYXAtY29ubmVjdGlvbi1oYW5kbGUgcmFiYml0bWFwLWhhbmRsZS0ke3NpZGV9YCB9KTtcblx0XHRoYW5kbGUuc2V0QXR0cmlidXRlKFwiZGF0YS1ub2RlLWlkXCIsIG5vZGUuaWQpO1xuXHRcdGhhbmRsZS5zZXRBdHRyaWJ1dGUoXCJkYXRhLXNpZGVcIiwgc2lkZSk7XG5cdFx0aGFuZGxlLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgKGUpID0+IHtcblx0XHRcdGlmIChlLmJ1dHRvbiAhPT0gMCkgcmV0dXJuO1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHZpZXcuc3RhcnRFZGdlRHJhd2luZyhub2RlLmlkLCBzaWRlLCBlKTtcblx0XHR9KTtcblx0fVxuXG5cdC8vIFJlc2l6ZSBoYW5kbGVcblx0Y29uc3QgcmVzaXplSGFuZGxlID0gZWwuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1yZXNpemUtaGFuZGxlXCIgfSk7XG5cdHJlc2l6ZUhhbmRsZS5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIChlKSA9PiB7XG5cdFx0aWYgKGUuYnV0dG9uID09PSAwKSB7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dmlldy5yZXNpemluZ05vZGUgPSBub2RlLmlkO1xuXHRcdFx0dmlldy5yZXNpemVTdGFydFdpZHRoID0gbm9kZS53aWR0aDtcblx0XHRcdHZpZXcucmVzaXplU3RhcnRIZWlnaHQgPSBub2RlLmhlaWdodDtcblx0XHRcdHZpZXcucmVzaXplU3RhcnRYID0gZS5jbGllbnRYO1xuXHRcdFx0dmlldy5yZXNpemVTdGFydFkgPSBlLmNsaWVudFk7XG5cdFx0fVxuXHR9KTtcblxuXHR2aWV3Lm5vZGVFbGVtZW50cy5zZXQobm9kZS5pZCwgZWwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyTGlua0NvbnRlbnQodmlldzogQ2FudmFzQ2hhdFZpZXcsIG5vZGU6IENhbnZhc05vZGUsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0Y29udGFpbmVyLmFkZENsYXNzKFwicmFiYml0bWFwLWxpbmstY29udGVudFwiKTtcblxuXHQvLyBUaHVtYm5haWwgLyBpbWFnZVxuXHRpZiAobm9kZS5saW5rSW1hZ2UpIHtcblx0XHRjb25zdCBpbWdXcmFwID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtbGluay10aHVtYm5haWxcIiB9KTtcblx0XHRjb25zdCBpbWcgPSBpbWdXcmFwLmNyZWF0ZUVsKFwiaW1nXCIsIHsgYXR0cjogeyBzcmM6IG5vZGUubGlua0ltYWdlLCBhbHQ6IG5vZGUubGlua1RpdGxlIHx8IFwiXCIgfSB9KTtcblx0XHRpbWcuYWRkRXZlbnRMaXN0ZW5lcihcImVycm9yXCIsICgpID0+IHtcblx0XHRcdGltZ1dyYXAucmVtb3ZlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRjb25zdCBpbmZvID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtbGluay1pbmZvXCIgfSk7XG5cblx0Ly8gVGl0bGVcblx0aW5mby5jcmVhdGVEaXYoe1xuXHRcdGNsczogXCJyYWJiaXRtYXAtbGluay10aXRsZVwiLFxuXHRcdHRleHQ6IG5vZGUubGlua1RpdGxlIHx8IFwiTG9hZGluZy4uLlwiLFxuXHR9KTtcblxuXHQvLyBVUkxcblx0aWYgKG5vZGUudXJsKSB7XG5cdFx0bGV0IGRpc3BsYXlVcmwgPSBub2RlLnVybDtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcGFyc2VkID0gbmV3IFVSTChub2RlLnVybCk7XG5cdFx0XHRkaXNwbGF5VXJsID0gcGFyc2VkLmhvc3RuYW1lICsgKHBhcnNlZC5wYXRobmFtZSAhPT0gXCIvXCIgPyBwYXJzZWQucGF0aG5hbWUgOiBcIlwiKTtcblx0XHR9IGNhdGNoIHsgLyogbm9vcCAqLyB9XG5cdFx0aW5mby5jcmVhdGVEaXYoe1xuXHRcdFx0Y2xzOiBcInJhYmJpdG1hcC1saW5rLXVybFwiLFxuXHRcdFx0dGV4dDogZGlzcGxheVVybCxcblx0XHR9KTtcblx0fVxuXG5cdC8vIERlc2NyaXB0aW9uXG5cdGlmIChub2RlLmxpbmtEZXNjcmlwdGlvbikge1xuXHRcdGluZm8uY3JlYXRlRGl2KHtcblx0XHRcdGNsczogXCJyYWJiaXRtYXAtbGluay1kZXNjcmlwdGlvblwiLFxuXHRcdFx0dGV4dDogbm9kZS5saW5rRGVzY3JpcHRpb24sXG5cdFx0fSk7XG5cdH1cblxuXHQvLyBMb2FkaW5nIHN0YXRlXG5cdGlmIChub2RlLmxpbmtUaXRsZSA9PT0gXCJMb2FkaW5nLi4uXCIpIHtcblx0XHRjb25zdCBzcGlubmVyID0gaW5mby5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLWxpbmstbG9hZGluZ1wiIH0pO1xuXHRcdHNwaW5uZXIuY3JlYXRlU3Bhbih7IHRleHQ6IFwiRmV0Y2hpbmcgY29udGVudC4uLlwiIH0pO1xuXHR9XG5cblx0Ly8gT3BlbiBidXR0b25cblx0Y29uc3Qgb3BlbkJ0biA9IGNvbnRhaW5lci5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0Y2xzOiBcInJhYmJpdG1hcC1saW5rLW9wZW4tYnRuXCIsXG5cdFx0dGV4dDogXCJPcGVuIGxpbmtcIixcblx0fSk7XG5cdG9wZW5CdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG5cdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRpZiAobm9kZS51cmwpIHtcblx0XHRcdHdpbmRvdy5vcGVuKG5vZGUudXJsLCBcIl9ibGFua1wiKTtcblx0XHR9XG5cdH0pO1xuXG5cdC8vIFByZXZlbnQgd2hlZWwgZXZlbnRzIGZyb20gYnViYmxpbmdcblx0Y29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoXCJ3aGVlbFwiLCAoZSkgPT4ge1xuXHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQ2FyZENvbnRlbnQodmlldzogQ2FudmFzQ2hhdFZpZXcsIG5vZGU6IENhbnZhc05vZGUsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0Y29uc3QgdGV4dGFyZWEgPSBjb250YWluZXIuY3JlYXRlRWwoXCJ0ZXh0YXJlYVwiLCB7XG5cdFx0Y2xzOiBcInJhYmJpdG1hcC1jYXJkLXRleHRhcmVhXCIsXG5cdFx0YXR0cjogeyBwbGFjZWhvbGRlcjogXCJXcml0ZSBzb21ldGhpbmcuLi5cIiB9LFxuXHR9KTtcblx0dGV4dGFyZWEudmFsdWUgPSBub2RlLmNvbnRlbnQ7XG5cdHRleHRhcmVhLmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCAoKSA9PiB7XG5cdFx0bm9kZS5jb250ZW50ID0gdGV4dGFyZWEudmFsdWU7XG5cdFx0dmlldy50cmlnZ2VyU2F2ZSgpO1xuXHR9KTtcblx0Ly8gUHJldmVudCB3aGVlbCBldmVudHMgZnJvbSBidWJibGluZyB0byBjYW52YXNcblx0dGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcihcIndoZWVsXCIsIChlKSA9PiB7XG5cdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0fSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJOb3RlQ29udGVudCh2aWV3OiBDYW52YXNDaGF0Vmlldywgbm9kZTogQ2FudmFzTm9kZSwgY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRjb250YWluZXIuYWRkQ2xhc3MoXCJyYWJiaXRtYXAtbm90ZS1jb250ZW50XCIpO1xuXG5cdC8vIFJlbmRlcmVkIG1hcmtkb3duIGFyZWFcblx0Y29uc3QgbWFya2Rvd25Db250YWluZXIgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1ub3RlLW1hcmtkb3duXCIgfSk7XG5cdHZvaWQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIoXG5cdFx0dmlldy5hcHAsXG5cdFx0bm9kZS5jb250ZW50LFxuXHRcdG1hcmtkb3duQ29udGFpbmVyLFxuXHRcdG5vZGUuZmlsZVBhdGggfHwgXCJcIixcblx0XHR2aWV3XG5cdCk7XG5cblx0Ly8gT3BlbiBpbiBPYnNpZGlhbiBidXR0b25cblx0aWYgKG5vZGUuZmlsZVBhdGgpIHtcblx0XHRjb25zdCBvcGVuQnRuID0gY29udGFpbmVyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdGNsczogXCJyYWJiaXRtYXAtbm90ZS1vcGVuLWJ0blwiLFxuXHRcdFx0dGV4dDogXCJPcGVuIGluIE9ic2lkaWFuXCIsXG5cdFx0fSk7XG5cdFx0b3BlbkJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHR2b2lkIHZpZXcuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQobm9kZS5maWxlUGF0aCEsIFwiXCIsIGZhbHNlKTtcblx0XHR9KTtcblx0fVxuXG5cdC8vIFByZXZlbnQgd2hlZWwgZXZlbnRzIGZyb20gYnViYmxpbmcgdG8gY2FudmFzXG5cdGNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKFwid2hlZWxcIiwgKGUpID0+IHtcblx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHR9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckNoYXRDb250ZW50KHZpZXc6IENhbnZhc0NoYXRWaWV3LCBub2RlSWQ6IHN0cmluZywgY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHQvLyBIZWFkZXIgYmFyXG5cdGNvbnN0IGhlYWRlckJhciA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLWNoYXQtaGVhZGVyXCIgfSk7XG5cdGNvbnN0IGhlYWRlckljb24gPSBoZWFkZXJCYXIuY3JlYXRlU3Bhbih7IGNsczogXCJyYWJiaXRtYXAtY2hhdC1oZWFkZXItaWNvblwiIH0pO1xuXHRzZXRJY29uKGhlYWRlckljb24sIFwibWVzc2FnZS1zcXVhcmVcIik7XG5cdGhlYWRlckJhci5jcmVhdGVTcGFuKHsgdGV4dDogXCJDYW52YXMgQ2hhdFwiLCBjbHM6IFwicmFiYml0bWFwLWNoYXQtaGVhZGVyLXRpdGxlXCIgfSk7XG5cblx0Ly8gQ2xpY2sgb24gaGVhZGVyIHNlbGVjdHMgdGhlIG5vZGVcblx0aGVhZGVyQmFyLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgKGUpID0+IHtcblx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdGlmICghdmlldy5zZWxlY3RlZE5vZGVzLmhhcyhub2RlSWQpKSB7XG5cdFx0XHR2aWV3LmNsZWFyU2VsZWN0aW9uKCk7XG5cdFx0XHR2aWV3LnNlbGVjdE5vZGUobm9kZUlkKTtcblx0XHR9XG5cdH0pO1xuXG5cdC8vIEdldCBjdXJyZW50IHN0YXRlIG9yIHVzZSBkZWZhdWx0c1xuXHRsZXQgc3RhdGUgPSB2aWV3LmNoYXRTdGF0ZXMuZ2V0KG5vZGVJZCk7XG5cdGlmICghc3RhdGUpIHtcblx0XHRjb25zdCBkZWZhdWx0UHJvdmlkZXIgPSB2aWV3LnBsdWdpbi5zZXR0aW5ncy5wcm92aWRlcnNbMF07XG5cdFx0c3RhdGUgPSB7XG5cdFx0XHRwcm92aWRlcjogZGVmYXVsdFByb3ZpZGVyLm5hbWUsXG5cdFx0XHRtb2RlbDogZGVmYXVsdFByb3ZpZGVyLm1vZGVsc1swXSxcblx0XHRcdGNvbnRleHRGaWxlczogW10sXG5cdFx0XHRjb250ZXh0Tm9kZXM6IFtdLFxuXHRcdFx0c3lzdGVtUHJvbXB0OiBERUZBVUxUX1NZU1RFTV9QUk9NUFQsXG5cdFx0XHRjb250ZXh0VGVtcGxhdGU6IERFRkFVTFRfQ09OVEVYVF9URU1QTEFURVxuXHRcdH07XG5cdFx0dmlldy5jaGF0U3RhdGVzLnNldChub2RlSWQsIHN0YXRlKTtcblx0fVxuXHQvLyBFbnN1cmUgZmllbGRzIGV4aXN0IGZvciBvbGQgZGF0YVxuXHRpZiAoIXN0YXRlLmNvbnRleHRGaWxlcykge1xuXHRcdHN0YXRlLmNvbnRleHRGaWxlcyA9IFtdO1xuXHR9XG5cdGlmICghc3RhdGUuc3lzdGVtUHJvbXB0KSB7XG5cdFx0c3RhdGUuc3lzdGVtUHJvbXB0ID0gREVGQVVMVF9TWVNURU1fUFJPTVBUO1xuXHR9XG5cdGlmICghc3RhdGUuY29udGV4dFRlbXBsYXRlKSB7XG5cdFx0c3RhdGUuY29udGV4dFRlbXBsYXRlID0gREVGQVVMVF9DT05URVhUX1RFTVBMQVRFO1xuXHR9XG5cblx0Ly8gLS0tIFByb3ZpZGVyICYgbW9kZWwgc2VsZWN0cyAoY3JlYXRlZCBkZXRhY2hlZCwgcGxhY2VkIGluIHRvb2xiYXIgbGF0ZXIpIC0tLVxuXHRjb25zdCBwcm92aWRlclNlbGVjdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzZWxlY3RcIik7XG5cdHByb3ZpZGVyU2VsZWN0LmNsYXNzTmFtZSA9IFwicmFiYml0bWFwLXNlbGVjdFwiO1xuXHRmb3IgKGNvbnN0IHByb3ZpZGVyIG9mIHZpZXcucGx1Z2luLnNldHRpbmdzLnByb3ZpZGVycykge1xuXHRcdGNvbnN0IG9wdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJvcHRpb25cIik7XG5cdFx0b3B0aW9uLnRleHQgPSBwcm92aWRlci5uYW1lO1xuXHRcdG9wdGlvbi52YWx1ZSA9IHByb3ZpZGVyLm5hbWU7XG5cdFx0aWYgKHByb3ZpZGVyLm5hbWUgPT09IHN0YXRlLnByb3ZpZGVyKSB7XG5cdFx0XHRvcHRpb24uc2VsZWN0ZWQgPSB0cnVlO1xuXHRcdH1cblx0XHRwcm92aWRlclNlbGVjdC5hcHBlbmRDaGlsZChvcHRpb24pO1xuXHR9XG5cblx0Y29uc3QgbW9kZWxTZWxlY3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2VsZWN0XCIpO1xuXHRtb2RlbFNlbGVjdC5jbGFzc05hbWUgPSBcInJhYmJpdG1hcC1zZWxlY3QgcmFiYml0bWFwLW1vZGVsLXNlbGVjdFwiO1xuXG5cdGNvbnN0IGZvcm1hdE1vZGVsTmFtZSA9IChtb2RlbDogc3RyaW5nKTogc3RyaW5nID0+IHtcblx0XHRpZiAobW9kZWwubGVuZ3RoIDw9IDIwKSByZXR1cm4gbW9kZWw7XG5cdFx0Y29uc3QgcGFydHMgPSBtb2RlbC5zcGxpdCgvWy0vXS8pO1xuXHRcdHJldHVybiBwYXJ0cy5zbGljZSgtMikuam9pbihcIi1cIikuc3Vic3RyaW5nKDAsIDIwKTtcblx0fTtcblxuXHQvLyBXaWxsIGJlIHNldCBhZnRlciB0b29sYmFyIGlzIGNyZWF0ZWRcblx0bGV0IG1vZGVsTGFiZWw6IEhUTUxTcGFuRWxlbWVudDtcblxuXHRjb25zdCB1cGRhdGVNb2RlbE9wdGlvbnMgPSAoKSA9PiB7XG5cdFx0Y29uc3QgY3VycmVudFN0YXRlID0gdmlldy5jaGF0U3RhdGVzLmdldChub2RlSWQpITtcblx0XHRjb25zdCBwcm92aWRlciA9IHZpZXcucGx1Z2luLnNldHRpbmdzLnByb3ZpZGVycy5maW5kKHAgPT4gcC5uYW1lID09PSBjdXJyZW50U3RhdGUucHJvdmlkZXIpO1xuXHRcdGlmICghcHJvdmlkZXIpIHJldHVybjtcblxuXHRcdGxldCBtb2RlbHMgPSBwcm92aWRlci5tb2RlbHM7XG5cdFx0aWYgKHByb3ZpZGVyLm5hbWUgPT09IFwiT3BlblJvdXRlclwiICYmIHZpZXcucGx1Z2luLnNldHRpbmdzLmN1c3RvbU9wZW5Sb3V0ZXJNb2RlbHMudHJpbSgpKSB7XG5cdFx0XHRtb2RlbHMgPSB2aWV3LnBsdWdpbi5zZXR0aW5ncy5jdXN0b21PcGVuUm91dGVyTW9kZWxzXG5cdFx0XHRcdC5zcGxpdChcIlxcblwiKVxuXHRcdFx0XHQubWFwKG0gPT4gbS50cmltKCkpXG5cdFx0XHRcdC5maWx0ZXIobSA9PiBtLmxlbmd0aCA+IDApO1xuXHRcdH1cblxuXHRcdHdoaWxlIChtb2RlbFNlbGVjdC5maXJzdENoaWxkKSBtb2RlbFNlbGVjdC5maXJzdENoaWxkLnJlbW92ZSgpO1xuXHRcdGZvciAoY29uc3QgbW9kZWwgb2YgbW9kZWxzKSB7XG5cdFx0XHRjb25zdCBvcHRpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwib3B0aW9uXCIpO1xuXHRcdFx0b3B0aW9uLnRleHQgPSBtb2RlbDtcblx0XHRcdG9wdGlvbi52YWx1ZSA9IG1vZGVsO1xuXHRcdFx0aWYgKG1vZGVsID09PSBjdXJyZW50U3RhdGUubW9kZWwpIHtcblx0XHRcdFx0b3B0aW9uLnNlbGVjdGVkID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdG1vZGVsU2VsZWN0LmFwcGVuZENoaWxkKG9wdGlvbik7XG5cdFx0fVxuXHRcdGlmIChtb2RlbExhYmVsKSB7XG5cdFx0XHRtb2RlbExhYmVsLnRleHRDb250ZW50ID0gZm9ybWF0TW9kZWxOYW1lKGN1cnJlbnRTdGF0ZS5tb2RlbCkgKyBcIiBcXHUyNUJFXCI7XG5cdFx0fVxuXHR9O1xuXG5cdHVwZGF0ZU1vZGVsT3B0aW9ucygpO1xuXG5cdHByb3ZpZGVyU2VsZWN0Lm9uY2hhbmdlID0gKCkgPT4ge1xuXHRcdGNvbnN0IG5ld1Byb3ZpZGVyID0gcHJvdmlkZXJTZWxlY3QudmFsdWU7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB2aWV3LnBsdWdpbi5zZXR0aW5ncy5wcm92aWRlcnMuZmluZChwID0+IHAubmFtZSA9PT0gbmV3UHJvdmlkZXIpO1xuXHRcdGlmIChwcm92aWRlcikge1xuXHRcdFx0bGV0IG1vZGVscyA9IHByb3ZpZGVyLm1vZGVscztcblx0XHRcdGlmIChwcm92aWRlci5uYW1lID09PSBcIk9wZW5Sb3V0ZXJcIiAmJiB2aWV3LnBsdWdpbi5zZXR0aW5ncy5jdXN0b21PcGVuUm91dGVyTW9kZWxzLnRyaW0oKSkge1xuXHRcdFx0XHRtb2RlbHMgPSB2aWV3LnBsdWdpbi5zZXR0aW5ncy5jdXN0b21PcGVuUm91dGVyTW9kZWxzXG5cdFx0XHRcdFx0LnNwbGl0KFwiXFxuXCIpXG5cdFx0XHRcdFx0Lm1hcChtID0+IG0udHJpbSgpKVxuXHRcdFx0XHRcdC5maWx0ZXIobSA9PiBtLmxlbmd0aCA+IDApO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjdXJyZW50U3RhdGUgPSB2aWV3LmNoYXRTdGF0ZXMuZ2V0KG5vZGVJZCk7XG5cdFx0XHRjb25zdCBuZXdTdGF0ZTogQ2hhdE5vZGVTdGF0ZSA9IHtcblx0XHRcdFx0cHJvdmlkZXI6IG5ld1Byb3ZpZGVyLFxuXHRcdFx0XHRtb2RlbDogbW9kZWxzWzBdLFxuXHRcdFx0XHRjb250ZXh0RmlsZXM6IGN1cnJlbnRTdGF0ZT8uY29udGV4dEZpbGVzIHx8IFtdLFxuXHRcdFx0XHRjb250ZXh0Tm9kZXM6IGN1cnJlbnRTdGF0ZT8uY29udGV4dE5vZGVzIHx8IFtdLFxuXHRcdFx0XHRzeXN0ZW1Qcm9tcHQ6IGN1cnJlbnRTdGF0ZT8uc3lzdGVtUHJvbXB0IHx8IERFRkFVTFRfU1lTVEVNX1BST01QVCxcblx0XHRcdFx0Y29udGV4dFRlbXBsYXRlOiBjdXJyZW50U3RhdGU/LmNvbnRleHRUZW1wbGF0ZSB8fCBERUZBVUxUX0NPTlRFWFRfVEVNUExBVEVcblx0XHRcdH07XG5cdFx0XHR2aWV3LmNoYXRTdGF0ZXMuc2V0KG5vZGVJZCwgbmV3U3RhdGUpO1xuXHRcdFx0dXBkYXRlTW9kZWxPcHRpb25zKCk7XG5cdFx0XHR2aWV3LnRyaWdnZXJTYXZlKCk7XG5cdFx0fVxuXHR9O1xuXG5cdG1vZGVsU2VsZWN0Lm9uY2hhbmdlID0gKCkgPT4ge1xuXHRcdGNvbnN0IGN1cnJlbnRTdGF0ZSA9IHZpZXcuY2hhdFN0YXRlcy5nZXQobm9kZUlkKSE7XG5cdFx0Y3VycmVudFN0YXRlLm1vZGVsID0gbW9kZWxTZWxlY3QudmFsdWU7XG5cdFx0dmlldy5jaGF0U3RhdGVzLnNldChub2RlSWQsIGN1cnJlbnRTdGF0ZSk7XG5cdFx0dmlldy50cmlnZ2VyU2F2ZSgpO1xuXHRcdGlmIChtb2RlbExhYmVsKSB7XG5cdFx0XHRtb2RlbExhYmVsLnRleHRDb250ZW50ID0gZm9ybWF0TW9kZWxOYW1lKGN1cnJlbnRTdGF0ZS5tb2RlbCkgKyBcIiBcXHUyNUJFXCI7XG5cdFx0fVxuXHR9O1xuXG5cdC8vIC0tLSBNZXNzYWdlcyBjb250YWluZXIgLS0tXG5cdGNvbnN0IG1lc3NhZ2VzQ29udGFpbmVyID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtY2hhdC1tZXNzYWdlc1wiIH0pO1xuXG5cdG1lc3NhZ2VzQ29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoXCJ3aGVlbFwiLCAoZTogV2hlZWxFdmVudCkgPT4ge1xuXHRcdGlmICh2aWV3LnNlbGVjdGVkTm9kZXMuaGFzKG5vZGVJZCkpIHtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0fVxuXHR9KTtcblxuXHRtZXNzYWdlc0NvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIChlOiBNb3VzZUV2ZW50KSA9PiB7XG5cdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRpZiAoIXZpZXcuc2VsZWN0ZWROb2Rlcy5oYXMobm9kZUlkKSkge1xuXHRcdFx0dmlldy5jbGVhclNlbGVjdGlvbigpO1xuXHRcdFx0dmlldy5zZWxlY3ROb2RlKG5vZGVJZCk7XG5cdFx0fVxuXHR9KTtcblxuXHRjb25zdCBtZXNzYWdlcyA9IHZpZXcuY2hhdE1lc3NhZ2VzLmdldChub2RlSWQpIHx8IFtdO1xuXHRtZXNzYWdlcy5mb3JFYWNoKChtc2csIGluZGV4KSA9PiB7XG5cdFx0cmVuZGVyQ2hhdE1lc3NhZ2UodmlldywgbWVzc2FnZXNDb250YWluZXIsIG1zZywgbm9kZUlkLCBpbmRleCk7XG5cdH0pO1xuXG5cdC8vIC0tLSBCb3R0b20gY29tcG9zaXRlIHNlY3Rpb24gLS0tXG5cdGNvbnN0IGJvdHRvbVNlY3Rpb24gPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1jaGF0LWJvdHRvbVwiIH0pO1xuXG5cdC8vIENvbnRleHQgY2hpcHNcblx0Y29uc3QgY29udGV4dENoaXBzID0gYm90dG9tU2VjdGlvbi5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLWNoYXQtY2hpcHNcIiB9KTtcblxuXHRjb25zdCByZW5kZXJDb250ZXh0RmlsZXMgPSAoKSA9PiB7XG5cdFx0Ly8gUmVtb3ZlIG9ubHkgZmlsZSBjaGlwcyAobm90IG5vZGUgY2hpcHMpXG5cdFx0Y29udGV4dENoaXBzLnF1ZXJ5U2VsZWN0b3JBbGwoXCIucmFiYml0bWFwLWNoYXQtY2hpcDpub3QoLnJhYmJpdG1hcC1jaGF0LWNoaXAtbm9kZSlcIikuZm9yRWFjaChlbCA9PiBlbC5yZW1vdmUoKSk7XG5cdFx0Y29uc3QgY3VycmVudFN0YXRlID0gdmlldy5jaGF0U3RhdGVzLmdldChub2RlSWQpO1xuXHRcdGlmICghY3VycmVudFN0YXRlIHx8IGN1cnJlbnRTdGF0ZS5jb250ZXh0RmlsZXMubGVuZ3RoID09PSAwKSByZXR1cm47XG5cblx0XHRmb3IgKGNvbnN0IGZpbGVQYXRoIG9mIGN1cnJlbnRTdGF0ZS5jb250ZXh0RmlsZXMpIHtcblx0XHRcdGNvbnN0IGNoaXAgPSBjb250ZXh0Q2hpcHMuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1jaGF0LWNoaXBcIiB9KTtcblx0XHRcdGNvbnN0IGNoaXBJY29uID0gY2hpcC5jcmVhdGVTcGFuKHsgY2xzOiBcInJhYmJpdG1hcC1jaGF0LWNoaXAtaWNvblwiIH0pO1xuXHRcdFx0c2V0SWNvbihjaGlwSWNvbiwgXCJmaWxlLXRleHRcIik7XG5cdFx0XHRjb25zdCBmaWxlTmFtZSA9IGZpbGVQYXRoLnNwbGl0KFwiL1wiKS5wb3AoKSB8fCBmaWxlUGF0aDtcblx0XHRcdGNoaXAuY3JlYXRlU3Bhbih7IHRleHQ6IGZpbGVOYW1lLCBjbHM6IFwicmFiYml0bWFwLWNoYXQtY2hpcC1uYW1lXCIgfSk7XG5cblx0XHRcdGNvbnN0IHJlbW92ZUJ0biA9IGNoaXAuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlxcdTAwRDdcIiwgY2xzOiBcInJhYmJpdG1hcC1jaGF0LWNoaXAtcmVtb3ZlXCIgfSk7XG5cdFx0XHRyZW1vdmVCdG4ub25jbGljayA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG5cdFx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdGNvbnN0IHMgPSB2aWV3LmNoYXRTdGF0ZXMuZ2V0KG5vZGVJZCk7XG5cdFx0XHRcdGlmIChzKSB7XG5cdFx0XHRcdFx0cy5jb250ZXh0RmlsZXMgPSBzLmNvbnRleHRGaWxlcy5maWx0ZXIoZiA9PiBmICE9PSBmaWxlUGF0aCk7XG5cdFx0XHRcdFx0dmlldy5jaGF0U3RhdGVzLnNldChub2RlSWQsIHMpO1xuXHRcdFx0XHRcdHJlbmRlckNvbnRleHRGaWxlcygpO1xuXHRcdFx0XHRcdHZpZXcudHJpZ2dlclNhdmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cdH07XG5cblx0cmVuZGVyQ29udGV4dEZpbGVzKCk7XG5cblx0Y29uc3QgcmVuZGVyQ29udGV4dE5vZGVzID0gKCkgPT4ge1xuXHRcdGNvbnRleHRDaGlwcy5xdWVyeVNlbGVjdG9yQWxsKFwiLnJhYmJpdG1hcC1jaGF0LWNoaXAtbm9kZVwiKS5mb3JFYWNoKGVsID0+IGVsLnJlbW92ZSgpKTtcblx0XHRjb25zdCBjdXJyZW50U3RhdGUgPSB2aWV3LmNoYXRTdGF0ZXMuZ2V0KG5vZGVJZCk7XG5cdFx0aWYgKCFjdXJyZW50U3RhdGUgfHwgIWN1cnJlbnRTdGF0ZS5jb250ZXh0Tm9kZXMgfHwgY3VycmVudFN0YXRlLmNvbnRleHROb2Rlcy5sZW5ndGggPT09IDApIHJldHVybjtcblxuXHRcdGZvciAoY29uc3QgY29ubmVjdGVkSWQgb2YgY3VycmVudFN0YXRlLmNvbnRleHROb2Rlcykge1xuXHRcdFx0Y29uc3QgY29ubmVjdGVkTm9kZSA9IHZpZXcubm9kZXMuZ2V0KGNvbm5lY3RlZElkKTtcblx0XHRcdGlmICghY29ubmVjdGVkTm9kZSkgY29udGludWU7XG5cblx0XHRcdGNvbnN0IGNoaXAgPSBjb250ZXh0Q2hpcHMuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1jaGF0LWNoaXAgcmFiYml0bWFwLWNoYXQtY2hpcC1ub2RlXCIgfSk7XG5cdFx0XHRjb25zdCBjaGlwSWNvbiA9IGNoaXAuY3JlYXRlU3Bhbih7IGNsczogXCJyYWJiaXRtYXAtY2hhdC1jaGlwLWljb25cIiB9KTtcblx0XHRcdHNldEljb24oY2hpcEljb24sIFwic2hhcmUtMlwiKTtcblx0XHRcdGNvbnN0IGxhYmVsID0gY29ubmVjdGVkTm9kZS50aXRsZSB8fCBjb25uZWN0ZWROb2RlLmxpbmtUaXRsZSB8fCBjb25uZWN0ZWROb2RlLnVybCB8fCBjb25uZWN0ZWROb2RlLnR5cGU7XG5cdFx0XHRjaGlwLmNyZWF0ZVNwYW4oeyB0ZXh0OiBgJHtsYWJlbH1gLCBjbHM6IFwicmFiYml0bWFwLWNoYXQtY2hpcC1uYW1lXCIgfSk7XG5cblx0XHRcdGNvbnN0IHJlbW92ZUJ0biA9IGNoaXAuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlxcdTAwRDdcIiwgY2xzOiBcInJhYmJpdG1hcC1jaGF0LWNoaXAtcmVtb3ZlXCIgfSk7XG5cdFx0XHRyZW1vdmVCdG4ub25jbGljayA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG5cdFx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdGNvbnN0IHMgPSB2aWV3LmNoYXRTdGF0ZXMuZ2V0KG5vZGVJZCk7XG5cdFx0XHRcdGlmIChzKSB7XG5cdFx0XHRcdFx0cy5jb250ZXh0Tm9kZXMgPSBzLmNvbnRleHROb2Rlcy5maWx0ZXIoaWQgPT4gaWQgIT09IGNvbm5lY3RlZElkKTtcblx0XHRcdFx0XHR2aWV3LmNoYXRTdGF0ZXMuc2V0KG5vZGVJZCwgcyk7XG5cdFx0XHRcdFx0cmVuZGVyQ29udGV4dE5vZGVzKCk7XG5cdFx0XHRcdFx0dmlldy50cmlnZ2VyU2F2ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH1cblx0fTtcblxuXHRyZW5kZXJDb250ZXh0Tm9kZXMoKTtcblxuXHQvLyBJbnB1dCB3cmFwcGVyXG5cdGNvbnN0IGlucHV0V3JhcHBlciA9IGJvdHRvbVNlY3Rpb24uY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1jaGF0LWlucHV0LXdyYXBwZXJcIiB9KTtcblx0Y29uc3QgaW5wdXQgPSBpbnB1dFdyYXBwZXIuY3JlYXRlRWwoXCJ0ZXh0YXJlYVwiLCB7XG5cdFx0Y2xzOiBcInJhYmJpdG1hcC1jaGF0LWlucHV0XCIsXG5cdFx0YXR0cjogeyBwbGFjZWhvbGRlcjogXCJQbGFuLCBAIGZvciBjb250ZXh0LCAvIGZvciBjb21tYW5kc1wiIH0sXG5cdH0pO1xuXG5cdGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJmb2N1c1wiLCAoKSA9PiB7XG5cdFx0aWYgKCF2aWV3LnNlbGVjdGVkTm9kZXMuaGFzKG5vZGVJZCkpIHtcblx0XHRcdHZpZXcuY2xlYXJTZWxlY3Rpb24oKTtcblx0XHRcdHZpZXcuc2VsZWN0Tm9kZShub2RlSWQpO1xuXHRcdH1cblx0fSk7XG5cblx0Ly8gVG9vbGJhclxuXHRjb25zdCB0b29sYmFyID0gYm90dG9tU2VjdGlvbi5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLWNoYXQtdG9vbGJhclwiIH0pO1xuXHRjb25zdCB0b29sYmFyTGVmdCA9IHRvb2xiYXIuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1jaGF0LXRvb2xiYXItbGVmdFwiIH0pO1xuXHRjb25zdCB0b29sYmFyUmlnaHQgPSB0b29sYmFyLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtY2hhdC10b29sYmFyLXJpZ2h0XCIgfSk7XG5cblx0Ly8gQXR0YWNoIGJ1dHRvbiAocGFwZXJjbGlwKVxuXHRjb25zdCBhdHRhY2hCdG4gPSB0b29sYmFyTGVmdC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJyYWJiaXRtYXAtY2hhdC10b29sYmFyLWJ0blwiIH0pO1xuXHRzZXRJY29uKGF0dGFjaEJ0biwgXCJwYXBlcmNsaXBcIik7XG5cdGF0dGFjaEJ0bi5zZXRBdHRyaWJ1dGUoXCJhcmlhLWxhYmVsXCIsIFwiQXR0YWNoIGZpbGVzXCIpO1xuXHRhdHRhY2hCdG4ub25jbGljayA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG5cdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRuZXcgTm90aWNlKFwiRHJhZyBmaWxlcyBvciBmb2xkZXJzIG9udG8gdGhpcyBjaGF0IHRvIGFkZCBjb250ZXh0XCIpO1xuXHR9O1xuXG5cdC8vIEAgYnV0dG9uXG5cdGNvbnN0IGF0QnRuID0gdG9vbGJhckxlZnQuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwicmFiYml0bWFwLWNoYXQtdG9vbGJhci1idG5cIiB9KTtcblx0c2V0SWNvbihhdEJ0biwgXCJhdC1zaWduXCIpO1xuXHRhdEJ0bi5zZXRBdHRyaWJ1dGUoXCJhcmlhLWxhYmVsXCIsIFwiQWRkIGNvbnRleHRcIik7XG5cblx0Ly8gUHJvbXB0IGVkaXQgYnV0dG9uIChzbGlkZXJzKVxuXHRjb25zdCBwcm9tcHRCdG4gPSB0b29sYmFyTGVmdC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJyYWJiaXRtYXAtY2hhdC10b29sYmFyLWJ0blwiIH0pO1xuXHRzZXRJY29uKHByb21wdEJ0biwgXCJzbGlkZXJzLWhvcml6b250YWxcIik7XG5cdHByb21wdEJ0bi5zZXRBdHRyaWJ1dGUoXCJhcmlhLWxhYmVsXCIsIFwiRWRpdCBwcm9tcHRcIik7XG5cdHByb21wdEJ0bi5vbmNsaWNrID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcblx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdGNvbnN0IGN1cnJlbnRTdGF0ZSA9IHZpZXcuY2hhdFN0YXRlcy5nZXQobm9kZUlkKTtcblx0XHRuZXcgUHJvbXB0RWRpdG9yTW9kYWwoXG5cdFx0XHR2aWV3LmFwcCxcblx0XHRcdGN1cnJlbnRTdGF0ZT8uc3lzdGVtUHJvbXB0IHx8IFwiXCIsXG5cdFx0XHRjdXJyZW50U3RhdGU/LmNvbnRleHRUZW1wbGF0ZSB8fCBERUZBVUxUX0NPTlRFWFRfVEVNUExBVEUsXG5cdFx0XHQobmV3UHJvbXB0LCBuZXdUZW1wbGF0ZSkgPT4ge1xuXHRcdFx0XHRjb25zdCBzdCA9IHZpZXcuY2hhdFN0YXRlcy5nZXQobm9kZUlkKTtcblx0XHRcdFx0aWYgKHN0KSB7XG5cdFx0XHRcdFx0c3Quc3lzdGVtUHJvbXB0ID0gbmV3UHJvbXB0O1xuXHRcdFx0XHRcdHN0LmNvbnRleHRUZW1wbGF0ZSA9IG5ld1RlbXBsYXRlO1xuXHRcdFx0XHRcdHZpZXcuY2hhdFN0YXRlcy5zZXQobm9kZUlkLCBzdCk7XG5cdFx0XHRcdFx0dmlldy50cmlnZ2VyU2F2ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KS5vcGVuKCk7XG5cdH07XG5cblx0Ly8gTW9kZWwgbGFiZWwgKyBwb3BvdmVyXG5cdGNvbnN0IG1vZGVsTGFiZWxDb250YWluZXIgPSB0b29sYmFyUmlnaHQuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1jaGF0LW1vZGVsLWNvbnRhaW5lclwiIH0pO1xuXHRtb2RlbExhYmVsID0gbW9kZWxMYWJlbENvbnRhaW5lci5jcmVhdGVTcGFuKHsgY2xzOiBcInJhYmJpdG1hcC1jaGF0LW1vZGVsLWxhYmVsXCIgfSk7XG5cdG1vZGVsTGFiZWwudGV4dENvbnRlbnQgPSBmb3JtYXRNb2RlbE5hbWUoc3RhdGUubW9kZWwpICsgXCIgXFx1MjVCRVwiO1xuXG5cdGNvbnN0IHBvcG92ZXIgPSBtb2RlbExhYmVsQ29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtY2hhdC1tb2RlbC1wb3BvdmVyXCIgfSk7XG5cdHBvcG92ZXIuYWRkQ2xhc3MoXCJpcy1oaWRkZW5cIik7XG5cdHBvcG92ZXIuYXBwZW5kQ2hpbGQocHJvdmlkZXJTZWxlY3QpO1xuXHRwb3BvdmVyLmFwcGVuZENoaWxkKG1vZGVsU2VsZWN0KTtcblxuXHRsZXQgcG9wb3Zlck9wZW4gPSBmYWxzZTtcblx0bW9kZWxMYWJlbC5vbmNsaWNrID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcblx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdHBvcG92ZXJPcGVuID0gIXBvcG92ZXJPcGVuO1xuXHRcdHBvcG92ZXIudG9nZ2xlQ2xhc3MoXCJpcy1oaWRkZW5cIiwgIXBvcG92ZXJPcGVuKTtcblx0fTtcblxuXHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuXHRcdGlmIChwb3BvdmVyT3Blbikge1xuXHRcdFx0cG9wb3Zlck9wZW4gPSBmYWxzZTtcblx0XHRcdHBvcG92ZXIuYWRkQ2xhc3MoXCJpcy1oaWRkZW5cIik7XG5cdFx0fVxuXHR9KTtcblxuXHRwb3BvdmVyLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZTogTW91c2VFdmVudCkgPT4ge1xuXHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdH0pO1xuXG5cdC8vIFNlbmQgYnV0dG9uIChjaXJjdWxhciB3aXRoIGFycm93KVxuXHRjb25zdCBzZW5kQnRuID0gdG9vbGJhclJpZ2h0LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcInJhYmJpdG1hcC1zZW5kLWJ0blwiIH0pO1xuXHRzZXRJY29uKHNlbmRCdG4sIFwiYXJyb3ctdXBcIik7XG5cblx0Ly8gLS0tIERyYWcgYW5kIGRyb3AgaGFuZGxpbmcgKG9uIGNvbnRhaW5lcikgLS0tXG5cdGNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ292ZXJcIiwgKGU6IERyYWdFdmVudCkgPT4ge1xuXHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdGNvbnRhaW5lci5hZGRDbGFzcyhcInJhYmJpdG1hcC1kcmFnLW92ZXJcIik7XG5cdH0pO1xuXG5cdGNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ2xlYXZlXCIsIChlOiBEcmFnRXZlbnQpID0+IHtcblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0Y29udGFpbmVyLnJlbW92ZUNsYXNzKFwicmFiYml0bWFwLWRyYWctb3ZlclwiKTtcblx0fSk7XG5cblx0Y29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoXCJkcm9wXCIsIChlOiBEcmFnRXZlbnQpID0+IHtcblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRjb250YWluZXIucmVtb3ZlQ2xhc3MoXCJyYWJiaXRtYXAtZHJhZy1vdmVyXCIpO1xuXG5cdFx0Y29uc3QgcGxhaW5UZXh0ID0gZS5kYXRhVHJhbnNmZXI/LmdldERhdGEoXCJ0ZXh0L3BsYWluXCIpIHx8IFwiXCI7XG5cblx0XHRjb25zdCBwYXJzZVBhdGggPSAoaW5wdXRTdHI6IHN0cmluZyk6IHN0cmluZyA9PiB7XG5cdFx0XHRpbnB1dFN0ciA9IGlucHV0U3RyLnRyaW0oKTtcblxuXHRcdFx0aWYgKGlucHV0U3RyLnN0YXJ0c1dpdGgoXCJvYnNpZGlhbjovL1wiKSkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IHVybCA9IG5ldyBVUkwoaW5wdXRTdHIpO1xuXHRcdFx0XHRcdGNvbnN0IGZpbGVQYXRoID0gdXJsLnNlYXJjaFBhcmFtcy5nZXQoXCJmaWxlXCIpO1xuXHRcdFx0XHRcdGlmIChmaWxlUGF0aCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChmaWxlUGF0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIHsgLyogbm9vcCAqLyB9XG5cdFx0XHR9XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGlucHV0U3RyID0gZGVjb2RlVVJJQ29tcG9uZW50KGlucHV0U3RyKTtcblx0XHRcdH0gY2F0Y2ggeyAvKiBub29wICovIH1cblxuXHRcdFx0Y29uc3Qgd2lraU1hdGNoID0gaW5wdXRTdHIubWF0Y2goL15cXFtcXFsoLis/KVxcXVxcXSQvKTtcblx0XHRcdGlmICh3aWtpTWF0Y2gpIHtcblx0XHRcdFx0cmV0dXJuIHdpa2lNYXRjaFsxXTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbWRNYXRjaCA9IGlucHV0U3RyLm1hdGNoKC9eXFxbLis/XFxdXFwoKC4rPylcXCkkLyk7XG5cdFx0XHRpZiAobWRNYXRjaCkge1xuXHRcdFx0XHRyZXR1cm4gbWRNYXRjaFsxXTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGlucHV0U3RyLnN0YXJ0c1dpdGgoXCIvXCIpKSB7XG5cdFx0XHRcdGlucHV0U3RyID0gaW5wdXRTdHIuc2xpY2UoMSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBpbnB1dFN0cjtcblx0XHR9O1xuXG5cdFx0Y29uc3QgYWRkRmlsZXNGcm9tRm9sZGVyID0gKGZvbGRlcjogVEZvbGRlciwgY2hhdFN0YXRlOiBDaGF0Tm9kZVN0YXRlKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIGZvbGRlci5jaGlsZHJlbikge1xuXHRcdFx0XHRpZiAoY2hpbGQgaW5zdGFuY2VvZiBURmlsZSkge1xuXHRcdFx0XHRcdGlmICghY2hhdFN0YXRlLmNvbnRleHRGaWxlcy5pbmNsdWRlcyhjaGlsZC5wYXRoKSkge1xuXHRcdFx0XHRcdFx0Y2hhdFN0YXRlLmNvbnRleHRGaWxlcy5wdXNoKGNoaWxkLnBhdGgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcblx0XHRcdFx0XHRhZGRGaWxlc0Zyb21Gb2xkZXIoY2hpbGQsIGNoYXRTdGF0ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgZ2V0QWxsRm9sZGVycyA9IChmb2xkZXI6IFRGb2xkZXIpOiBURm9sZGVyW10gPT4ge1xuXHRcdFx0Y29uc3QgZm9sZGVyczogVEZvbGRlcltdID0gW2ZvbGRlcl07XG5cdFx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIGZvbGRlci5jaGlsZHJlbikge1xuXHRcdFx0XHRpZiAoY2hpbGQgaW5zdGFuY2VvZiBURm9sZGVyKSB7XG5cdFx0XHRcdFx0Zm9sZGVycy5wdXNoKC4uLmdldEFsbEZvbGRlcnMoY2hpbGQpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZvbGRlcnM7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHRyeUFkZFBhdGggPSAoaW5wdXRTdHI6IHN0cmluZykgPT4ge1xuXHRcdFx0aWYgKCFpbnB1dFN0cikgcmV0dXJuIGZhbHNlO1xuXG5cdFx0XHRsZXQgcGF0aCA9IHBhcnNlUGF0aChpbnB1dFN0cik7XG5cdFx0XHRpZiAoIXBhdGgpIHJldHVybiBmYWxzZTtcblxuXHRcdFx0aWYgKHBhdGguc3RhcnRzV2l0aChcImh0dHBcIikpIHtcblx0XHRcdFx0Y29uc3QgY2FudmFzUmVjdCA9IHZpZXcuY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0XHRjb25zdCB4ID0gKGUuY2xpZW50WCAtIGNhbnZhc1JlY3QubGVmdCAtIHZpZXcucGFuWCkgLyB2aWV3LnNjYWxlO1xuXHRcdFx0XHRjb25zdCB5ID0gKGUuY2xpZW50WSAtIGNhbnZhc1JlY3QudG9wIC0gdmlldy5wYW5ZKSAvIHZpZXcuc2NhbGU7XG5cdFx0XHRcdHZpZXcuYWRkTGlua05vZGUocGF0aCwgeCAtIDE1MCwgeSAtIDEwMCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgaXRlbSA9IHZpZXcuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTtcblxuXHRcdFx0aWYgKCFpdGVtICYmICFwYXRoLmluY2x1ZGVzKFwiLlwiKSkge1xuXHRcdFx0XHRpdGVtID0gdmlldy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGggKyBcIi5tZFwiKTtcblx0XHRcdFx0aWYgKGl0ZW0pIHBhdGggPSBwYXRoICsgXCIubWRcIjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFpdGVtICYmICFwYXRoLmluY2x1ZGVzKFwiLlwiKSkge1xuXHRcdFx0XHRjb25zdCByb290Rm9sZGVyID0gdmlldy5hcHAudmF1bHQuZ2V0Um9vdCgpO1xuXHRcdFx0XHRjb25zdCBhbGxGb2xkZXJzID0gZ2V0QWxsRm9sZGVycyhyb290Rm9sZGVyKTtcblx0XHRcdFx0Y29uc3QgZm9sZGVyTmFtZSA9IHBhdGguc3BsaXQoXCIvXCIpLnBvcCgpIHx8IHBhdGg7XG5cdFx0XHRcdGl0ZW0gPSBhbGxGb2xkZXJzLmZpbmQoZiA9PlxuXHRcdFx0XHRcdGYucGF0aCA9PT0gcGF0aCB8fFxuXHRcdFx0XHRcdGYubmFtZSA9PT0gZm9sZGVyTmFtZSB8fFxuXHRcdFx0XHRcdGYucGF0aC5lbmRzV2l0aChcIi9cIiArIHBhdGgpXG5cdFx0XHRcdCkgfHwgbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFpdGVtKSB7XG5cdFx0XHRcdGNvbnN0IGFsbEZpbGVzID0gdmlldy5hcHAudmF1bHQuZ2V0RmlsZXMoKTtcblx0XHRcdFx0Y29uc3QgZmlsZU5hbWUgPSBwYXRoLnNwbGl0KFwiL1wiKS5wb3AoKSB8fCBwYXRoO1xuXHRcdFx0XHRpdGVtID0gYWxsRmlsZXMuZmluZChmID0+XG5cdFx0XHRcdFx0Zi5wYXRoID09PSBwYXRoIHx8XG5cdFx0XHRcdFx0Zi5uYW1lID09PSBmaWxlTmFtZSB8fFxuXHRcdFx0XHRcdGYuYmFzZW5hbWUgPT09IGZpbGVOYW1lIHx8XG5cdFx0XHRcdFx0Zi5wYXRoLmVuZHNXaXRoKFwiL1wiICsgcGF0aClcblx0XHRcdFx0KSB8fCBudWxsO1xuXHRcdFx0XHRpZiAoaXRlbSkgcGF0aCA9IGl0ZW0ucGF0aDtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY2hhdFN0YXRlID0gdmlldy5jaGF0U3RhdGVzLmdldChub2RlSWQpO1xuXHRcdFx0aWYgKCFjaGF0U3RhdGUpIHJldHVybiBmYWxzZTtcblxuXHRcdFx0aWYgKGl0ZW0gaW5zdGFuY2VvZiBURm9sZGVyKSB7XG5cdFx0XHRcdGFkZEZpbGVzRnJvbUZvbGRlcihpdGVtLCBjaGF0U3RhdGUpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGl0ZW0gaW5zdGFuY2VvZiBURmlsZSkge1xuXHRcdFx0XHRpZiAoIWNoYXRTdGF0ZS5jb250ZXh0RmlsZXMuaW5jbHVkZXMocGF0aCkpIHtcblx0XHRcdFx0XHRjaGF0U3RhdGUuY29udGV4dEZpbGVzLnB1c2gocGF0aCk7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9O1xuXG5cdFx0bGV0IGFkZGVkID0gZmFsc2U7XG5cblx0XHRpZiAocGxhaW5UZXh0KSB7XG5cdFx0XHRjb25zdCBsaW5lcyA9IHBsYWluVGV4dC5zcGxpdChcIlxcblwiKTtcblx0XHRcdGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuXHRcdFx0XHRpZiAodHJ5QWRkUGF0aChsaW5lLnRyaW0oKSkpIHtcblx0XHRcdFx0XHRhZGRlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoYWRkZWQpIHtcblx0XHRcdGNvbnN0IGNoYXRTdGF0ZSA9IHZpZXcuY2hhdFN0YXRlcy5nZXQobm9kZUlkKTtcblx0XHRcdGlmIChjaGF0U3RhdGUpIHtcblx0XHRcdFx0dmlldy5jaGF0U3RhdGVzLnNldChub2RlSWQsIGNoYXRTdGF0ZSk7XG5cdFx0XHRcdHJlbmRlckNvbnRleHRGaWxlcygpO1xuXHRcdFx0XHR2aWV3LnRyaWdnZXJTYXZlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblxuXHQvLyAtLS0gU2VuZCBtZXNzYWdlIGxvZ2ljIC0tLVxuXHRjb25zdCBzZW5kTWVzc2FnZSA9IGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB0ZXh0ID0gaW5wdXQudmFsdWUudHJpbSgpO1xuXHRcdGlmICghdGV4dCkgcmV0dXJuO1xuXG5cdFx0Y29uc3QgY2hhdFN0YXRlID0gdmlldy5jaGF0U3RhdGVzLmdldChub2RlSWQpITtcblxuXHRcdGNvbnN0IG1zZzogQ2hhdE1lc3NhZ2UgPSB7XG5cdFx0XHRyb2xlOiBcInVzZXJcIixcblx0XHRcdGNvbnRlbnQ6IHRleHQsXG5cdFx0XHRjb250ZXh0RmlsZXM6IGNoYXRTdGF0ZS5jb250ZXh0RmlsZXMgPyBbLi4uY2hhdFN0YXRlLmNvbnRleHRGaWxlc10gOiBbXVxuXHRcdH07XG5cdFx0Y29uc3QgYWxsTWVzc2FnZXMgPSB2aWV3LmNoYXRNZXNzYWdlcy5nZXQobm9kZUlkKSB8fCBbXTtcblx0XHRhbGxNZXNzYWdlcy5wdXNoKG1zZyk7XG5cdFx0dmlldy5jaGF0TWVzc2FnZXMuc2V0KG5vZGVJZCwgYWxsTWVzc2FnZXMpO1xuXHRcdHJlbmRlckNoYXRNZXNzYWdlKHZpZXcsIG1lc3NhZ2VzQ29udGFpbmVyLCBtc2csIG5vZGVJZCwgYWxsTWVzc2FnZXMubGVuZ3RoIC0gMSk7XG5cdFx0aW5wdXQudmFsdWUgPSBcIlwiO1xuXHRcdG1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbFRvcCA9IG1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbEhlaWdodDtcblx0XHR2aWV3LnRyaWdnZXJTYXZlKCk7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB2aWV3LnBsdWdpbi5zZXR0aW5ncy5wcm92aWRlcnMuZmluZChwID0+IHAubmFtZSA9PT0gY2hhdFN0YXRlLnByb3ZpZGVyKTtcblx0XHRpZiAoIXByb3ZpZGVyKSByZXR1cm47XG5cblx0XHRjb25zdCBhcGlLZXkgPSBwcm92aWRlci5hcGlLZXkgfHwgXCJcIjtcblxuXHRcdGlmICghYXBpS2V5KSB7XG5cdFx0XHRjb25zdCBlcnJvck1zZzogQ2hhdE1lc3NhZ2UgPSB7XG5cdFx0XHRcdHJvbGU6IFwiYXNzaXN0YW50XCIsXG5cdFx0XHRcdGNvbnRlbnQ6IGBQbGVhc2Ugc2V0IHlvdXIgJHtjaGF0U3RhdGUucHJvdmlkZXJ9IEFQSSBrZXkgaW4gc2V0dGluZ3MuYCxcblx0XHRcdH07XG5cdFx0XHRhbGxNZXNzYWdlcy5wdXNoKGVycm9yTXNnKTtcblx0XHRcdHJlbmRlckNoYXRNZXNzYWdlKHZpZXcsIG1lc3NhZ2VzQ29udGFpbmVyLCBlcnJvck1zZywgbm9kZUlkLCBhbGxNZXNzYWdlcy5sZW5ndGggLSAxKTtcblx0XHRcdG1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbFRvcCA9IG1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbEhlaWdodDtcblx0XHRcdHZpZXcudHJpZ2dlclNhdmUoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBsb2FkaW5nRWwgPSBtZXNzYWdlc0NvbnRhaW5lci5jcmVhdGVEaXYoe1xuXHRcdFx0Y2xzOiBcInJhYmJpdG1hcC1jaGF0LW1lc3NhZ2UgcmFiYml0bWFwLWNoYXQtYXNzaXN0YW50IHJhYmJpdG1hcC1jaGF0LWxvYWRpbmdcIixcblx0XHR9KTtcblx0XHRsb2FkaW5nRWwuY3JlYXRlU3Bhbih7IHRleHQ6IFwiLi4uXCIgfSk7XG5cdFx0bWVzc2FnZXNDb250YWluZXIuc2Nyb2xsVG9wID0gbWVzc2FnZXNDb250YWluZXIuc2Nyb2xsSGVpZ2h0O1xuXG5cdFx0bGV0IGNvbnRleHRDb250ZW50ID0gXCJcIjtcblx0XHRpZiAoY2hhdFN0YXRlLmNvbnRleHRGaWxlcyAmJiBjaGF0U3RhdGUuY29udGV4dEZpbGVzLmxlbmd0aCA+IDApIHtcblx0XHRcdGNvbnN0IHRlbXBsYXRlID0gY2hhdFN0YXRlLmNvbnRleHRUZW1wbGF0ZSB8fCBERUZBVUxUX0NPTlRFWFRfVEVNUExBVEU7XG5cdFx0XHRjb25zdCBjb250ZXh0UGFydHM6IHN0cmluZ1tdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IGZpbGVQYXRoIG9mIGNoYXRTdGF0ZS5jb250ZXh0RmlsZXMpIHtcblx0XHRcdFx0Y29uc3QgZmlsZSA9IHZpZXcuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlUGF0aCk7XG5cdFx0XHRcdGlmIChmaWxlICYmIGZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdmlldy5hcHAudmF1bHQucmVhZChmaWxlKTtcblx0XHRcdFx0XHRcdGNvbnN0IGZvcm1hdHRlZCA9IHRlbXBsYXRlXG5cdFx0XHRcdFx0XHRcdC5yZXBsYWNlKC9cXHtmaWxlcGF0aFxcfS9nLCBmaWxlUGF0aClcblx0XHRcdFx0XHRcdFx0LnJlcGxhY2UoL1xce2ZpbGVuYW1lXFx9L2csIGZpbGUubmFtZSlcblx0XHRcdFx0XHRcdFx0LnJlcGxhY2UoL1xce2NvbnRlbnRcXH0vZywgY29udGVudCk7XG5cdFx0XHRcdFx0XHRjb250ZXh0UGFydHMucHVzaChmb3JtYXR0ZWQpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggeyAvKiBub29wICovIH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKGNvbnRleHRQYXJ0cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGNvbnRleHRDb250ZW50ID0gXCJDb250ZXh0IGZpbGVzOlxcblxcblwiICsgY29udGV4dFBhcnRzLmpvaW4oXCJcXG5cXG5cIik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGNoYXRTdGF0ZS5jb250ZXh0Tm9kZXMgJiYgY2hhdFN0YXRlLmNvbnRleHROb2Rlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBub2RlQ29udGVudCA9IHZpZXcuZ2V0Q29ubmVjdGVkQ29udGVudChjaGF0U3RhdGUuY29udGV4dE5vZGVzKTtcblx0XHRcdGlmIChub2RlQ29udGVudCkge1xuXHRcdFx0XHRjb250ZXh0Q29udGVudCA9IGNvbnRleHRDb250ZW50XG5cdFx0XHRcdFx0PyBjb250ZXh0Q29udGVudCArIFwiXFxuXFxuXCIgKyBub2RlQ29udGVudFxuXHRcdFx0XHRcdDogbm9kZUNvbnRlbnQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY2FsbExMTShwcm92aWRlciwgYXBpS2V5LCBjaGF0U3RhdGUubW9kZWwsIGFsbE1lc3NhZ2VzLCBjb250ZXh0Q29udGVudCwgY2hhdFN0YXRlLnN5c3RlbVByb21wdCB8fCBcIlwiKTtcblx0XHRcdGxvYWRpbmdFbC5yZW1vdmUoKTtcblxuXHRcdFx0Y29uc3QgYXNzaXN0YW50TXNnOiBDaGF0TWVzc2FnZSA9IHtcblx0XHRcdFx0cm9sZTogXCJhc3Npc3RhbnRcIixcblx0XHRcdFx0Y29udGVudDogcmVzcG9uc2UsXG5cdFx0XHR9O1xuXHRcdFx0YWxsTWVzc2FnZXMucHVzaChhc3Npc3RhbnRNc2cpO1xuXHRcdFx0cmVuZGVyQ2hhdE1lc3NhZ2UodmlldywgbWVzc2FnZXNDb250YWluZXIsIGFzc2lzdGFudE1zZywgbm9kZUlkLCBhbGxNZXNzYWdlcy5sZW5ndGggLSAxKTtcblx0XHRcdG1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbFRvcCA9IG1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbEhlaWdodDtcblx0XHRcdHZpZXcudHJpZ2dlclNhdmUoKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0bG9hZGluZ0VsLnJlbW92ZSgpO1xuXHRcdFx0Y29uc3QgZXJyb3JNc2c6IENoYXRNZXNzYWdlID0ge1xuXHRcdFx0XHRyb2xlOiBcImFzc2lzdGFudFwiLFxuXHRcdFx0XHRjb250ZW50OiBgRXJyb3I6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIlVua25vd24gZXJyb3JcIn1gLFxuXHRcdFx0fTtcblx0XHRcdGFsbE1lc3NhZ2VzLnB1c2goZXJyb3JNc2cpO1xuXHRcdFx0cmVuZGVyQ2hhdE1lc3NhZ2UodmlldywgbWVzc2FnZXNDb250YWluZXIsIGVycm9yTXNnLCBub2RlSWQsIGFsbE1lc3NhZ2VzLmxlbmd0aCAtIDEpO1xuXHRcdFx0bWVzc2FnZXNDb250YWluZXIuc2Nyb2xsVG9wID0gbWVzc2FnZXNDb250YWluZXIuc2Nyb2xsSGVpZ2h0O1xuXHRcdFx0dmlldy50cmlnZ2VyU2F2ZSgpO1xuXHRcdH1cblx0fTtcblxuXHRzZW5kQnRuLm9uY2xpY2sgPSAoKSA9PiB2b2lkIHNlbmRNZXNzYWdlKCk7XG5cdGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0aWYgKGUua2V5ID09PSBcIkVudGVyXCIgJiYgIWUuc2hpZnRLZXkpIHtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHZvaWQgc2VuZE1lc3NhZ2UoKTtcblx0XHR9XG5cdH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQ2hhdE1lc3NhZ2UodmlldzogQ2FudmFzQ2hhdFZpZXcsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIG1zZzogQ2hhdE1lc3NhZ2UsIG5vZGVJZDogc3RyaW5nLCBtc2dJbmRleDogbnVtYmVyKTogdm9pZCB7XG5cdGNvbnN0IG1zZ0VsID0gY29udGFpbmVyLmNyZWF0ZURpdih7XG5cdFx0Y2xzOiBgcmFiYml0bWFwLWNoYXQtbWVzc2FnZSByYWJiaXRtYXAtY2hhdC0ke21zZy5yb2xlfWAsXG5cdH0pO1xuXG5cdC8vIFJlbmRlciBtYXJrZG93biBmb3IgYXNzaXN0YW50IG1lc3NhZ2VzLCBwbGFpbiB0ZXh0IGZvciB1c2VyXG5cdGlmIChtc2cucm9sZSA9PT0gXCJhc3Npc3RhbnRcIikge1xuXHRcdGNvbnN0IGNvbnRlbnRFbCA9IG1zZ0VsLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtbWVzc2FnZS1jb250ZW50XCIgfSk7XG5cdFx0dm9pZCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcihcblx0XHRcdHZpZXcuYXBwLFxuXHRcdFx0bXNnLmNvbnRlbnQsXG5cdFx0XHRjb250ZW50RWwsXG5cdFx0XHRcIlwiLFxuXHRcdFx0dmlld1xuXHRcdCk7XG5cdH0gZWxzZSB7XG5cdFx0bXNnRWwuY3JlYXRlU3Bhbih7IHRleHQ6IG1zZy5jb250ZW50IH0pO1xuXHR9XG5cblx0Ly8gQ29udGV4dCBtZW51IG9uIHJpZ2h0IGNsaWNrXG5cdG1zZ0VsLmFkZEV2ZW50TGlzdGVuZXIoXCJjb250ZXh0bWVudVwiLCAoZSkgPT4ge1xuXHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdHZpZXcuc2hvd01lc3NhZ2VDb250ZXh0TWVudShub2RlSWQsIG1zZ0luZGV4LCBlKTtcblx0fSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXJlbmRlck5vZGUodmlldzogQ2FudmFzQ2hhdFZpZXcsIG5vZGVJZDogc3RyaW5nKTogdm9pZCB7XG5cdGNvbnN0IGVsID0gdmlldy5ub2RlRWxlbWVudHMuZ2V0KG5vZGVJZCk7XG5cdGNvbnN0IG5vZGUgPSB2aWV3Lm5vZGVzLmdldChub2RlSWQpO1xuXHRpZiAoIWVsIHx8ICFub2RlKSByZXR1cm47XG5cblx0ZWwucmVtb3ZlKCk7XG5cdHZpZXcubm9kZUVsZW1lbnRzLmRlbGV0ZShub2RlSWQpO1xuXHRyZW5kZXJOb2RlKHZpZXcsIG5vZGUpO1xufVxuIl19