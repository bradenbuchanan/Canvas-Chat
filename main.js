var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => RabbitMapPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var VIEW_TYPE_RABBITMAP = "rabbitmap-canvas";
var FILE_EXTENSION = "rabbitmap";
var DEFAULT_SETTINGS = {
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
var DEFAULT_CONTEXT_TEMPLATE = `--- {filepath} ---
{content}`;
var DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. You help users with their questions and tasks. When context files are provided, use them to give more accurate and relevant answers. Be concise but thorough.`;
var RabbitMapView = class extends import_obsidian.TextFileView {
  constructor(leaf, plugin) {
    super(leaf);
    this.nodes = /* @__PURE__ */ new Map();
    this.nodeElements = /* @__PURE__ */ new Map();
    // Canvas transform state
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    // Interaction state
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.spacePressed = false;
    // Drag state
    this.draggedNode = null;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    // Resize state
    this.resizingNode = null;
    this.resizeStartWidth = 0;
    this.resizeStartHeight = 0;
    this.resizeStartX = 0;
    this.resizeStartY = 0;
    // Selection state
    this.selectedNodes = /* @__PURE__ */ new Set();
    this.isSelecting = false;
    this.selectionBox = null;
    this.selectionStartX = 0;
    this.selectionStartY = 0;
    this.dragStartPositions = /* @__PURE__ */ new Map();
    this.dragStartMouseX = 0;
    this.dragStartMouseY = 0;
    this.minimapNodes = /* @__PURE__ */ new Map();
    // Chat state
    this.chatMessages = /* @__PURE__ */ new Map();
    this.chatStates = /* @__PURE__ */ new Map();
    // Edges
    this.edges = /* @__PURE__ */ new Map();
    // Edge drawing state
    this.isDrawingEdge = false;
    this.edgeDrawFromNode = null;
    this.edgeDrawFromSide = null;
    this.edgeDrawTempLine = null;
    this.isLoaded = false;
    this.isSaving = false;
    this.saveTimeout = null;
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_RABBITMAP;
  }
  getDisplayText() {
    var _a;
    return ((_a = this.file) == null ? void 0 : _a.basename) || "RabbitMap";
  }
  getIcon() {
    return "layout-dashboard";
  }
  // Called by Obsidian to get current data for saving
  getViewData() {
    const data = {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      chatMessages: Object.fromEntries(this.chatMessages),
      chatStates: Object.fromEntries(this.chatStates),
      view: {
        scale: this.scale,
        panX: this.panX,
        panY: this.panY
      }
    };
    return JSON.stringify(data, null, 2);
  }
  // Called by Obsidian when file content is loaded
  setViewData(data, clear) {
    if (this.isSaving) {
      return;
    }
    if (clear) {
      this.clear();
    }
    try {
      if (data.trim()) {
        const parsed = JSON.parse(data);
        if (parsed.view) {
          this.scale = parsed.view.scale || 1;
          this.panX = parsed.view.panX || 0;
          this.panY = parsed.view.panY || 0;
        }
        if (parsed.chatMessages) {
          for (const [nodeId, messages] of Object.entries(parsed.chatMessages)) {
            this.chatMessages.set(nodeId, messages);
          }
        }
        if (parsed.chatStates) {
          for (const [nodeId, state] of Object.entries(parsed.chatStates)) {
            this.chatStates.set(nodeId, state);
          }
        }
        if (parsed.nodes && parsed.nodes.length > 0) {
          for (const node of parsed.nodes) {
            this.nodes.set(node.id, node);
            this.renderNode(node);
          }
        }
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
    if (this.nodes.size === 0) {
      this.addNode({
        id: this.generateId(),
        x: 100,
        y: 100,
        width: 400,
        height: 500,
        type: "chat",
        content: ""
      }, false);
    }
    this.updateTransform();
    this.isLoaded = true;
  }
  clear() {
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
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("rabbitmap-container");
    this.canvas = container.createDiv({ cls: "rabbitmap-canvas" });
    this.edgesContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.edgesContainer.addClass("rabbitmap-edges");
    this.canvas.appendChild(this.edgesContainer);
    this.nodesContainer = this.canvas.createDiv({ cls: "rabbitmap-nodes" });
    this.selectionBox = this.canvas.createDiv({ cls: "rabbitmap-selection-box" });
    this.selectionBox.style.display = "none";
    this.createToolbar(container);
    this.createMinimap(container);
    this.setupEventListeners();
    this.updateTransform();
  }
  triggerSave() {
    if (!this.isLoaded || !this.file)
      return;
    if (this.saveTimeout) {
      window.clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = window.setTimeout(async () => {
      if (!this.file)
        return;
      this.isSaving = true;
      await this.app.vault.modify(this.file, this.getViewData());
      setTimeout(() => {
        this.isSaving = false;
      }, 100);
    }, 300);
  }
  createMinimap(container) {
    this.minimap = container.createDiv({ cls: "rabbitmap-minimap" });
    this.minimapContent = this.minimap.createDiv({ cls: "rabbitmap-minimap-content" });
    this.minimapViewport = this.minimap.createDiv({ cls: "rabbitmap-minimap-viewport" });
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
  navigateFromMinimap(e) {
    const bounds = this.getContentBounds();
    if (!bounds)
      return;
    const rect = this.minimap.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const minimapWidth = rect.width;
    const minimapHeight = rect.height;
    const padding = 50;
    const contentWidth = bounds.maxX - bounds.minX + padding * 2;
    const contentHeight = bounds.maxY - bounds.minY + padding * 2;
    const minimapScale = Math.min(minimapWidth / contentWidth, minimapHeight / contentHeight);
    const contentScaledWidth = contentWidth * minimapScale;
    const contentScaledHeight = contentHeight * minimapScale;
    const offsetX = (minimapWidth - contentScaledWidth) / 2;
    const offsetY = (minimapHeight - contentScaledHeight) / 2;
    const canvasX = (clickX - offsetX) / minimapScale + bounds.minX - padding;
    const canvasY = (clickY - offsetY) / minimapScale + bounds.minY - padding;
    this.panX = canvasRect.width / 2 - canvasX * this.scale;
    this.panY = canvasRect.height / 2 - canvasY * this.scale;
    const clamped = this.clampPan(this.panX, this.panY);
    this.panX = clamped.x;
    this.panY = clamped.y;
    this.updateTransform();
    this.triggerSave();
  }
  updateMinimap() {
    if (!this.minimap)
      return;
    const bounds = this.getContentBounds();
    if (!bounds) {
      this.minimapViewport.style.display = "none";
      return;
    }
    const canvasRect = this.canvas.getBoundingClientRect();
    const minimapRect = this.minimap.getBoundingClientRect();
    const padding = 50;
    const contentMinX = bounds.minX - padding;
    const contentMinY = bounds.minY - padding;
    const contentWidth = bounds.maxX - bounds.minX + padding * 2;
    const contentHeight = bounds.maxY - bounds.minY + padding * 2;
    const minimapScale = Math.min(
      minimapRect.width / contentWidth,
      minimapRect.height / contentHeight
    );
    const contentScaledWidth = contentWidth * minimapScale;
    const contentScaledHeight = contentHeight * minimapScale;
    const offsetX = (minimapRect.width - contentScaledWidth) / 2;
    const offsetY = (minimapRect.height - contentScaledHeight) / 2;
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
    for (const [nodeId, el] of this.minimapNodes) {
      if (!this.nodes.has(nodeId)) {
        el.remove();
        this.minimapNodes.delete(nodeId);
      }
    }
    this.minimapViewport.style.display = "block";
    const viewLeft = (-this.panX / this.scale - contentMinX) * minimapScale + offsetX;
    const viewTop = (-this.panY / this.scale - contentMinY) * minimapScale + offsetY;
    const viewWidth = canvasRect.width / this.scale * minimapScale;
    const viewHeight = canvasRect.height / this.scale * minimapScale;
    this.minimapViewport.style.left = `${viewLeft}px`;
    this.minimapViewport.style.top = `${viewTop}px`;
    this.minimapViewport.style.width = `${viewWidth}px`;
    this.minimapViewport.style.height = `${viewHeight}px`;
  }
  createToolbar(container) {
    const toolbar = container.createDiv({ cls: "rabbitmap-toolbar" });
    const addCardBtn = toolbar.createEl("button", { cls: "rabbitmap-btn rabbitmap-btn-icon", attr: { title: "Add Card" } });
    addCardBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
    addCardBtn.onclick = () => this.addCardAtCenter();
    const addChatBtn = toolbar.createEl("button", { cls: "rabbitmap-btn rabbitmap-btn-icon", attr: { title: "Add Chat" } });
    addChatBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    addChatBtn.onclick = () => this.addChatAtCenter();
    const addLinkBtn = toolbar.createEl("button", { cls: "rabbitmap-btn rabbitmap-btn-icon", attr: { title: "Add Link" } });
    addLinkBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
    addLinkBtn.onclick = () => this.showAddLinkModal();
    toolbar.createDiv({ cls: "rabbitmap-toolbar-separator" });
    const settingsBtn = toolbar.createEl("button", { cls: "rabbitmap-btn rabbitmap-btn-icon", attr: { title: "Settings" } });
    settingsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    settingsBtn.onclick = () => this.openSettings();
  }
  openSettings() {
    new SettingsModal(this.app, this.plugin).open();
  }
  setupEventListeners() {
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const delta = -e.deltaY * 0.01;
        this.zoomAtPoint(delta, e.clientX, e.clientY);
      } else {
        let newPanX = this.panX - e.deltaX;
        let newPanY = this.panY - e.deltaY;
        const clamped = this.clampPan(newPanX, newPanY);
        this.panX = clamped.x;
        this.panY = clamped.y;
        this.updateTransform();
        this.triggerSave();
      }
    });
    this.canvas.addEventListener("mousedown", (e) => {
      if (e.button === 1 || e.button === 0 && this.spacePressed) {
        e.preventDefault();
        this.isPanning = true;
        this.panStartX = e.clientX - this.panX;
        this.panStartY = e.clientY - this.panY;
        this.canvas.addClass("panning");
      } else if (e.button === 0 && e.target === this.canvas) {
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
        if (!e.shiftKey) {
          this.clearSelection();
        }
      }
    });
    document.addEventListener("mousemove", (e) => {
      if (this.isPanning) {
        let newPanX = e.clientX - this.panStartX;
        let newPanY = e.clientY - this.panStartY;
        const clamped = this.clampPan(newPanX, newPanY);
        this.panX = clamped.x;
        this.panY = clamped.y;
        this.updateTransform();
      } else if (this.isSelecting && this.selectionBox) {
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
      } else if (this.resizingNode) {
        const deltaX = (e.clientX - this.resizeStartX) / this.scale;
        const deltaY = (e.clientY - this.resizeStartY) / this.scale;
        const newWidth = Math.max(200, this.resizeStartWidth + deltaX);
        const newHeight = Math.max(150, this.resizeStartHeight + deltaY);
        this.updateNodeSize(this.resizingNode, newWidth, newHeight);
      }
    });
    document.addEventListener("mouseup", (e) => {
      if (this.isDrawingEdge) {
        const targetInfo = this.findTargetHandle(e);
        if (targetInfo && targetInfo.nodeId !== this.edgeDrawFromNode) {
          const duplicate = Array.from(this.edges.values()).some(
            (edge) => edge.from === this.edgeDrawFromNode && edge.to === targetInfo.nodeId || edge.from === targetInfo.nodeId && edge.to === this.edgeDrawFromNode
          );
          if (!duplicate) {
            this.addEdge(this.edgeDrawFromNode, targetInfo.nodeId);
            this.triggerSave();
          }
        }
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
      this.isPanning = false;
      this.draggedNode = null;
      this.dragStartPositions.clear();
      this.resizingNode = null;
      this.canvas.removeClass("panning");
      if (this.isSelecting && this.selectionBox) {
        this.isSelecting = false;
        this.selectionBox.style.display = "none";
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" && !this.isInputFocused()) {
        e.preventDefault();
        this.spacePressed = true;
        this.canvas.addClass("pan-mode");
      }
      if ((e.code === "Delete" || e.code === "Backspace") && !this.isInputFocused() && this.selectedNodes.size > 0) {
        e.preventDefault();
        this.deleteSelectedNodes();
      }
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
    this.canvas.addEventListener("paste", (e) => {
      var _a, _b;
      if (this.isInputFocused())
        return;
      const text = (_b = (_a = e.clipboardData) == null ? void 0 : _a.getData("text/plain")) == null ? void 0 : _b.trim();
      if (text && /^https?:\/\//i.test(text)) {
        e.preventDefault();
        this.addLinkAtCenter(text);
      }
    });
    this.canvas.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.canvas.addClass("rabbitmap-canvas-drag-over");
    });
    this.canvas.addEventListener("dragleave", (e) => {
      e.preventDefault();
      this.canvas.removeClass("rabbitmap-canvas-drag-over");
    });
    this.canvas.addEventListener("drop", async (e) => {
      var _a;
      e.preventDefault();
      this.canvas.removeClass("rabbitmap-canvas-drag-over");
      const plainText = ((_a = e.dataTransfer) == null ? void 0 : _a.getData("text/plain")) || "";
      if (!plainText)
        return;
      const canvasRect = this.canvas.getBoundingClientRect();
      const dropX = (e.clientX - canvasRect.left - this.panX) / this.scale;
      const dropY = (e.clientY - canvasRect.top - this.panY) / this.scale;
      const lines = plainText.split("\n").map((l) => l.trim()).filter((l) => l);
      let offsetIndex = 0;
      for (const line of lines) {
        const path = this.parsePath(line);
        if (!path)
          continue;
        if (path.startsWith("http")) {
          this.addLinkNode(path, dropX - 150 + offsetIndex * 30, dropY - 100 + offsetIndex * 30);
          offsetIndex++;
          continue;
        }
        const item = this.resolveVaultItem(path);
        if (item instanceof import_obsidian.TFolder) {
          const mdFiles = this.getMdFilesFromFolder(item);
          for (const file of mdFiles) {
            try {
              const content = await this.app.vault.read(file);
              this.addNoteNode(file.path, content, dropX + offsetIndex * 30, dropY + offsetIndex * 30);
              offsetIndex++;
            } catch (e2) {
            }
          }
        } else if (item instanceof import_obsidian.TFile && item.extension === "md") {
          try {
            const content = await this.app.vault.read(item);
            this.addNoteNode(item.path, content, dropX + offsetIndex * 30, dropY + offsetIndex * 30);
            offsetIndex++;
          } catch (e2) {
          }
        }
      }
    });
  }
  updateSelectionFromBox(left, top, width, height) {
    const boxLeft = (left - this.panX) / this.scale;
    const boxTop = (top - this.panY) / this.scale;
    const boxRight = (left + width - this.panX) / this.scale;
    const boxBottom = (top + height - this.panY) / this.scale;
    for (const [nodeId, node] of this.nodes) {
      const nodeRight = node.x + node.width;
      const nodeBottom = node.y + node.height;
      const intersects = node.x < boxRight && nodeRight > boxLeft && node.y < boxBottom && nodeBottom > boxTop;
      if (intersects) {
        this.selectNode(nodeId);
      } else {
        this.deselectNode(nodeId);
      }
    }
  }
  selectNode(nodeId) {
    if (!this.selectedNodes.has(nodeId)) {
      this.selectedNodes.add(nodeId);
      const el = this.nodeElements.get(nodeId);
      if (el) {
        el.addClass("rabbitmap-node-selected");
      }
    }
  }
  deselectNode(nodeId) {
    if (this.selectedNodes.has(nodeId)) {
      this.selectedNodes.delete(nodeId);
      const el = this.nodeElements.get(nodeId);
      if (el) {
        el.removeClass("rabbitmap-node-selected");
      }
    }
  }
  clearSelection() {
    for (const nodeId of this.selectedNodes) {
      const el = this.nodeElements.get(nodeId);
      if (el) {
        el.removeClass("rabbitmap-node-selected");
      }
    }
    this.selectedNodes.clear();
  }
  deleteSelectedNodes() {
    for (const nodeId of this.selectedNodes) {
      this.nodes.delete(nodeId);
      this.chatMessages.delete(nodeId);
      this.chatStates.delete(nodeId);
      const el = this.nodeElements.get(nodeId);
      if (el) {
        el.remove();
        this.nodeElements.delete(nodeId);
      }
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
  isInputFocused() {
    const active = document.activeElement;
    return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active == null ? void 0 : active.isContentEditable);
  }
  zoom(delta) {
    const factor = Math.exp(delta);
    const newScale = Math.min(Math.max(this.scale * factor, 0.1), 2);
    this.scale = newScale;
    this.updateTransform();
    this.triggerSave();
  }
  zoomAtPoint(delta, clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    const oldScale = this.scale;
    const factor = Math.exp(delta);
    const newScale = Math.min(Math.max(this.scale * factor, 0.1), 2);
    if (newScale !== oldScale) {
      this.panX = mouseX - (mouseX - this.panX) * newScale / oldScale;
      this.panY = mouseY - (mouseY - this.panY) * newScale / oldScale;
      this.scale = newScale;
      this.updateTransform();
      this.triggerSave();
    }
  }
  resetView() {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.updateTransform();
    this.triggerSave();
  }
  getContentBounds() {
    if (this.nodes.size === 0)
      return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of this.nodes.values()) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }
    return { minX, minY, maxX, maxY };
  }
  clampPan(panX, panY) {
    const bounds = this.getContentBounds();
    if (!bounds)
      return { x: panX, y: panY };
    const rect = this.canvas.getBoundingClientRect();
    const viewWidth = rect.width;
    const viewHeight = rect.height;
    const minContentSize = 2e3;
    const effectiveWidth = Math.max(bounds.maxX - bounds.minX, minContentSize);
    const effectiveHeight = Math.max(bounds.maxY - bounds.minY, minContentSize);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const effectiveBounds = {
      minX: centerX - effectiveWidth / 2,
      maxX: centerX + effectiveWidth / 2,
      minY: centerY - effectiveHeight / 2,
      maxY: centerY + effectiveHeight / 2
    };
    const keepVisible = 0.2;
    const contentWidth = (effectiveBounds.maxX - effectiveBounds.minX) * this.scale;
    const contentHeight = (effectiveBounds.maxY - effectiveBounds.minY) * this.scale;
    const minVisibleX = Math.min(contentWidth * keepVisible, 100);
    const minVisibleY = Math.min(contentHeight * keepVisible, 100);
    const contentLeft = effectiveBounds.minX * this.scale;
    const contentRight = effectiveBounds.maxX * this.scale;
    const contentTop = effectiveBounds.minY * this.scale;
    const contentBottom = effectiveBounds.maxY * this.scale;
    const minPanX = minVisibleX - contentRight;
    const maxPanX = viewWidth - minVisibleX - contentLeft;
    const minPanY = minVisibleY - contentBottom;
    const maxPanY = viewHeight - minVisibleY - contentTop;
    return {
      x: Math.min(Math.max(panX, minPanX), maxPanX),
      y: Math.min(Math.max(panY, minPanY), maxPanY)
    };
  }
  zoomToNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node)
      return;
    const rect = this.canvas.getBoundingClientRect();
    const viewWidth = rect.width;
    const viewHeight = rect.height;
    const padding = 100;
    const scaleX = viewWidth / (node.width + padding * 2);
    const scaleY = viewHeight / (node.height + padding * 2);
    const targetScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.1), 2);
    const nodeCenterX = node.x + node.width / 2;
    const nodeCenterY = node.y + node.height / 2;
    const targetPanX = viewWidth / 2 - nodeCenterX * targetScale;
    const targetPanY = viewHeight / 2 - nodeCenterY * targetScale;
    this.animateTo(targetScale, targetPanX, targetPanY);
  }
  showChatContextMenu(nodeId, e) {
    const menu = new import_obsidian.Menu();
    menu.addItem((item) => {
      item.setTitle("Branch").setIcon("git-branch").onClick(() => {
        this.branchChat(nodeId);
      });
    });
    menu.addItem((item) => {
      item.setTitle("Fork").setIcon("git-fork").onClick(() => {
        this.forkChat(nodeId);
      });
    });
    menu.showAtMouseEvent(e);
  }
  branchChat(nodeId, upToMsgIndex) {
    const sourceNode = this.nodes.get(nodeId);
    const sourceState = this.chatStates.get(nodeId);
    const sourceMessages = this.chatMessages.get(nodeId);
    if (!sourceNode || !sourceState)
      return;
    const pos = this.findFreePosition(sourceNode);
    const baseTitle = sourceNode.title || "Chat";
    const newNode = {
      id: this.generateId(),
      x: pos.x,
      y: pos.y,
      width: sourceNode.width,
      height: sourceNode.height,
      type: "chat",
      content: "",
      title: `${baseTitle} (branch)`
    };
    const newState = {
      provider: sourceState.provider,
      model: sourceState.model,
      contextFiles: [...sourceState.contextFiles],
      systemPrompt: sourceState.systemPrompt,
      contextTemplate: sourceState.contextTemplate
    };
    let newMessages = [];
    if (sourceMessages) {
      if (upToMsgIndex !== void 0) {
        newMessages = sourceMessages.slice(0, upToMsgIndex + 1);
      } else {
        newMessages = [...sourceMessages];
      }
    }
    this.nodes.set(newNode.id, newNode);
    this.chatStates.set(newNode.id, newState);
    this.chatMessages.set(newNode.id, newMessages);
    this.renderNode(newNode);
    this.addEdge(nodeId, newNode.id);
    this.updateMinimap();
    this.triggerSave();
    this.zoomToNode(newNode.id);
    this.scrollChatToBottom(newNode.id);
    this.focusChatInput(newNode.id);
  }
  scrollChatToBottom(nodeId) {
    const nodeEl = this.nodeElements.get(nodeId);
    if (!nodeEl)
      return;
    const messagesContainer = nodeEl.querySelector(".rabbitmap-chat-messages");
    if (messagesContainer) {
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 50);
    }
  }
  focusChatInput(nodeId) {
    const nodeEl = this.nodeElements.get(nodeId);
    if (!nodeEl)
      return;
    setTimeout(() => {
      const input = nodeEl.querySelector(".rabbitmap-chat-input");
      if (input) {
        input.focus();
      }
    }, 350);
  }
  // Public methods for ExpandedChatModal
  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }
  getChatState(nodeId) {
    return this.chatStates.get(nodeId);
  }
  getChatMessages(nodeId) {
    return this.chatMessages.get(nodeId);
  }
  openExpandedChat(nodeId) {
    new ExpandedChatModal(this.app, this, nodeId).open();
  }
  async sendChatMessage(nodeId, text) {
    const chatState = this.chatStates.get(nodeId);
    if (!chatState)
      return;
    const msg = {
      role: "user",
      content: text,
      contextFiles: chatState.contextFiles ? [...chatState.contextFiles] : []
    };
    const messages = this.chatMessages.get(nodeId) || [];
    messages.push(msg);
    this.chatMessages.set(nodeId, messages);
    this.refreshChatNode(nodeId);
    this.triggerSave();
    const provider = this.plugin.settings.providers.find((p) => p.name === chatState.provider);
    if (!provider)
      return;
    let apiKey = provider.apiKey || "";
    if (!apiKey) {
      if (chatState.provider === "OpenAI" && this.plugin.settings.openaiApiKey) {
        apiKey = this.plugin.settings.openaiApiKey;
      } else if (chatState.provider === "OpenRouter" && this.plugin.settings.openrouterApiKey) {
        apiKey = this.plugin.settings.openrouterApiKey;
      }
    }
    if (!apiKey) {
      const errorMsg = {
        role: "assistant",
        content: `Please set your ${chatState.provider} API key in settings.`
      };
      messages.push(errorMsg);
      this.refreshChatNode(nodeId);
      this.triggerSave();
      return;
    }
    let contextContent = "";
    if (chatState.contextFiles && chatState.contextFiles.length > 0) {
      const template = chatState.contextTemplate || DEFAULT_CONTEXT_TEMPLATE;
      const contextParts = [];
      for (const filePath of chatState.contextFiles) {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file && file instanceof import_obsidian.TFile) {
          try {
            const content = await this.app.vault.read(file);
            const formatted = template.replace(/\{filepath\}/g, filePath).replace(/\{filename\}/g, file.name).replace(/\{content\}/g, content);
            contextParts.push(formatted);
          } catch (e) {
          }
        }
      }
      if (contextParts.length > 0) {
        contextContent = "Context files:\n\n" + contextParts.join("\n\n");
      }
    }
    try {
      const response = await this.callLLM(provider, apiKey, chatState.model, messages, contextContent, chatState.systemPrompt || "");
      const assistantMsg = {
        role: "assistant",
        content: response
      };
      messages.push(assistantMsg);
      this.refreshChatNode(nodeId);
      this.triggerSave();
    } catch (error) {
      const errorMsg = {
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      };
      messages.push(errorMsg);
      this.refreshChatNode(nodeId);
      this.triggerSave();
    }
  }
  refreshChatNode(nodeId) {
    const nodeEl = this.nodeElements.get(nodeId);
    if (!nodeEl)
      return;
    const messagesContainer = nodeEl.querySelector(".rabbitmap-chat-messages");
    if (!messagesContainer)
      return;
    messagesContainer.empty();
    const messages = this.chatMessages.get(nodeId) || [];
    messages.forEach((msg, index) => {
      this.renderChatMessage(messagesContainer, msg, nodeId, index);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  async exportChatToMd(node) {
    var _a, _b;
    const messages = this.chatMessages.get(node.id) || [];
    if (messages.length === 0) {
      new import_obsidian.Notice("No messages to export");
      return;
    }
    const chatState = this.chatStates.get(node.id);
    const title = node.title || "Chat";
    let md = `# ${title}

`;
    if (chatState) {
      md += `> **Model:** ${chatState.provider} / ${chatState.model}

`;
    }
    md += `---

`;
    for (const msg of messages) {
      if (msg.role === "user") {
        md += `## User

`;
        if (msg.contextFiles && msg.contextFiles.length > 0) {
          md += `> **Context:** `;
          md += msg.contextFiles.map((f) => `[[${f}]]`).join(", ");
          md += `

`;
        }
        md += `${msg.content}

`;
      } else {
        md += `## Assistant

${msg.content}

`;
      }
    }
    const folder = ((_b = (_a = this.file) == null ? void 0 : _a.parent) == null ? void 0 : _b.path) || "";
    const now = /* @__PURE__ */ new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const hours = now.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12;
    const timestamp = `${now.getFullYear()} ${months[now.getMonth()]} ${now.getDate()} ${hours12}-${String(now.getMinutes()).padStart(2, "0")} ${ampm}`;
    const fileName = `${title.replace(/[\\/:*?"<>|]/g, "-")} ${timestamp}`;
    const filePath = folder ? `${folder}/${fileName}.md` : `${fileName}.md`;
    const file = await this.app.vault.create(filePath, md);
    new import_obsidian.Notice(`Saved to ${filePath}`);
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
  }
  showTitleEditor(node, titleSpan, container) {
    const currentTitle = node.title || (node.type === "chat" ? "Chat" : "Card");
    titleSpan.style.display = "none";
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
  forkChat(nodeId) {
    const sourceNode = this.nodes.get(nodeId);
    const sourceState = this.chatStates.get(nodeId);
    if (!sourceNode || !sourceState)
      return;
    const pos = this.findFreePosition(sourceNode);
    const baseTitle = sourceNode.title || "Chat";
    const newNode = {
      id: this.generateId(),
      x: pos.x,
      y: pos.y,
      width: sourceNode.width,
      height: sourceNode.height,
      type: "chat",
      content: "",
      title: `${baseTitle} (fork)`
    };
    const newState = {
      provider: sourceState.provider,
      model: sourceState.model,
      contextFiles: [...sourceState.contextFiles],
      systemPrompt: sourceState.systemPrompt,
      contextTemplate: sourceState.contextTemplate
    };
    this.nodes.set(newNode.id, newNode);
    this.chatStates.set(newNode.id, newState);
    this.chatMessages.set(newNode.id, []);
    this.renderNode(newNode);
    this.addEdge(nodeId, newNode.id);
    this.updateMinimap();
    this.triggerSave();
    this.zoomToNode(newNode.id);
    this.focusChatInput(newNode.id);
  }
  findFreePosition(sourceNode) {
    const gap = 50;
    const rightX = sourceNode.x + sourceNode.width + gap;
    const rightY = sourceNode.y;
    if (!this.isPositionOccupied(rightX, rightY, sourceNode.width, sourceNode.height)) {
      return { x: rightX, y: rightY };
    }
    const blockingNode = this.findBlockingNode(rightX, rightY, sourceNode.width, sourceNode.height);
    if (blockingNode) {
      const belowBlockingY = blockingNode.y + blockingNode.height + gap;
      if (!this.isPositionOccupied(rightX, belowBlockingY, sourceNode.width, sourceNode.height)) {
        return { x: rightX, y: belowBlockingY };
      }
    }
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
    return { x: sourceNode.x + 60, y: sourceNode.y + 60 };
  }
  findBlockingNode(x, y, width, height) {
    const padding = 20;
    for (const node of this.nodes.values()) {
      const overlaps = x < node.x + node.width + padding && x + width + padding > node.x && y < node.y + node.height + padding && y + height + padding > node.y;
      if (overlaps)
        return node;
    }
    return null;
  }
  isPositionOccupied(x, y, width, height) {
    const padding = 20;
    for (const node of this.nodes.values()) {
      const overlaps = x < node.x + node.width + padding && x + width + padding > node.x && y < node.y + node.height + padding && y + height + padding > node.y;
      if (overlaps)
        return true;
    }
    return false;
  }
  addEdge(fromId, toId) {
    const edge = {
      id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from: fromId,
      to: toId
    };
    this.edges.set(edge.id, edge);
    this.renderEdge(edge);
  }
  renderAllEdges() {
    this.edgesContainer.innerHTML = "";
    for (const edge of this.edges.values()) {
      this.renderEdge(edge);
    }
  }
  renderEdge(edge) {
    const fromNode = this.nodes.get(edge.from);
    const toNode = this.nodes.get(edge.to);
    if (!fromNode || !toNode)
      return;
    const fromCenterX = fromNode.x + fromNode.width / 2;
    const fromCenterY = fromNode.y + fromNode.height / 2;
    const toCenterX = toNode.x + toNode.width / 2;
    const toCenterY = toNode.y + toNode.height / 2;
    let fromX, fromY, toX, toY;
    const dx = toCenterX - fromCenterX;
    const dy = toCenterY - fromCenterY;
    const arrowSize = 14;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        fromX = fromNode.x + fromNode.width;
        fromY = fromCenterY;
        toX = toNode.x;
        toY = toCenterY;
      } else {
        fromX = fromNode.x;
        fromY = fromCenterY;
        toX = toNode.x + toNode.width;
        toY = toCenterY;
      }
    } else {
      if (dy > 0) {
        fromX = fromCenterX;
        fromY = fromNode.y + fromNode.height;
        toX = toCenterX;
        toY = toNode.y;
      } else {
        fromX = fromCenterX;
        fromY = fromNode.y;
        toX = toCenterX;
        toY = toNode.y + toNode.height;
      }
    }
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("id", edge.id);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "rabbitmap-edge");
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    let cx1, cy1, cx2, cy2;
    if (Math.abs(dx) > Math.abs(dy)) {
      cx1 = midX;
      cy1 = fromY;
      cx2 = midX;
      cy2 = toY;
    } else {
      cx1 = fromX;
      cy1 = midY;
      cx2 = toX;
      cy2 = midY;
    }
    const d = `M ${fromX} ${fromY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${toX} ${toY}`;
    path.setAttribute("d", d);
    const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hitArea.setAttribute("d", d);
    hitArea.setAttribute("class", "rabbitmap-edge-hitarea");
    hitArea.setAttribute("data-edge-id", edge.id);
    group.appendChild(hitArea);
    group.appendChild(path);
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
      this.showEdgeContextMenu(edge.id, e);
    });
    const tangentX = toX - cx2;
    const tangentY = toY - cy2;
    const len = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
    const normX = tangentX / len;
    const normY = tangentY / len;
    const arrowTipX = toX;
    const arrowTipY = toY;
    const arrowBaseX = toX - normX * arrowSize;
    const arrowBaseY = toY - normY * arrowSize;
    const perpX = -normY * (arrowSize / 2);
    const perpY = normX * (arrowSize / 2);
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    const points = `${arrowTipX},${arrowTipY} ${arrowBaseX + perpX},${arrowBaseY + perpY} ${arrowBaseX - perpX},${arrowBaseY - perpY}`;
    arrow.setAttribute("points", points);
    arrow.setAttribute("class", "rabbitmap-arrow");
    group.appendChild(arrow);
    this.edgesContainer.appendChild(group);
  }
  updateEdges() {
    this.renderAllEdges();
  }
  getHandlePosition(node, side) {
    switch (side) {
      case "top":
        return { x: node.x + node.width / 2, y: node.y };
      case "right":
        return { x: node.x + node.width, y: node.y + node.height / 2 };
      case "bottom":
        return { x: node.x + node.width / 2, y: node.y + node.height };
      case "left":
        return { x: node.x, y: node.y + node.height / 2 };
    }
  }
  startEdgeDrawing(nodeId, side, e) {
    this.isDrawingEdge = true;
    this.edgeDrawFromNode = nodeId;
    this.edgeDrawFromSide = side;
    this.canvas.addClass("drawing-edge");
    const node = this.nodes.get(nodeId);
    if (!node)
      return;
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
  findTargetHandle(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el) {
      const handle = el.closest(".rabbitmap-connection-handle");
      if (handle) {
        const nodeId = handle.getAttribute("data-node-id");
        const side = handle.getAttribute("data-side");
        if (nodeId && side)
          return { nodeId, side };
      }
    }
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left - this.panX) / this.scale;
    const canvasY = (e.clientY - rect.top - this.panY) / this.scale;
    const threshold = 30;
    let best = null;
    const sides = ["top", "right", "bottom", "left"];
    for (const node of this.nodes.values()) {
      if (node.id === this.edgeDrawFromNode)
        continue;
      for (const side of sides) {
        const pos = this.getHandlePosition(node, side);
        const dist = Math.sqrt((canvasX - pos.x) ** 2 + (canvasY - pos.y) ** 2);
        if (dist < threshold && (!best || dist < best.dist)) {
          best = { nodeId: node.id, side, dist };
        }
      }
    }
    if (best)
      return { nodeId: best.nodeId, side: best.side };
    for (const node of this.nodes.values()) {
      if (node.id === this.edgeDrawFromNode)
        continue;
      if (canvasX >= node.x && canvasX <= node.x + node.width && canvasY >= node.y && canvasY <= node.y + node.height) {
        const distances = sides.map((side) => {
          const pos = this.getHandlePosition(node, side);
          return { side, dist: Math.sqrt((canvasX - pos.x) ** 2 + (canvasY - pos.y) ** 2) };
        });
        distances.sort((a, b) => a.dist - b.dist);
        return { nodeId: node.id, side: distances[0].side };
      }
    }
    return null;
  }
  showEdgeContextMenu(edgeId, e) {
    const menu = new import_obsidian.Menu();
    menu.addItem((item) => {
      item.setTitle("Delete connection").setIcon("trash-2").onClick(() => {
        this.deleteEdge(edgeId);
      });
    });
    menu.showAtMouseEvent(e);
  }
  deleteEdge(edgeId) {
    this.edges.delete(edgeId);
    this.renderAllEdges();
    this.triggerSave();
  }
  animateTo(targetScale, targetPanX, targetPanY) {
    const startScale = this.scale;
    const startPanX = this.panX;
    const startPanY = this.panY;
    const duration = 300;
    const startTime = performance.now();
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
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
  updateTransform() {
    if (this.nodesContainer) {
      this.nodesContainer.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    }
    if (this.edgesContainer) {
      this.edgesContainer.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    }
    if (this.canvas) {
      const gridSize = 20 * this.scale;
      this.canvas.style.backgroundSize = `${gridSize}px ${gridSize}px`;
      this.canvas.style.backgroundPosition = `${this.panX}px ${this.panY}px`;
    }
    this.updateMinimap();
  }
  generateId() {
    return "node-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
  }
  addNode(node, save = true) {
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
  renderNode(node) {
    if (!this.nodesContainer)
      return;
    const el = this.nodesContainer.createDiv({
      cls: `rabbitmap-node rabbitmap-node-${node.type}`
    });
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.width = `${node.width}px`;
    el.style.height = `${node.height}px`;
    const header = el.createDiv({ cls: "rabbitmap-node-header" });
    const titleContainer = header.createDiv({ cls: "rabbitmap-node-title-container" });
    const defaultTitle = node.type === "chat" ? "Chat" : node.type === "link" ? node.linkTitle || "Link" : node.type === "note" ? node.title || "Note" : "Card";
    const titleSpan = titleContainer.createSpan({
      text: node.title || defaultTitle,
      cls: "rabbitmap-node-title"
    });
    const editTitleBtn = titleContainer.createEl("button", { cls: "rabbitmap-edit-title-btn" });
    editTitleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
    editTitleBtn.onclick = (e) => {
      e.stopPropagation();
      this.showTitleEditor(node, titleSpan, titleContainer);
    };
    if (node.type === "chat") {
      const exportBtn = titleContainer.createEl("button", { cls: "rabbitmap-export-btn" });
      exportBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
      exportBtn.title = "Save as MD";
      exportBtn.onclick = (e) => {
        e.stopPropagation();
        this.exportChatToMd(node);
      };
      const expandBtn = titleContainer.createEl("button", { cls: "rabbitmap-expand-btn" });
      expandBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
      expandBtn.title = "Expand chat";
      expandBtn.onclick = (e) => {
        e.stopPropagation();
        this.openExpandedChat(node.id);
      };
    }
    const deleteBtn = header.createEl("button", { text: "\xD7", cls: "rabbitmap-delete-btn" });
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      this.deleteNode(node.id);
    };
    header.addEventListener("mousedown", (e) => {
      if (e.button === 0 && !this.spacePressed) {
        e.stopPropagation();
        if (e.shiftKey) {
          if (this.selectedNodes.has(node.id)) {
            this.deselectNode(node.id);
          } else {
            this.selectNode(node.id);
          }
        } else if (!this.selectedNodes.has(node.id)) {
          this.clearSelection();
          this.selectNode(node.id);
        }
        this.draggedNode = node.id;
        const rect = el.getBoundingClientRect();
        this.dragOffsetX = (e.clientX - rect.left) / this.scale;
        this.dragOffsetY = (e.clientY - rect.top) / this.scale;
        const canvasRect = this.canvas.getBoundingClientRect();
        this.dragStartMouseX = (e.clientX - canvasRect.left - this.panX) / this.scale;
        this.dragStartMouseY = (e.clientY - canvasRect.top - this.panY) / this.scale;
        this.dragStartPositions.clear();
        for (const nodeId of this.selectedNodes) {
          const n = this.nodes.get(nodeId);
          if (n) {
            this.dragStartPositions.set(nodeId, { x: n.x, y: n.y });
          }
        }
      }
    });
    header.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      this.zoomToNode(node.id);
    });
    if (node.type === "chat") {
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showChatContextMenu(node.id, e);
      });
    }
    if (node.type === "link") {
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showLinkContextMenu(node.id, e);
      });
    }
    if (node.type === "note") {
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showNoteContextMenu(node.id, e);
      });
    }
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
        this.startEdgeDrawing(node.id, side, e);
      });
    }
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
  renderLinkContent(node, container) {
    container.addClass("rabbitmap-link-content");
    if (node.linkImage) {
      const imgWrap = container.createDiv({ cls: "rabbitmap-link-thumbnail" });
      const img = imgWrap.createEl("img", { attr: { src: node.linkImage, alt: node.linkTitle || "" } });
      img.addEventListener("error", () => {
        imgWrap.remove();
      });
    }
    const info = container.createDiv({ cls: "rabbitmap-link-info" });
    const title = info.createDiv({
      cls: "rabbitmap-link-title",
      text: node.linkTitle || "Loading..."
    });
    if (node.url) {
      let displayUrl = node.url;
      try {
        const parsed = new URL(node.url);
        displayUrl = parsed.hostname + (parsed.pathname !== "/" ? parsed.pathname : "");
      } catch (e) {
      }
      info.createDiv({
        cls: "rabbitmap-link-url",
        text: displayUrl
      });
    }
    if (node.linkDescription) {
      info.createDiv({
        cls: "rabbitmap-link-description",
        text: node.linkDescription
      });
    }
    if (node.linkTitle === "Loading...") {
      const spinner = info.createDiv({ cls: "rabbitmap-link-loading" });
      spinner.createSpan({ text: "Fetching content..." });
    }
    const openBtn = container.createEl("button", {
      cls: "rabbitmap-link-open-btn",
      text: "Open Link"
    });
    openBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (node.url) {
        window.open(node.url, "_blank");
      }
    });
    container.addEventListener("wheel", (e) => {
      e.stopPropagation();
    });
  }
  showLinkContextMenu(nodeId, e) {
    const node = this.nodes.get(nodeId);
    if (!node)
      return;
    const menu = new import_obsidian.Menu();
    menu.addItem((item) => {
      item.setTitle("Open URL").setIcon("external-link").onClick(() => {
        if (node.url)
          window.open(node.url, "_blank");
      });
    });
    menu.addItem((item) => {
      item.setTitle("Refresh metadata").setIcon("refresh-cw").onClick(() => {
        if (node.url) {
          node.linkTitle = "Loading...";
          node.linkDescription = "";
          node.linkImage = void 0;
          node.linkContent = void 0;
          this.rerenderNode(nodeId);
          this.fetchLinkMetadata(node.url, nodeId);
        }
      });
    });
    menu.addItem((item) => {
      item.setTitle("Copy URL").setIcon("copy").onClick(() => {
        if (node.url) {
          navigator.clipboard.writeText(node.url);
          new import_obsidian.Notice("URL copied to clipboard");
        }
      });
    });
    menu.showAtMouseEvent(e);
  }
  showNoteContextMenu(nodeId, e) {
    const node = this.nodes.get(nodeId);
    if (!node)
      return;
    const menu = new import_obsidian.Menu();
    if (node.filePath) {
      menu.addItem((item) => {
        item.setTitle("Open in Obsidian").setIcon("file-text").onClick(() => {
          this.app.workspace.openLinkText(node.filePath, "", false);
        });
      });
      menu.addItem((item) => {
        item.setTitle("Refresh from file").setIcon("refresh-cw").onClick(async () => {
          const file = this.app.vault.getAbstractFileByPath(node.filePath);
          if (file instanceof import_obsidian.TFile) {
            const content = await this.app.vault.read(file);
            node.content = content;
            this.rerenderNode(nodeId);
            this.triggerSave();
            new import_obsidian.Notice("Note refreshed from file");
          } else {
            new import_obsidian.Notice("Source file not found");
          }
        });
      });
    }
    menu.addItem((item) => {
      item.setTitle("Copy content").setIcon("copy").onClick(() => {
        navigator.clipboard.writeText(node.content);
        new import_obsidian.Notice("Content copied to clipboard");
      });
    });
    menu.showAtMouseEvent(e);
  }
  renderCardContent(node, container) {
    const textarea = container.createEl("textarea", {
      cls: "rabbitmap-card-textarea",
      attr: { placeholder: "Write something..." }
    });
    textarea.value = node.content;
    textarea.addEventListener("input", () => {
      node.content = textarea.value;
      this.triggerSave();
    });
    textarea.addEventListener("wheel", (e) => {
      e.stopPropagation();
    });
  }
  renderNoteContent(node, container) {
    container.addClass("rabbitmap-note-content");
    const markdownContainer = container.createDiv({ cls: "rabbitmap-note-markdown" });
    import_obsidian.MarkdownRenderer.render(
      this.app,
      node.content,
      markdownContainer,
      node.filePath || "",
      new import_obsidian.Component()
    );
    if (node.filePath) {
      const openBtn = container.createEl("button", {
        cls: "rabbitmap-note-open-btn",
        text: "Open in Obsidian"
      });
      openBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.app.workspace.openLinkText(node.filePath, "", false);
      });
    }
    container.addEventListener("wheel", (e) => {
      e.stopPropagation();
    });
  }
  renderChatContent(nodeId, container) {
    const selectorBar = container.createDiv({ cls: "rabbitmap-chat-selector-bar" });
    selectorBar.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      if (!this.selectedNodes.has(nodeId)) {
        this.clearSelection();
        this.selectNode(nodeId);
      }
    });
    let state = this.chatStates.get(nodeId);
    if (!state) {
      const defaultProvider = this.plugin.settings.providers[0];
      state = {
        provider: defaultProvider.name,
        model: defaultProvider.models[0],
        contextFiles: [],
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        contextTemplate: DEFAULT_CONTEXT_TEMPLATE
      };
      this.chatStates.set(nodeId, state);
    }
    if (!state.contextFiles) {
      state.contextFiles = [];
    }
    if (!state.systemPrompt) {
      state.systemPrompt = DEFAULT_SYSTEM_PROMPT;
    }
    if (!state.contextTemplate) {
      state.contextTemplate = DEFAULT_CONTEXT_TEMPLATE;
    }
    const providerSelect = selectorBar.createEl("select", { cls: "rabbitmap-select" });
    for (const provider of this.plugin.settings.providers) {
      const option = providerSelect.createEl("option", {
        text: provider.name,
        value: provider.name
      });
      if (provider.name === state.provider) {
        option.selected = true;
      }
    }
    const modelSelect = selectorBar.createEl("select", { cls: "rabbitmap-select rabbitmap-model-select" });
    const editPromptBtn = selectorBar.createEl("button", {
      text: "Prompt",
      cls: "rabbitmap-btn rabbitmap-edit-prompt-btn"
    });
    editPromptBtn.onclick = (e) => {
      e.stopPropagation();
      const currentState = this.chatStates.get(nodeId);
      new PromptEditorModal(
        this.app,
        (currentState == null ? void 0 : currentState.systemPrompt) || "",
        (currentState == null ? void 0 : currentState.contextTemplate) || DEFAULT_CONTEXT_TEMPLATE,
        (newPrompt, newTemplate) => {
          const state2 = this.chatStates.get(nodeId);
          if (state2) {
            state2.systemPrompt = newPrompt;
            state2.contextTemplate = newTemplate;
            this.chatStates.set(nodeId, state2);
            this.triggerSave();
          }
        }
      ).open();
    };
    const updateModelOptions = () => {
      const currentState = this.chatStates.get(nodeId);
      const provider = this.plugin.settings.providers.find((p) => p.name === currentState.provider);
      if (!provider)
        return;
      let models = provider.models;
      if (provider.name === "OpenRouter" && this.plugin.settings.customOpenRouterModels.trim()) {
        models = this.plugin.settings.customOpenRouterModels.split("\n").map((m) => m.trim()).filter((m) => m.length > 0);
      }
      modelSelect.empty();
      for (const model of models) {
        const option = modelSelect.createEl("option", {
          text: model,
          value: model
        });
        if (model === currentState.model) {
          option.selected = true;
        }
      }
    };
    updateModelOptions();
    providerSelect.onchange = () => {
      const newProvider = providerSelect.value;
      const provider = this.plugin.settings.providers.find((p) => p.name === newProvider);
      if (provider) {
        let models = provider.models;
        if (provider.name === "OpenRouter" && this.plugin.settings.customOpenRouterModels.trim()) {
          models = this.plugin.settings.customOpenRouterModels.split("\n").map((m) => m.trim()).filter((m) => m.length > 0);
        }
        const currentState = this.chatStates.get(nodeId);
        const newState = {
          provider: newProvider,
          model: models[0],
          contextFiles: (currentState == null ? void 0 : currentState.contextFiles) || [],
          systemPrompt: (currentState == null ? void 0 : currentState.systemPrompt) || DEFAULT_SYSTEM_PROMPT,
          contextTemplate: (currentState == null ? void 0 : currentState.contextTemplate) || DEFAULT_CONTEXT_TEMPLATE
        };
        this.chatStates.set(nodeId, newState);
        updateModelOptions();
        this.triggerSave();
      }
    };
    modelSelect.onchange = () => {
      const currentState = this.chatStates.get(nodeId);
      currentState.model = modelSelect.value;
      this.chatStates.set(nodeId, currentState);
      this.triggerSave();
    };
    const contextSection = container.createDiv({ cls: "rabbitmap-chat-context" });
    const contextHeader = contextSection.createDiv({ cls: "rabbitmap-chat-context-header" });
    contextHeader.createSpan({ text: "Context", cls: "rabbitmap-chat-context-title" });
    const contextList = contextSection.createDiv({ cls: "rabbitmap-chat-context-list" });
    const renderContextFiles = () => {
      contextList.empty();
      const currentState = this.chatStates.get(nodeId);
      if (!currentState || currentState.contextFiles.length === 0) {
        const placeholder = contextList.createDiv({ cls: "rabbitmap-chat-context-placeholder" });
        placeholder.setText("Drag your md/folders here");
        return;
      }
      for (const filePath of currentState.contextFiles) {
        const fileItem = contextList.createDiv({ cls: "rabbitmap-chat-context-item" });
        const fileName = filePath.split("/").pop() || filePath;
        fileItem.createSpan({ text: fileName, cls: "rabbitmap-chat-context-filename" });
        const removeBtn = fileItem.createEl("button", { text: "\xD7", cls: "rabbitmap-chat-context-remove" });
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          const state2 = this.chatStates.get(nodeId);
          if (state2) {
            state2.contextFiles = state2.contextFiles.filter((f) => f !== filePath);
            this.chatStates.set(nodeId, state2);
            renderContextFiles();
            this.triggerSave();
          }
        };
      }
    };
    renderContextFiles();
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
      const plainText = ((_a = e.dataTransfer) == null ? void 0 : _a.getData("text/plain")) || "";
      const parsePath = (input2) => {
        input2 = input2.trim();
        if (input2.startsWith("obsidian://")) {
          try {
            const url = new URL(input2);
            const filePath = url.searchParams.get("file");
            if (filePath) {
              return decodeURIComponent(filePath);
            }
          } catch (e2) {
          }
        }
        try {
          input2 = decodeURIComponent(input2);
        } catch (e2) {
        }
        const wikiMatch = input2.match(/^\[\[(.+?)\]\]$/);
        if (wikiMatch) {
          return wikiMatch[1];
        }
        const mdMatch = input2.match(/^\[.+?\]\((.+?)\)$/);
        if (mdMatch) {
          return mdMatch[1];
        }
        if (input2.startsWith("/")) {
          input2 = input2.slice(1);
        }
        return input2;
      };
      const addFilesFromFolder = (folder, state2) => {
        for (const child of folder.children) {
          if (child instanceof import_obsidian.TFile) {
            if (!state2.contextFiles.includes(child.path)) {
              state2.contextFiles.push(child.path);
            }
          } else if (child instanceof import_obsidian.TFolder) {
            addFilesFromFolder(child, state2);
          }
        }
      };
      const getAllFolders = (folder) => {
        const folders = [folder];
        for (const child of folder.children) {
          if (child instanceof import_obsidian.TFolder) {
            folders.push(...getAllFolders(child));
          }
        }
        return folders;
      };
      const tryAddPath = (input2) => {
        if (!input2)
          return false;
        let path = parsePath(input2);
        if (!path)
          return false;
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
          if (item)
            path = path + ".md";
        }
        if (!item && !path.includes(".")) {
          const rootFolder = this.app.vault.getRoot();
          const allFolders = getAllFolders(rootFolder);
          const folderName = path.split("/").pop() || path;
          item = allFolders.find(
            (f) => f.path === path || f.name === folderName || f.path.endsWith("/" + path)
          ) || null;
        }
        if (!item) {
          const allFiles = this.app.vault.getFiles();
          const fileName = path.split("/").pop() || path;
          item = allFiles.find(
            (f) => f.path === path || f.name === fileName || f.basename === fileName || f.path.endsWith("/" + path)
          ) || null;
          if (item)
            path = item.path;
        }
        const state2 = this.chatStates.get(nodeId);
        if (!state2)
          return false;
        if (item instanceof import_obsidian.TFolder) {
          addFilesFromFolder(item, state2);
          return true;
        }
        if (item instanceof import_obsidian.TFile) {
          if (!state2.contextFiles.includes(path)) {
            state2.contextFiles.push(path);
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
        const state2 = this.chatStates.get(nodeId);
        if (state2) {
          this.chatStates.set(nodeId, state2);
          renderContextFiles();
          this.triggerSave();
        }
      }
    });
    const messagesContainer = container.createDiv({ cls: "rabbitmap-chat-messages" });
    messagesContainer.addEventListener("wheel", (e) => {
      if (this.selectedNodes.has(nodeId)) {
        e.stopPropagation();
      }
    });
    messagesContainer.addEventListener("mousedown", (e) => {
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
    const inputArea = container.createDiv({ cls: "rabbitmap-chat-input-area" });
    const input = inputArea.createEl("textarea", {
      cls: "rabbitmap-chat-input",
      attr: { placeholder: "Type a message..." }
    });
    input.addEventListener("focus", () => {
      if (!this.selectedNodes.has(nodeId)) {
        this.clearSelection();
        this.selectNode(nodeId);
      }
    });
    const sendBtn = inputArea.createEl("button", {
      text: "Send",
      cls: "rabbitmap-send-btn"
    });
    const sendMessage = async () => {
      const text = input.value.trim();
      if (!text)
        return;
      const chatState = this.chatStates.get(nodeId);
      const msg = {
        role: "user",
        content: text,
        contextFiles: chatState.contextFiles ? [...chatState.contextFiles] : []
      };
      const messages2 = this.chatMessages.get(nodeId) || [];
      messages2.push(msg);
      this.chatMessages.set(nodeId, messages2);
      this.renderChatMessage(messagesContainer, msg, nodeId, messages2.length - 1);
      input.value = "";
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      this.triggerSave();
      const provider = this.plugin.settings.providers.find((p) => p.name === chatState.provider);
      if (!provider)
        return;
      let apiKey = provider.apiKey || "";
      if (!apiKey) {
        if (chatState.provider === "OpenAI" && this.plugin.settings.openaiApiKey) {
          apiKey = this.plugin.settings.openaiApiKey;
        } else if (chatState.provider === "OpenRouter" && this.plugin.settings.openrouterApiKey) {
          apiKey = this.plugin.settings.openrouterApiKey;
        }
      }
      if (!apiKey) {
        const errorMsg = {
          role: "assistant",
          content: `Please set your ${chatState.provider} API key in settings.`
        };
        messages2.push(errorMsg);
        this.renderChatMessage(messagesContainer, errorMsg, nodeId, messages2.length - 1);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        this.triggerSave();
        return;
      }
      const loadingEl = messagesContainer.createDiv({
        cls: "rabbitmap-chat-message rabbitmap-chat-assistant rabbitmap-chat-loading"
      });
      loadingEl.createSpan({ text: "..." });
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      let contextContent = "";
      if (chatState.contextFiles && chatState.contextFiles.length > 0) {
        const template = chatState.contextTemplate || DEFAULT_CONTEXT_TEMPLATE;
        const contextParts = [];
        for (const filePath of chatState.contextFiles) {
          const file = this.app.vault.getAbstractFileByPath(filePath);
          if (file && file instanceof import_obsidian.TFile) {
            try {
              const content = await this.app.vault.read(file);
              const formatted = template.replace(/\{filepath\}/g, filePath).replace(/\{filename\}/g, file.name).replace(/\{content\}/g, content);
              contextParts.push(formatted);
            } catch (e) {
            }
          }
        }
        if (contextParts.length > 0) {
          contextContent = "Context files:\n\n" + contextParts.join("\n\n");
        }
      }
      try {
        const response = await this.callLLM(provider, apiKey, chatState.model, messages2, contextContent, chatState.systemPrompt || "");
        loadingEl.remove();
        const assistantMsg = {
          role: "assistant",
          content: response
        };
        messages2.push(assistantMsg);
        this.renderChatMessage(messagesContainer, assistantMsg, nodeId, messages2.length - 1);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        this.triggerSave();
      } catch (error) {
        loadingEl.remove();
        const errorMsg = {
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
        };
        messages2.push(errorMsg);
        this.renderChatMessage(messagesContainer, errorMsg, nodeId, messages2.length - 1);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        this.triggerSave();
      }
    };
    sendBtn.onclick = sendMessage;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  async callLLM(provider, apiKey, model, messages, context = "", systemPrompt = "") {
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
  async callOpenAIAPI(provider, apiKey, model, messages, context, systemPrompt) {
    var _a, _b;
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    };
    if (provider.name === "OpenRouter") {
      headers["HTTP-Referer"] = "https://obsidian.md";
      headers["X-Title"] = "RabbitMap";
    }
    const apiMessages = [];
    const systemParts = [];
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
    const baseUrl = provider.baseUrl.replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: apiMessages
      })
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }
    const data = await response.json();
    return ((_b = (_a = data.choices[0]) == null ? void 0 : _a.message) == null ? void 0 : _b.content) || "No response";
  }
  async callAnthropicAPI(provider, apiKey, model, messages, context, systemPrompt) {
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    };
    const systemParts = [];
    if (systemPrompt) {
      systemParts.push(systemPrompt);
    }
    if (context) {
      systemParts.push(context);
    }
    const apiMessages = [];
    for (const m of messages) {
      apiMessages.push({ role: m.role, content: m.content });
    }
    const requestBody = {
      model,
      max_tokens: 4096,
      messages: apiMessages
    };
    if (systemParts.length > 0) {
      requestBody.system = systemParts.join("\n\n");
    }
    const baseUrl = provider.baseUrl.replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }
    const data = await response.json();
    if (data.content && Array.isArray(data.content)) {
      return data.content.filter((block) => block.type === "text").map((block) => block.text).join("");
    }
    return "No response";
  }
  async callGoogleAPI(provider, apiKey, model, messages, context, systemPrompt) {
    var _a, _b;
    const systemParts = [];
    if (systemPrompt) {
      systemParts.push(systemPrompt);
    }
    if (context) {
      systemParts.push(context);
    }
    const contents = [];
    for (const m of messages) {
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      });
    }
    const requestBody = {
      contents
    };
    if (systemParts.length > 0) {
      requestBody.systemInstruction = {
        parts: [{ text: systemParts.join("\n\n") }]
      };
    }
    const baseUrl = provider.baseUrl.replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google API error: ${response.status} - ${error}`);
    }
    const data = await response.json();
    if (data.candidates && ((_b = (_a = data.candidates[0]) == null ? void 0 : _a.content) == null ? void 0 : _b.parts)) {
      const parts = data.candidates[0].content.parts;
      const resultParts = [];
      for (const part of parts) {
        if (part.text) {
          resultParts.push(part.text);
        } else if (part.inlineData) {
          const { mimeType, data: base64Data } = part.inlineData;
          const dataUrl = `data:${mimeType};base64,${base64Data}`;
          resultParts.push(`

![Generated Image](${dataUrl})

`);
        }
      }
      return resultParts.join("") || "No response";
    }
    return "No response";
  }
  renderChatMessage(container, msg, nodeId, msgIndex) {
    const msgEl = container.createDiv({
      cls: `rabbitmap-chat-message rabbitmap-chat-${msg.role}`
    });
    if (msg.role === "assistant") {
      const contentEl = msgEl.createDiv({ cls: "rabbitmap-message-content" });
      import_obsidian.MarkdownRenderer.render(
        this.app,
        msg.content,
        contentEl,
        "",
        new import_obsidian.Component()
      );
    } else {
      msgEl.createSpan({ text: msg.content });
    }
    msgEl.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showMessageContextMenu(nodeId, msgIndex, e);
    });
  }
  showMessageContextMenu(nodeId, msgIndex, e) {
    const menu = new import_obsidian.Menu();
    menu.addItem((item) => {
      item.setTitle("Branch from here").setIcon("git-branch").onClick(() => {
        this.branchChat(nodeId, msgIndex);
      });
    });
    menu.addItem((item) => {
      item.setTitle("Fork").setIcon("git-fork").onClick(() => {
        this.forkChat(nodeId);
      });
    });
    menu.addSeparator();
    menu.addItem((item) => {
      item.setTitle("Save this message").setIcon("file-text").onClick(() => {
        this.exportMessageToMd(nodeId, msgIndex, false);
      });
    });
    menu.addItem((item) => {
      item.setTitle("Save chat up to here").setIcon("files").onClick(() => {
        this.exportMessageToMd(nodeId, msgIndex, true);
      });
    });
    menu.showAtMouseEvent(e);
  }
  async exportMessageToMd(nodeId, msgIndex, includeHistory) {
    var _a, _b;
    const messages = this.chatMessages.get(nodeId) || [];
    const node = this.nodes.get(nodeId);
    const chatState = this.chatStates.get(nodeId);
    if (!node || msgIndex >= messages.length)
      return;
    const title = node.title || "Chat";
    let md = `# ${title}

`;
    if (chatState) {
      md += `> **Model:** ${chatState.provider} / ${chatState.model}

`;
    }
    md += `---

`;
    if (includeHistory) {
      for (let i = 0; i <= msgIndex; i++) {
        const msg = messages[i];
        if (msg.role === "user") {
          md += `## User

`;
          if (msg.contextFiles && msg.contextFiles.length > 0) {
            md += `> **Context:** `;
            md += msg.contextFiles.map((f) => `[[${f}]]`).join(", ");
            md += `

`;
          }
          md += `${msg.content}

`;
        } else {
          md += `## Assistant

${msg.content}

`;
        }
      }
    } else {
      const msg = messages[msgIndex];
      if (msg.role === "user") {
        md += `## User

`;
        if (msg.contextFiles && msg.contextFiles.length > 0) {
          md += `> **Context:** `;
          md += msg.contextFiles.map((f) => `[[${f}]]`).join(", ");
          md += `

`;
        }
        md += `${msg.content}

`;
      } else {
        md += `## Assistant

${msg.content}

`;
      }
    }
    const folder = ((_b = (_a = this.file) == null ? void 0 : _a.parent) == null ? void 0 : _b.path) || "";
    const now = /* @__PURE__ */ new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const hours = now.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12;
    const timestamp = `${now.getFullYear()} ${months[now.getMonth()]} ${now.getDate()} ${hours12}-${String(now.getMinutes()).padStart(2, "0")} ${ampm}`;
    const suffix = includeHistory ? "" : "-message";
    const fileName = `${title}${suffix} ${timestamp}`.replace(/[\\/:*?"<>|]/g, "-");
    const filePath = folder ? `${folder}/${fileName}.md` : `${fileName}.md`;
    const file = await this.app.vault.create(filePath, md);
    new import_obsidian.Notice(`Saved to ${filePath}`);
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
  }
  updateNodePosition(nodeId, x, y) {
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
  updateNodeSize(nodeId, width, height) {
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
  deleteNode(nodeId) {
    this.nodes.delete(nodeId);
    this.chatMessages.delete(nodeId);
    this.chatStates.delete(nodeId);
    const el = this.nodeElements.get(nodeId);
    if (el) {
      el.remove();
      this.nodeElements.delete(nodeId);
    }
    for (const [edgeId, edge] of this.edges) {
      if (edge.from === nodeId || edge.to === nodeId) {
        this.edges.delete(edgeId);
      }
    }
    this.updateEdges();
    this.updateMinimap();
    this.triggerSave();
  }
  addCardAtCenter() {
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
      content: ""
    });
  }
  addChatAtCenter() {
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
      content: ""
    });
  }
  showAddLinkModal() {
    const modal = new import_obsidian.Modal(this.app);
    modal.titleEl.setText("Add Link");
    const input = modal.contentEl.createEl("input", {
      cls: "rabbitmap-link-input",
      attr: { type: "text", placeholder: "Paste a URL (e.g. https://...)" }
    });
    input.style.width = "100%";
    input.style.padding = "8px";
    input.style.marginBottom = "12px";
    const btn = modal.contentEl.createEl("button", {
      text: "Add to Canvas",
      cls: "mod-cta"
    });
    btn.onclick = () => {
      const url = input.value.trim();
      if (url && /^https?:\/\//i.test(url)) {
        this.addLinkAtCenter(url);
        modal.close();
      } else {
        new import_obsidian.Notice("Please enter a valid URL");
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
  addLinkAtCenter(url) {
    const rect = this.canvas.getBoundingClientRect();
    const centerX = (rect.width / 2 - this.panX) / this.scale;
    const centerY = (rect.height / 2 - this.panY) / this.scale;
    this.addLinkNode(url, centerX - 150, centerY - 100);
  }
  addLinkNode(url, x, y) {
    const nodeId = this.generateId();
    const node = {
      id: nodeId,
      x,
      y,
      width: 300,
      height: 200,
      type: "link",
      content: "",
      url,
      linkTitle: "Loading...",
      linkType: "webpage"
    };
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if (ytMatch) {
      node.linkType = "youtube";
      node.linkImage = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    }
    const twitterMatch = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
    if (twitterMatch) {
      node.linkType = "twitter";
    }
    this.addNode(node);
    this.fetchLinkMetadata(url, nodeId);
  }
  parsePath(input) {
    input = input.trim();
    if (input.startsWith("obsidian://")) {
      try {
        const url = new URL(input);
        const filePath = url.searchParams.get("file");
        if (filePath) {
          return decodeURIComponent(filePath);
        }
      } catch (e) {
      }
    }
    try {
      input = decodeURIComponent(input);
    } catch (e) {
    }
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
  }
  resolveVaultItem(path) {
    let item = this.app.vault.getAbstractFileByPath(path);
    if (!item && !path.includes(".")) {
      item = this.app.vault.getAbstractFileByPath(path + ".md");
    }
    if (!item) {
      const allFiles = this.app.vault.getFiles();
      const fileName = path.split("/").pop() || path;
      const found = allFiles.find(
        (f) => f.path === path || f.name === fileName || f.basename === fileName || f.path.endsWith("/" + path)
      );
      if (found)
        return found;
    }
    if (!item && !path.includes(".")) {
      const rootFolder = this.app.vault.getRoot();
      const allFolders = this.getAllFolders(rootFolder);
      const folderName = path.split("/").pop() || path;
      const found = allFolders.find(
        (f) => f.path === path || f.name === folderName || f.path.endsWith("/" + path)
      );
      if (found)
        return found;
    }
    return item;
  }
  getAllFolders(folder) {
    const folders = [folder];
    for (const child of folder.children) {
      if (child instanceof import_obsidian.TFolder) {
        folders.push(...this.getAllFolders(child));
      }
    }
    return folders;
  }
  getMdFilesFromFolder(folder) {
    const files = [];
    for (const child of folder.children) {
      if (child instanceof import_obsidian.TFile && child.extension === "md") {
        files.push(child);
      } else if (child instanceof import_obsidian.TFolder) {
        files.push(...this.getMdFilesFromFolder(child));
      }
    }
    return files;
  }
  addNoteNode(filePath, content, x, y) {
    var _a;
    const node = {
      id: this.generateId(),
      x,
      y,
      width: 350,
      height: 300,
      type: "note",
      content,
      title: ((_a = filePath.split("/").pop()) == null ? void 0 : _a.replace(".md", "")) || "Note",
      filePath
    };
    this.addNode(node);
  }
  async fetchLinkMetadata(url, nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node)
      return;
    try {
      if (node.linkType === "youtube") {
        await this.fetchYouTubeMetadata(url, node);
      } else if (node.linkType === "twitter") {
        await this.fetchTwitterMetadata(url, node);
      } else {
        await this.fetchWebPageMetadata(url, node);
      }
    } catch (e) {
      try {
        node.linkTitle = new URL(url).hostname;
      } catch (e2) {
        node.linkTitle = url;
      }
      node.linkDescription = "Could not fetch content";
    }
    this.rerenderNode(nodeId);
    this.triggerSave();
  }
  async fetchYouTubeMetadata(url, node) {
    var _a;
    try {
      const resp = await (0, import_obsidian.requestUrl)({
        url: `https://noembed.com/embed?url=${encodeURIComponent(url)}`
      });
      const data = resp.json;
      node.linkTitle = data.title || "YouTube Video";
      node.linkDescription = data.author_name ? `by ${data.author_name}` : "";
    } catch (e) {
      node.linkTitle = "YouTube Video";
    }
    try {
      const pageResp = await (0, import_obsidian.requestUrl)({ url });
      const parser = new DOMParser();
      const doc = parser.parseFromString(pageResp.text, "text/html");
      const parts = [];
      if (node.linkTitle && node.linkTitle !== "YouTube Video") {
        parts.push(`Title: ${node.linkTitle}`);
      }
      if (node.linkDescription) {
        parts.push(`Channel: ${node.linkDescription.replace(/^by /, "")}`);
      }
      const ogDesc = doc.querySelector('meta[property="og:description"]');
      const descText = (_a = ogDesc == null ? void 0 : ogDesc.getAttribute("content")) == null ? void 0 : _a.trim();
      if (descText) {
        parts.push(`Description: ${descText}`);
      }
      const jsonLdContent = this.extractJsonLdContent(doc);
      if (jsonLdContent) {
        parts.push(jsonLdContent);
      }
      node.linkContent = parts.join("\n\n").slice(0, 1e4);
    } catch (e) {
    }
  }
  async fetchTwitterMetadata(url, node) {
    var _a, _b, _c, _d, _e, _f, _g;
    const match = url.match(/(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/);
    if (!match) {
      node.linkTitle = "Tweet";
      return;
    }
    const [, username, statusId] = match;
    try {
      const resp = await (0, import_obsidian.requestUrl)({
        url: `https://api.fxtwitter.com/${username}/status/${statusId}`
      });
      const data = resp.json;
      const tweet = data.tweet;
      if (tweet) {
        node.linkTitle = ((_a = tweet.author) == null ? void 0 : _a.name) ? `${tweet.author.name} (@${tweet.author.screen_name})` : `@${username}`;
        node.linkDescription = tweet.text ? tweet.text.length > 200 ? tweet.text.slice(0, 200) + "\u2026" : tweet.text : "";
        if ((_d = (_c = (_b = tweet.media) == null ? void 0 : _b.photos) == null ? void 0 : _c[0]) == null ? void 0 : _d.url) {
          node.linkImage = tweet.media.photos[0].url;
        } else if ((_e = tweet.author) == null ? void 0 : _e.avatar_url) {
          node.linkImage = tweet.author.avatar_url;
        }
        const contentParts = [];
        contentParts.push(`Tweet by ${((_f = tweet.author) == null ? void 0 : _f.name) || username} (@${((_g = tweet.author) == null ? void 0 : _g.screen_name) || username})`);
        if (tweet.created_at) {
          contentParts.push(`Posted: ${tweet.created_at}`);
        }
        if (tweet.text) {
          contentParts.push(`
${tweet.text}`);
        }
        if (tweet.replies !== void 0) {
          contentParts.push(`
Replies: ${tweet.replies} | Retweets: ${tweet.retweets} | Likes: ${tweet.likes}`);
        }
        if (tweet.replying_to) {
          contentParts.push(`Replying to: @${tweet.replying_to}`);
        }
        node.linkContent = contentParts.join("\n").slice(0, 1e4);
      } else {
        node.linkTitle = `@${username}`;
        node.linkDescription = "Could not load tweet";
      }
    } catch (e) {
      try {
        await this.fetchWebPageMetadata(url, node);
      } catch (e2) {
        node.linkTitle = `@${username}`;
        node.linkDescription = "Could not load tweet";
      }
    }
  }
  async fetchWebPageMetadata(url, node) {
    var _a, _b;
    const resp = await (0, import_obsidian.requestUrl)({ url });
    const html = resp.text;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    const titleEl = doc.querySelector("title");
    node.linkTitle = ((_a = ogTitle == null ? void 0 : ogTitle.getAttribute("content")) == null ? void 0 : _a.trim()) || ((_b = titleEl == null ? void 0 : titleEl.textContent) == null ? void 0 : _b.trim()) || new URL(url).hostname;
    const descSources = [
      doc.querySelector('meta[property="og:description"]'),
      doc.querySelector('meta[name="description"]'),
      doc.querySelector('meta[name="twitter:description"]')
    ];
    node.linkDescription = descSources.map((el) => {
      var _a2;
      return (_a2 = el == null ? void 0 : el.getAttribute("content")) == null ? void 0 : _a2.trim();
    }).find((d) => d && d.length > 0) || "";
    const ogImage = doc.querySelector('meta[property="og:image"]');
    const imgContent = ogImage == null ? void 0 : ogImage.getAttribute("content");
    if (imgContent) {
      try {
        node.linkImage = new URL(imgContent, url).href;
      } catch (e) {
        node.linkImage = imgContent;
      }
    }
    node.linkContent = this.extractPageContent(doc, url);
  }
  extractPageContent(doc, url) {
    const jsonLdContent = this.extractJsonLdContent(doc);
    if (jsonLdContent && jsonLdContent.length > 200) {
      return jsonLdContent.slice(0, 1e4);
    }
    const htmlContent = this.extractHtmlContent(doc);
    if (jsonLdContent && jsonLdContent.length > 0) {
      const combined = jsonLdContent + "\n\n" + htmlContent;
      return combined.slice(0, 1e4);
    }
    if (htmlContent.length < 100) {
      const metaFallback = this.extractMetaContent(doc);
      if (metaFallback.length > htmlContent.length) {
        return metaFallback.slice(0, 1e4);
      }
    }
    return htmlContent.slice(0, 1e4);
  }
  extractJsonLdContent(doc) {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    const parts = [];
    scripts.forEach((script) => {
      try {
        const data = JSON.parse(script.textContent || "");
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item.articleBody) {
            parts.push(item.articleBody);
          }
          if (item.text) {
            parts.push(item.text);
          }
          if (item.description && !parts.includes(item.description)) {
            parts.push(item.description);
          }
          if (item["@graph"] && Array.isArray(item["@graph"])) {
            for (const graphItem of item["@graph"]) {
              if (graphItem.articleBody)
                parts.push(graphItem.articleBody);
              if (graphItem.text)
                parts.push(graphItem.text);
              if (graphItem.description && !parts.includes(graphItem.description)) {
                parts.push(graphItem.description);
              }
              if (graphItem.abstract)
                parts.push(graphItem.abstract);
            }
          }
          if (item.abstract) {
            parts.push(item.abstract);
          }
        }
      } catch (e) {
      }
    });
    return parts.join("\n\n").trim();
  }
  extractHtmlContent(doc) {
    const removeSelectors = [
      "script",
      "style",
      "nav",
      "footer",
      "header",
      "aside",
      "iframe",
      "noscript",
      "[role='navigation']",
      "[role='banner']",
      "[role='contentinfo']",
      ".sidebar",
      ".comments",
      ".comment",
      ".related",
      ".advertisement",
      ".ad",
      "form",
      "[aria-hidden='true']",
      ".social-share",
      ".share-buttons",
      ".cookie-banner",
      ".popup",
      ".modal"
    ];
    for (const sel of removeSelectors) {
      try {
        doc.querySelectorAll(sel).forEach((el) => el.remove());
      } catch (e) {
      }
    }
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
      "body"
    ];
    let contentEl = null;
    for (const sel of contentSelectors) {
      contentEl = doc.querySelector(sel);
      if (contentEl)
        break;
    }
    if (!contentEl)
      return "";
    const paragraphs = [];
    const pElements = contentEl.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, td");
    if (pElements.length > 0) {
      pElements.forEach((el) => {
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (text.length > 0) {
          paragraphs.push(text);
        }
      });
      return paragraphs.join("\n\n").trim();
    }
    return (contentEl.textContent || "").replace(/\s+/g, " ").trim();
  }
  extractMetaContent(doc) {
    var _a;
    const metaSelectors = [
      'meta[property="og:description"]',
      'meta[name="description"]',
      'meta[name="twitter:description"]',
      'meta[name="abstract"]',
      // Academic papers
      'meta[name="citation_abstract"]'
      // Scholar/academic
    ];
    const parts = [];
    for (const sel of metaSelectors) {
      const el = doc.querySelector(sel);
      const content = (_a = el == null ? void 0 : el.getAttribute("content")) == null ? void 0 : _a.trim();
      if (content && !parts.includes(content)) {
        parts.push(content);
      }
    }
    return parts.join("\n\n").trim();
  }
  rerenderNode(nodeId) {
    const el = this.nodeElements.get(nodeId);
    const node = this.nodes.get(nodeId);
    if (!el || !node)
      return;
    el.remove();
    this.nodeElements.delete(nodeId);
    this.renderNode(node);
  }
  async onClose() {
    this.triggerSave();
  }
};
var PromptEditorModal = class extends import_obsidian.Modal {
  constructor(app, prompt, contextTemplate, onSave) {
    super(app);
    this.prompt = prompt;
    this.contextTemplate = contextTemplate;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("rabbitmap-prompt-modal");
    contentEl.createEl("h3", { text: "System Prompt" });
    const promptTextarea = contentEl.createEl("textarea", {
      cls: "rabbitmap-prompt-textarea",
      attr: { placeholder: "Enter system prompt for this chat..." }
    });
    promptTextarea.value = this.prompt;
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
    contentEl.createEl("h4", { text: "Preview", cls: "rabbitmap-prompt-section-title" });
    const preview = contentEl.createDiv({ cls: "rabbitmap-prompt-preview" });
    const updatePreview = () => {
      const template = templateTextarea.value;
      const example = template.replace(/\{filepath\}/g, "folder/example.md").replace(/\{filename\}/g, "example.md").replace(/\{content\}/g, "File content here...");
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
};
var ExpandedChatModal = class extends import_obsidian.Modal {
  constructor(app, view, nodeId) {
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
    const header = contentEl.createDiv({ cls: "rabbitmap-expanded-header" });
    header.createEl("h2", { text: (node == null ? void 0 : node.title) || "Chat" });
    if (chatState) {
      header.createEl("span", {
        text: `${chatState.provider} / ${chatState.model}`,
        cls: "rabbitmap-expanded-model"
      });
    }
    this.messagesContainer = contentEl.createDiv({ cls: "rabbitmap-expanded-messages" });
    this.renderMessages();
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
    this.input.focus();
    setTimeout(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }, 50);
    this.updateInterval = window.setInterval(() => {
      this.renderMessages();
    }, 500);
  }
  renderMessages(showLoading = false) {
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
        contextEl.createSpan({ text: msg.contextFiles.map((f) => f.split("/").pop()).join(", ") });
      }
      msgEl.createDiv({ cls: "rabbitmap-expanded-content", text: msg.content });
    }
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
  async sendMessage() {
    const text = this.input.value.trim();
    if (!text)
      return;
    this.input.value = "";
    this.input.disabled = true;
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
};
var SettingsModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    var _a;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("rabbitmap-settings-modal");
    contentEl.createEl("h2", { text: "Provider Settings" });
    const aboutSection = contentEl.createDiv({ cls: "rabbitmap-about-section" });
    aboutSection.createEl("p", {
      text: "This RabbitMap plugin is part of "
    }).createEl("a", {
      text: "rabbitmap.com",
      href: "https://rabbitmap.com"
    });
    (_a = aboutSection.querySelector("p")) == null ? void 0 : _a.appendText(" \u2014 a cloud research OS for saving and organizing web content on canvas.");
    const aboutText = aboutSection.createEl("p");
    aboutText.appendText("We're building deep integration between web research and LLM context \u2014 making context management easy and delightful. Built by ");
    aboutText.createEl("a", {
      text: "@bayradion",
      href: "https://x.com/bayradion"
    });
    aboutText.appendText(". Join our ");
    aboutText.createEl("a", {
      text: "Discord community",
      href: "https://discord.gg/UeUBkmxEcV"
    });
    aboutText.appendText("!");
    const providersContainer = contentEl.createDiv({ cls: "rabbitmap-providers-container" });
    const renderProviders = () => {
      providersContainer.empty();
      for (let i = 0; i < this.plugin.settings.providers.length; i++) {
        const provider = this.plugin.settings.providers[i];
        const providerSection = providersContainer.createDiv({ cls: "rabbitmap-provider-section" });
        const headerRow = providerSection.createDiv({ cls: "rabbitmap-provider-header" });
        headerRow.createEl("h3", { text: provider.name });
        const toggleContainer = headerRow.createDiv({ cls: "rabbitmap-provider-toggle" });
        const toggleLabel = toggleContainer.createEl("label", { cls: "rabbitmap-toggle-label" });
        const toggleInput = toggleLabel.createEl("input", { type: "checkbox" });
        toggleInput.checked = provider.enabled;
        toggleLabel.createSpan({ text: provider.enabled ? "Enabled" : "Disabled" });
        toggleInput.onchange = async () => {
          provider.enabled = toggleInput.checked;
          toggleLabel.querySelector("span").textContent = provider.enabled ? "Enabled" : "Disabled";
          await this.plugin.saveSettings();
        };
        new import_obsidian.Setting(providerSection).setName("Base URL").setDesc("API endpoint URL (change for custom/proxy deployments)").addText(
          (text) => text.setPlaceholder("https://api.example.com/v1").setValue(provider.baseUrl).onChange(async (value) => {
            provider.baseUrl = value;
            await this.plugin.saveSettings();
          })
        );
        new import_obsidian.Setting(providerSection).setName("API Key").setDesc(`Enter your ${provider.name} API key`).addText(
          (text) => text.setPlaceholder("sk-...").setValue(provider.apiKey).onChange(async (value) => {
            provider.apiKey = value;
            await this.plugin.saveSettings();
          })
        );
        new import_obsidian.Setting(providerSection).setName("API Format").setDesc("Select the API format for this provider").addDropdown(
          (dropdown) => dropdown.addOption("openai", "OpenAI Compatible").addOption("anthropic", "Anthropic (Claude)").addOption("google", "Google (Gemini)").setValue(provider.apiFormat || "openai").onChange(async (value) => {
            provider.apiFormat = value;
            await this.plugin.saveSettings();
          })
        );
        const modelsHeader = providerSection.createDiv({ cls: "rabbitmap-models-header" });
        modelsHeader.createEl("h4", { text: "Models" });
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
              text: "\xD7",
              cls: "rabbitmap-models-remove-btn"
            });
            removeBtn.onclick = async () => {
              provider.models = provider.models.filter((m) => m !== model);
              await this.plugin.saveSettings();
              renderModelsList();
            };
          }
        };
        addButton.onclick = async () => {
          const newModel = modelInput.value.trim();
          if (!newModel)
            return;
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
        if (!name)
          return;
        if (this.plugin.settings.providers.some((p) => p.name === name)) {
          new import_obsidian.Notice(`Provider "${name}" already exists.`);
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
    contentEl.createEl("p", {
      text: "Get your API keys from:",
      cls: "rabbitmap-settings-info"
    });
    const linkContainer = contentEl.createDiv({ cls: "rabbitmap-settings-links" });
    linkContainer.createEl("a", {
      text: "OpenAI Platform",
      href: "https://platform.openai.com/api-keys"
    });
    linkContainer.createEl("span", { text: " | " });
    linkContainer.createEl("a", {
      text: "OpenRouter",
      href: "https://openrouter.ai/keys"
    });
    linkContainer.createEl("span", { text: " | " });
    linkContainer.createEl("a", {
      text: "Google AI Studio",
      href: "https://aistudio.google.com/apikey"
    });
    linkContainer.createEl("span", { text: " | " });
    linkContainer.createEl("a", {
      text: "Anthropic Console",
      href: "https://console.anthropic.com/settings/keys"
    });
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
var RabbitMapPlugin = class extends import_obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.registerView(VIEW_TYPE_RABBITMAP, (leaf) => new RabbitMapView(leaf, this));
    this.registerExtensions([FILE_EXTENSION], VIEW_TYPE_RABBITMAP);
    this.addRibbonIcon("layout-dashboard", "Create new RabbitMap", async () => {
      await this.createNewCanvas();
    });
    this.addCommand({
      id: "create-new-rabbitmap",
      name: "Create new RabbitMap canvas",
      callback: async () => {
        await this.createNewCanvas();
      }
    });
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof import_obsidian.TFolder) {
          menu.addItem((item) => {
            item.setTitle("New RabbitMap").setIcon("layout-dashboard").onClick(async () => {
              await this.createNewCanvas(file.path);
            });
          });
        }
      })
    );
  }
  async createNewCanvas(folderPath) {
    const folder = folderPath || "";
    let fileName = "Untitled";
    let counter = 1;
    let filePath = folder ? `${folder}/${fileName}.${FILE_EXTENSION}` : `${fileName}.${FILE_EXTENSION}`;
    while (this.app.vault.getAbstractFileByPath(filePath)) {
      fileName = `Untitled ${counter}`;
      filePath = folder ? `${folder}/${fileName}.${FILE_EXTENSION}` : `${fileName}.${FILE_EXTENSION}`;
      counter++;
    }
    const initialData = {
      nodes: [],
      edges: [],
      chatMessages: {},
      chatStates: {},
      view: { scale: 1, panX: 0, panY: 0 }
    };
    const file = await this.app.vault.create(filePath, JSON.stringify(initialData, null, 2));
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
    new import_obsidian.Notice(`Created ${fileName}.${FILE_EXTENSION}`);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  onunload() {
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcblx0VGV4dEZpbGVWaWV3LFxuXHRQbHVnaW4sXG5cdFdvcmtzcGFjZUxlYWYsXG5cdFRGaWxlLFxuXHRNZW51LFxuXHRURm9sZGVyLFxuXHROb3RpY2UsXG5cdE1vZGFsLFxuXHRTZXR0aW5nLFxuXHRNYXJrZG93blJlbmRlcmVyLFxuXHRDb21wb25lbnQsXG5cdHJlcXVlc3RVcmwsXG59IGZyb20gXCJvYnNpZGlhblwiO1xuXG5jb25zdCBWSUVXX1RZUEVfUkFCQklUTUFQID0gXCJyYWJiaXRtYXAtY2FudmFzXCI7XG5jb25zdCBGSUxFX0VYVEVOU0lPTiA9IFwicmFiYml0bWFwXCI7XG5cbmludGVyZmFjZSBDYW52YXNOb2RlIHtcblx0aWQ6IHN0cmluZztcblx0eDogbnVtYmVyO1xuXHR5OiBudW1iZXI7XG5cdHdpZHRoOiBudW1iZXI7XG5cdGhlaWdodDogbnVtYmVyO1xuXHR0eXBlOiBcImNhcmRcIiB8IFwiY2hhdFwiIHwgXCJsaW5rXCIgfCBcIm5vdGVcIjtcblx0Y29udGVudDogc3RyaW5nO1xuXHR0aXRsZT86IHN0cmluZztcblx0ZmlsZVBhdGg/OiBzdHJpbmc7XG5cdHVybD86IHN0cmluZztcblx0bGlua1RpdGxlPzogc3RyaW5nO1xuXHRsaW5rRGVzY3JpcHRpb24/OiBzdHJpbmc7XG5cdGxpbmtJbWFnZT86IHN0cmluZztcblx0bGlua0NvbnRlbnQ/OiBzdHJpbmc7XG5cdGxpbmtUeXBlPzogXCJ3ZWJwYWdlXCIgfCBcInlvdXR1YmVcIiB8IFwidHdpdHRlclwiIHwgXCJvYnNpZGlhblwiO1xufVxuXG5pbnRlcmZhY2UgQ2hhdE1lc3NhZ2Uge1xuXHRyb2xlOiBcInVzZXJcIiB8IFwiYXNzaXN0YW50XCI7XG5cdGNvbnRlbnQ6IHN0cmluZztcblx0Y29udGV4dEZpbGVzPzogc3RyaW5nW107IC8vIENvbnRleHQgZmlsZXMgYXQgdGhlIHRpbWUgb2Ygc2VuZGluZyAoZm9yIHVzZXIgbWVzc2FnZXMpXG59XG5cbmludGVyZmFjZSBFZGdlIHtcblx0aWQ6IHN0cmluZztcblx0ZnJvbTogc3RyaW5nO1xuXHR0bzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgUHJvdmlkZXJDb25maWcge1xuXHRuYW1lOiBzdHJpbmc7XG5cdGJhc2VVcmw6IHN0cmluZztcblx0YXBpS2V5OiBzdHJpbmc7XG5cdG1vZGVsczogc3RyaW5nW107XG5cdGVuYWJsZWQ6IGJvb2xlYW47XG5cdGFwaUZvcm1hdDogXCJvcGVuYWlcIiB8IFwiYW50aHJvcGljXCIgfCBcImdvb2dsZVwiO1xufVxuXG5pbnRlcmZhY2UgUGx1Z2luU2V0dGluZ3Mge1xuXHRvcGVuYWlBcGlLZXk6IHN0cmluZzsgLy8gZGVwcmVjYXRlZCwga2VwdCBmb3IgbWlncmF0aW9uXG5cdG9wZW5yb3V0ZXJBcGlLZXk6IHN0cmluZzsgLy8gZGVwcmVjYXRlZCwga2VwdCBmb3IgbWlncmF0aW9uXG5cdGN1c3RvbU9wZW5Sb3V0ZXJNb2RlbHM6IHN0cmluZztcblx0cHJvdmlkZXJzOiBQcm92aWRlckNvbmZpZ1tdO1xufVxuXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBQbHVnaW5TZXR0aW5ncyA9IHtcblx0b3BlbmFpQXBpS2V5OiBcIlwiLFxuXHRvcGVucm91dGVyQXBpS2V5OiBcIlwiLFxuXHRjdXN0b21PcGVuUm91dGVyTW9kZWxzOiBcIlwiLFxuXHRwcm92aWRlcnM6IFtcblx0XHR7XG5cdFx0XHRuYW1lOiBcIk9wZW5BSVwiLFxuXHRcdFx0YmFzZVVybDogXCJodHRwczovL2FwaS5vcGVuYWkuY29tL3YxXCIsXG5cdFx0XHRhcGlLZXk6IFwiXCIsXG5cdFx0XHRtb2RlbHM6IFtcImdwdC00b1wiLCBcImdwdC00by1taW5pXCIsIFwiZ3B0LTQtdHVyYm9cIiwgXCJncHQtMy41LXR1cmJvXCJdLFxuXHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdGFwaUZvcm1hdDogXCJvcGVuYWlcIlxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0bmFtZTogXCJPcGVuUm91dGVyXCIsXG5cdFx0XHRiYXNlVXJsOiBcImh0dHBzOi8vb3BlbnJvdXRlci5haS9hcGkvdjFcIixcblx0XHRcdGFwaUtleTogXCJcIixcblx0XHRcdG1vZGVsczogW1wiYW50aHJvcGljL2NsYXVkZS0zLjUtc29ubmV0XCIsIFwiYW50aHJvcGljL2NsYXVkZS0zLW9wdXNcIiwgXCJvcGVuYWkvZ3B0LTRvXCIsIFwiZ29vZ2xlL2dlbWluaS1wcm8tMS41XCJdLFxuXHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdGFwaUZvcm1hdDogXCJvcGVuYWlcIlxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0bmFtZTogXCJBbnRocm9waWNcIixcblx0XHRcdGJhc2VVcmw6IFwiaHR0cHM6Ly9hcGkuYW50aHJvcGljLmNvbVwiLFxuXHRcdFx0YXBpS2V5OiBcIlwiLFxuXHRcdFx0bW9kZWxzOiBbXCJjbGF1ZGUtc29ubmV0LTQtNVwiLCBcImNsYXVkZS1zb25uZXQtNC01LXRoaW5raW5nXCIsIFwiY2xhdWRlLW9wdXMtNC01LXRoaW5raW5nXCJdLFxuXHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdGFwaUZvcm1hdDogXCJhbnRocm9waWNcIlxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0bmFtZTogXCJHb29nbGVcIixcblx0XHRcdGJhc2VVcmw6IFwiaHR0cHM6Ly9nZW5lcmF0aXZlbGFuZ3VhZ2UuZ29vZ2xlYXBpcy5jb20vdjFiZXRhXCIsXG5cdFx0XHRhcGlLZXk6IFwiXCIsXG5cdFx0XHRtb2RlbHM6IFtcImdlbWluaS0yLjUtZmxhc2hcIiwgXCJnZW1pbmktMi41LWZsYXNoLXRoaW5raW5nXCIsIFwiZ2VtaW5pLTMtZmxhc2hcIiwgXCJnZW1pbmktMy1wcm8taGlnaFwiLCBcImdlbWluaS0zLXByby1sb3dcIl0sXG5cdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0YXBpRm9ybWF0OiBcImdvb2dsZVwiXG5cdFx0fVxuXHRdXG59O1xuXG5pbnRlcmZhY2UgQ2hhdE5vZGVTdGF0ZSB7XG5cdHByb3ZpZGVyOiBzdHJpbmc7XG5cdG1vZGVsOiBzdHJpbmc7XG5cdGNvbnRleHRGaWxlczogc3RyaW5nW107IC8vIGZpbGUgcGF0aHNcblx0c3lzdGVtUHJvbXB0OiBzdHJpbmc7XG5cdGNvbnRleHRUZW1wbGF0ZTogc3RyaW5nOyAvLyB0ZW1wbGF0ZSBmb3IgY29udGV4dCBmaWxlc1xufVxuXG5jb25zdCBERUZBVUxUX0NPTlRFWFRfVEVNUExBVEUgPSBgLS0tIHtmaWxlcGF0aH0gLS0tXG57Y29udGVudH1gO1xuXG5jb25zdCBERUZBVUxUX1NZU1RFTV9QUk9NUFQgPSBgWW91IGFyZSBhIGhlbHBmdWwgQUkgYXNzaXN0YW50LiBZb3UgaGVscCB1c2VycyB3aXRoIHRoZWlyIHF1ZXN0aW9ucyBhbmQgdGFza3MuIFdoZW4gY29udGV4dCBmaWxlcyBhcmUgcHJvdmlkZWQsIHVzZSB0aGVtIHRvIGdpdmUgbW9yZSBhY2N1cmF0ZSBhbmQgcmVsZXZhbnQgYW5zd2Vycy4gQmUgY29uY2lzZSBidXQgdGhvcm91Z2guYDtcblxuaW50ZXJmYWNlIFJhYmJpdE1hcERhdGEge1xuXHRub2RlczogQ2FudmFzTm9kZVtdO1xuXHRlZGdlczogRWRnZVtdO1xuXHRjaGF0TWVzc2FnZXM6IFJlY29yZDxzdHJpbmcsIENoYXRNZXNzYWdlW10+O1xuXHRjaGF0U3RhdGVzOiBSZWNvcmQ8c3RyaW5nLCBDaGF0Tm9kZVN0YXRlPjtcblx0dmlldzoge1xuXHRcdHNjYWxlOiBudW1iZXI7XG5cdFx0cGFuWDogbnVtYmVyO1xuXHRcdHBhblk6IG51bWJlcjtcblx0fTtcbn1cblxuY2xhc3MgUmFiYml0TWFwVmlldyBleHRlbmRzIFRleHRGaWxlVmlldyB7XG5cdHByaXZhdGUgY2FudmFzOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBub2Rlc0NvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgbm9kZXM6IE1hcDxzdHJpbmcsIENhbnZhc05vZGU+ID0gbmV3IE1hcCgpO1xuXHRwcml2YXRlIG5vZGVFbGVtZW50czogTWFwPHN0cmluZywgSFRNTEVsZW1lbnQ+ID0gbmV3IE1hcCgpO1xuXG5cdC8vIENhbnZhcyB0cmFuc2Zvcm0gc3RhdGVcblx0cHJpdmF0ZSBzY2FsZSA9IDE7XG5cdHByaXZhdGUgcGFuWCA9IDA7XG5cdHByaXZhdGUgcGFuWSA9IDA7XG5cblx0Ly8gSW50ZXJhY3Rpb24gc3RhdGVcblx0cHJpdmF0ZSBpc1Bhbm5pbmcgPSBmYWxzZTtcblx0cHJpdmF0ZSBwYW5TdGFydFggPSAwO1xuXHRwcml2YXRlIHBhblN0YXJ0WSA9IDA7XG5cdHByaXZhdGUgc3BhY2VQcmVzc2VkID0gZmFsc2U7XG5cblx0Ly8gRHJhZyBzdGF0ZVxuXHRwcml2YXRlIGRyYWdnZWROb2RlOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBkcmFnT2Zmc2V0WCA9IDA7XG5cdHByaXZhdGUgZHJhZ09mZnNldFkgPSAwO1xuXG5cdC8vIFJlc2l6ZSBzdGF0ZVxuXHRwcml2YXRlIHJlc2l6aW5nTm9kZTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgcmVzaXplU3RhcnRXaWR0aCA9IDA7XG5cdHByaXZhdGUgcmVzaXplU3RhcnRIZWlnaHQgPSAwO1xuXHRwcml2YXRlIHJlc2l6ZVN0YXJ0WCA9IDA7XG5cdHByaXZhdGUgcmVzaXplU3RhcnRZID0gMDtcblxuXHQvLyBTZWxlY3Rpb24gc3RhdGVcblx0cHJpdmF0ZSBzZWxlY3RlZE5vZGVzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblx0cHJpdmF0ZSBpc1NlbGVjdGluZyA9IGZhbHNlO1xuXHRwcml2YXRlIHNlbGVjdGlvbkJveDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBzZWxlY3Rpb25TdGFydFggPSAwO1xuXHRwcml2YXRlIHNlbGVjdGlvblN0YXJ0WSA9IDA7XG5cdHByaXZhdGUgZHJhZ1N0YXJ0UG9zaXRpb25zOiBNYXA8c3RyaW5nLCB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0+ID0gbmV3IE1hcCgpO1xuXHRwcml2YXRlIGRyYWdTdGFydE1vdXNlWCA9IDA7XG5cdHByaXZhdGUgZHJhZ1N0YXJ0TW91c2VZID0gMDtcblxuXHQvLyBNaW5pbWFwXG5cdHByaXZhdGUgbWluaW1hcDogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgbWluaW1hcENvbnRlbnQ6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIG1pbmltYXBWaWV3cG9ydDogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgbWluaW1hcE5vZGVzOiBNYXA8c3RyaW5nLCBIVE1MRWxlbWVudD4gPSBuZXcgTWFwKCk7XG5cblx0Ly8gQ2hhdCBzdGF0ZVxuXHRwcml2YXRlIGNoYXRNZXNzYWdlczogTWFwPHN0cmluZywgQ2hhdE1lc3NhZ2VbXT4gPSBuZXcgTWFwKCk7XG5cdHByaXZhdGUgY2hhdFN0YXRlczogTWFwPHN0cmluZywgQ2hhdE5vZGVTdGF0ZT4gPSBuZXcgTWFwKCk7XG5cblx0Ly8gRWRnZXNcblx0cHJpdmF0ZSBlZGdlczogTWFwPHN0cmluZywgRWRnZT4gPSBuZXcgTWFwKCk7XG5cdHByaXZhdGUgZWRnZXNDb250YWluZXI6IFNWR1NWR0VsZW1lbnQ7XG5cblx0Ly8gRWRnZSBkcmF3aW5nIHN0YXRlXG5cdHByaXZhdGUgaXNEcmF3aW5nRWRnZSA9IGZhbHNlO1xuXHRwcml2YXRlIGVkZ2VEcmF3RnJvbU5vZGU6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGVkZ2VEcmF3RnJvbVNpZGU6IFwidG9wXCIgfCBcInJpZ2h0XCIgfCBcImJvdHRvbVwiIHwgXCJsZWZ0XCIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBlZGdlRHJhd1RlbXBMaW5lOiBTVkdMaW5lRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG5cdC8vIFBsdWdpbiByZWZlcmVuY2Vcblx0cGx1Z2luOiBSYWJiaXRNYXBQbHVnaW47XG5cblx0cHJpdmF0ZSBpc0xvYWRlZCA9IGZhbHNlO1xuXHRwcml2YXRlIGlzU2F2aW5nID0gZmFsc2U7XG5cdHByaXZhdGUgc2F2ZVRpbWVvdXQ6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYsIHBsdWdpbjogUmFiYml0TWFwUGx1Z2luKSB7XG5cdFx0c3VwZXIobGVhZik7XG5cdFx0dGhpcy5wbHVnaW4gPSBwbHVnaW47XG5cdH1cblxuXHRnZXRWaWV3VHlwZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBWSUVXX1RZUEVfUkFCQklUTUFQO1xuXHR9XG5cblx0Z2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5maWxlPy5iYXNlbmFtZSB8fCBcIlJhYmJpdE1hcFwiO1xuXHR9XG5cblx0Z2V0SWNvbigpOiBzdHJpbmcge1xuXHRcdHJldHVybiBcImxheW91dC1kYXNoYm9hcmRcIjtcblx0fVxuXG5cdC8vIENhbGxlZCBieSBPYnNpZGlhbiB0byBnZXQgY3VycmVudCBkYXRhIGZvciBzYXZpbmdcblx0Z2V0Vmlld0RhdGEoKTogc3RyaW5nIHtcblx0XHRjb25zdCBkYXRhOiBSYWJiaXRNYXBEYXRhID0ge1xuXHRcdFx0bm9kZXM6IEFycmF5LmZyb20odGhpcy5ub2Rlcy52YWx1ZXMoKSksXG5cdFx0XHRlZGdlczogQXJyYXkuZnJvbSh0aGlzLmVkZ2VzLnZhbHVlcygpKSxcblx0XHRcdGNoYXRNZXNzYWdlczogT2JqZWN0LmZyb21FbnRyaWVzKHRoaXMuY2hhdE1lc3NhZ2VzKSxcblx0XHRcdGNoYXRTdGF0ZXM6IE9iamVjdC5mcm9tRW50cmllcyh0aGlzLmNoYXRTdGF0ZXMpLFxuXHRcdFx0dmlldzoge1xuXHRcdFx0XHRzY2FsZTogdGhpcy5zY2FsZSxcblx0XHRcdFx0cGFuWDogdGhpcy5wYW5YLFxuXHRcdFx0XHRwYW5ZOiB0aGlzLnBhblksXG5cdFx0XHR9LFxuXHRcdH07XG5cdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDIpO1xuXHR9XG5cblx0Ly8gQ2FsbGVkIGJ5IE9ic2lkaWFuIHdoZW4gZmlsZSBjb250ZW50IGlzIGxvYWRlZFxuXHRzZXRWaWV3RGF0YShkYXRhOiBzdHJpbmcsIGNsZWFyOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Ly8gSWdub3JlIGlmIHdlIHRyaWdnZXJlZCB0aGUgc2F2ZSBvdXJzZWx2ZXNcblx0XHRpZiAodGhpcy5pc1NhdmluZykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChjbGVhcikge1xuXHRcdFx0dGhpcy5jbGVhcigpO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRpZiAoZGF0YS50cmltKCkpIHtcblx0XHRcdFx0Y29uc3QgcGFyc2VkOiBSYWJiaXRNYXBEYXRhID0gSlNPTi5wYXJzZShkYXRhKTtcblxuXHRcdFx0XHQvLyBSZXN0b3JlIHZpZXcgc3RhdGVcblx0XHRcdFx0aWYgKHBhcnNlZC52aWV3KSB7XG5cdFx0XHRcdFx0dGhpcy5zY2FsZSA9IHBhcnNlZC52aWV3LnNjYWxlIHx8IDE7XG5cdFx0XHRcdFx0dGhpcy5wYW5YID0gcGFyc2VkLnZpZXcucGFuWCB8fCAwO1xuXHRcdFx0XHRcdHRoaXMucGFuWSA9IHBhcnNlZC52aWV3LnBhblkgfHwgMDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFJlc3RvcmUgY2hhdCBtZXNzYWdlc1xuXHRcdFx0XHRpZiAocGFyc2VkLmNoYXRNZXNzYWdlcykge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgW25vZGVJZCwgbWVzc2FnZXNdIG9mIE9iamVjdC5lbnRyaWVzKHBhcnNlZC5jaGF0TWVzc2FnZXMpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmNoYXRNZXNzYWdlcy5zZXQobm9kZUlkLCBtZXNzYWdlcyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gUmVzdG9yZSBjaGF0IHN0YXRlc1xuXHRcdFx0XHRpZiAocGFyc2VkLmNoYXRTdGF0ZXMpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IFtub2RlSWQsIHN0YXRlXSBvZiBPYmplY3QuZW50cmllcyhwYXJzZWQuY2hhdFN0YXRlcykpIHtcblx0XHRcdFx0XHRcdHRoaXMuY2hhdFN0YXRlcy5zZXQobm9kZUlkLCBzdGF0ZSBhcyBDaGF0Tm9kZVN0YXRlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBSZXN0b3JlIG5vZGVzXG5cdFx0XHRcdGlmIChwYXJzZWQubm9kZXMgJiYgcGFyc2VkLm5vZGVzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IG5vZGUgb2YgcGFyc2VkLm5vZGVzKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm5vZGVzLnNldChub2RlLmlkLCBub2RlKTtcblx0XHRcdFx0XHRcdHRoaXMucmVuZGVyTm9kZShub2RlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBSZXN0b3JlIGVkZ2VzXG5cdFx0XHRcdGlmIChwYXJzZWQuZWRnZXMgJiYgcGFyc2VkLmVkZ2VzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGVkZ2Ugb2YgcGFyc2VkLmVkZ2VzKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmVkZ2VzLnNldChlZGdlLmlkLCBlZGdlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy5yZW5kZXJBbGxFZGdlcygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc29sZS5sb2coXCJFcnJvciBwYXJzaW5nIHJhYmJpdG1hcCBmaWxlOlwiLCBlKTtcblx0XHR9XG5cblx0XHQvLyBJZiBubyBub2RlcyBhZnRlciBsb2FkaW5nLCBhZGQgYSBkZWZhdWx0IGNoYXRcblx0XHRpZiAodGhpcy5ub2Rlcy5zaXplID09PSAwKSB7XG5cdFx0XHR0aGlzLmFkZE5vZGUoe1xuXHRcdFx0XHRpZDogdGhpcy5nZW5lcmF0ZUlkKCksXG5cdFx0XHRcdHg6IDEwMCxcblx0XHRcdFx0eTogMTAwLFxuXHRcdFx0XHR3aWR0aDogNDAwLFxuXHRcdFx0XHRoZWlnaHQ6IDUwMCxcblx0XHRcdFx0dHlwZTogXCJjaGF0XCIsXG5cdFx0XHRcdGNvbnRlbnQ6IFwiXCIsXG5cdFx0XHR9LCBmYWxzZSk7IC8vIERvbid0IHRyaWdnZXIgc2F2ZSBvbiBpbml0aWFsIGxvYWRcblx0XHR9XG5cblx0XHR0aGlzLnVwZGF0ZVRyYW5zZm9ybSgpO1xuXHRcdHRoaXMuaXNMb2FkZWQgPSB0cnVlO1xuXHR9XG5cblx0Y2xlYXIoKTogdm9pZCB7XG5cdFx0dGhpcy5ub2Rlcy5jbGVhcigpO1xuXHRcdHRoaXMuY2hhdE1lc3NhZ2VzLmNsZWFyKCk7XG5cdFx0dGhpcy5jaGF0U3RhdGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5lZGdlcy5jbGVhcigpO1xuXHRcdHRoaXMubm9kZUVsZW1lbnRzLmZvckVhY2goKGVsKSA9PiBlbC5yZW1vdmUoKSk7XG5cdFx0dGhpcy5ub2RlRWxlbWVudHMuY2xlYXIoKTtcblx0XHRpZiAodGhpcy5lZGdlc0NvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5lZGdlc0NvbnRhaW5lci5pbm5lckhUTUwgPSBcIlwiO1xuXHRcdH1cblx0XHR0aGlzLnNjYWxlID0gMTtcblx0XHR0aGlzLnBhblggPSAwO1xuXHRcdHRoaXMucGFuWSA9IDA7XG5cdH1cblxuXHRhc3luYyBvbk9wZW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXTtcblx0XHRjb250YWluZXIuZW1wdHkoKTtcblx0XHRjb250YWluZXIuYWRkQ2xhc3MoXCJyYWJiaXRtYXAtY29udGFpbmVyXCIpO1xuXG5cdFx0Ly8gQ3JlYXRlIGNhbnZhc1xuXHRcdHRoaXMuY2FudmFzID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtY2FudmFzXCIgfSk7XG5cblx0XHQvLyBDcmVhdGUgU1ZHIGZvciBlZGdlc1xuXHRcdHRoaXMuZWRnZXNDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInN2Z1wiKTtcblx0XHR0aGlzLmVkZ2VzQ29udGFpbmVyLmFkZENsYXNzKFwicmFiYml0bWFwLWVkZ2VzXCIpO1xuXHRcdHRoaXMuY2FudmFzLmFwcGVuZENoaWxkKHRoaXMuZWRnZXNDb250YWluZXIpO1xuXG5cdFx0dGhpcy5ub2Rlc0NvbnRhaW5lciA9IHRoaXMuY2FudmFzLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtbm9kZXNcIiB9KTtcblxuXHRcdC8vIENyZWF0ZSBzZWxlY3Rpb24gYm94XG5cdFx0dGhpcy5zZWxlY3Rpb25Cb3ggPSB0aGlzLmNhbnZhcy5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLXNlbGVjdGlvbi1ib3hcIiB9KTtcblx0XHR0aGlzLnNlbGVjdGlvbkJveC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cblx0XHQvLyBDcmVhdGUgdG9vbGJhclxuXHRcdHRoaXMuY3JlYXRlVG9vbGJhcihjb250YWluZXIpO1xuXG5cdFx0Ly8gQ3JlYXRlIG1pbmltYXBcblx0XHR0aGlzLmNyZWF0ZU1pbmltYXAoY29udGFpbmVyKTtcblxuXHRcdC8vIFNldHVwIGV2ZW50IGxpc3RlbmVyc1xuXHRcdHRoaXMuc2V0dXBFdmVudExpc3RlbmVycygpO1xuXG5cdFx0dGhpcy51cGRhdGVUcmFuc2Zvcm0oKTtcblx0fVxuXG5cdHByaXZhdGUgdHJpZ2dlclNhdmUoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmlzTG9hZGVkIHx8ICF0aGlzLmZpbGUpIHJldHVybjtcblxuXHRcdC8vIERlYm91bmNlIHNhdmVzXG5cdFx0aWYgKHRoaXMuc2F2ZVRpbWVvdXQpIHtcblx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5zYXZlVGltZW91dCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5zYXZlVGltZW91dCA9IHdpbmRvdy5zZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcblx0XHRcdGlmICghdGhpcy5maWxlKSByZXR1cm47XG5cblx0XHRcdHRoaXMuaXNTYXZpbmcgPSB0cnVlO1xuXHRcdFx0YXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KHRoaXMuZmlsZSwgdGhpcy5nZXRWaWV3RGF0YSgpKTtcblx0XHRcdC8vIFJlc2V0IGZsYWcgYWZ0ZXIgYSBzaG9ydCBkZWxheSB0byBjYXRjaCBhbnkgc2V0Vmlld0RhdGEgY2FsbHNcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmlzU2F2aW5nID0gZmFsc2U7XG5cdFx0XHR9LCAxMDApO1xuXHRcdH0sIDMwMCk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZU1pbmltYXAoY29udGFpbmVyOiBFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5taW5pbWFwID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtbWluaW1hcFwiIH0pO1xuXHRcdHRoaXMubWluaW1hcENvbnRlbnQgPSB0aGlzLm1pbmltYXAuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1taW5pbWFwLWNvbnRlbnRcIiB9KTtcblx0XHR0aGlzLm1pbmltYXBWaWV3cG9ydCA9IHRoaXMubWluaW1hcC5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLW1pbmltYXAtdmlld3BvcnRcIiB9KTtcblxuXHRcdC8vIENsaWNrIG9uIG1pbmltYXAgdG8gbmF2aWdhdGVcblx0XHR0aGlzLm1pbmltYXAuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCAoZSkgPT4ge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dGhpcy5uYXZpZ2F0ZUZyb21NaW5pbWFwKGUpO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5taW5pbWFwLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIiwgKGUpID0+IHtcblx0XHRcdGlmIChlLmJ1dHRvbnMgPT09IDEpIHtcblx0XHRcdFx0dGhpcy5uYXZpZ2F0ZUZyb21NaW5pbWFwKGUpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBuYXZpZ2F0ZUZyb21NaW5pbWFwKGU6IE1vdXNlRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCBib3VuZHMgPSB0aGlzLmdldENvbnRlbnRCb3VuZHMoKTtcblx0XHRpZiAoIWJvdW5kcykgcmV0dXJuO1xuXG5cdFx0Y29uc3QgcmVjdCA9IHRoaXMubWluaW1hcC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRjb25zdCBjYW52YXNSZWN0ID0gdGhpcy5jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cblx0XHQvLyBDbGljayBwb3NpdGlvbiByZWxhdGl2ZSB0byBtaW5pbWFwXG5cdFx0Y29uc3QgY2xpY2tYID0gZS5jbGllbnRYIC0gcmVjdC5sZWZ0O1xuXHRcdGNvbnN0IGNsaWNrWSA9IGUuY2xpZW50WSAtIHJlY3QudG9wO1xuXG5cdFx0Ly8gTWluaW1hcCBkaW1lbnNpb25zXG5cdFx0Y29uc3QgbWluaW1hcFdpZHRoID0gcmVjdC53aWR0aDtcblx0XHRjb25zdCBtaW5pbWFwSGVpZ2h0ID0gcmVjdC5oZWlnaHQ7XG5cblx0XHQvLyBDb250ZW50IGJvdW5kcyB3aXRoIHBhZGRpbmdcblx0XHRjb25zdCBwYWRkaW5nID0gNTA7XG5cdFx0Y29uc3QgY29udGVudFdpZHRoID0gYm91bmRzLm1heFggLSBib3VuZHMubWluWCArIHBhZGRpbmcgKiAyO1xuXHRcdGNvbnN0IGNvbnRlbnRIZWlnaHQgPSBib3VuZHMubWF4WSAtIGJvdW5kcy5taW5ZICsgcGFkZGluZyAqIDI7XG5cblx0XHQvLyBTY2FsZSBmcm9tIG1pbmltYXAgdG8gY2FudmFzXG5cdFx0Y29uc3QgbWluaW1hcFNjYWxlID0gTWF0aC5taW4obWluaW1hcFdpZHRoIC8gY29udGVudFdpZHRoLCBtaW5pbWFwSGVpZ2h0IC8gY29udGVudEhlaWdodCk7XG5cblx0XHQvLyBPZmZzZXQgZm9yIGNlbnRlcmluZyBjb250ZW50IGluIG1pbmltYXBcblx0XHRjb25zdCBjb250ZW50U2NhbGVkV2lkdGggPSBjb250ZW50V2lkdGggKiBtaW5pbWFwU2NhbGU7XG5cdFx0Y29uc3QgY29udGVudFNjYWxlZEhlaWdodCA9IGNvbnRlbnRIZWlnaHQgKiBtaW5pbWFwU2NhbGU7XG5cdFx0Y29uc3Qgb2Zmc2V0WCA9IChtaW5pbWFwV2lkdGggLSBjb250ZW50U2NhbGVkV2lkdGgpIC8gMjtcblx0XHRjb25zdCBvZmZzZXRZID0gKG1pbmltYXBIZWlnaHQgLSBjb250ZW50U2NhbGVkSGVpZ2h0KSAvIDI7XG5cblx0XHQvLyBDb252ZXJ0IGNsaWNrIHRvIGNhbnZhcyBjb29yZGluYXRlc1xuXHRcdGNvbnN0IGNhbnZhc1ggPSAoY2xpY2tYIC0gb2Zmc2V0WCkgLyBtaW5pbWFwU2NhbGUgKyBib3VuZHMubWluWCAtIHBhZGRpbmc7XG5cdFx0Y29uc3QgY2FudmFzWSA9IChjbGlja1kgLSBvZmZzZXRZKSAvIG1pbmltYXBTY2FsZSArIGJvdW5kcy5taW5ZIC0gcGFkZGluZztcblxuXHRcdC8vIENlbnRlciB2aWV3IG9uIGNsaWNrZWQgcG9pbnRcblx0XHR0aGlzLnBhblggPSBjYW52YXNSZWN0LndpZHRoIC8gMiAtIGNhbnZhc1ggKiB0aGlzLnNjYWxlO1xuXHRcdHRoaXMucGFuWSA9IGNhbnZhc1JlY3QuaGVpZ2h0IC8gMiAtIGNhbnZhc1kgKiB0aGlzLnNjYWxlO1xuXG5cdFx0Ly8gQ2xhbXAgcGFuXG5cdFx0Y29uc3QgY2xhbXBlZCA9IHRoaXMuY2xhbXBQYW4odGhpcy5wYW5YLCB0aGlzLnBhblkpO1xuXHRcdHRoaXMucGFuWCA9IGNsYW1wZWQueDtcblx0XHR0aGlzLnBhblkgPSBjbGFtcGVkLnk7XG5cblx0XHR0aGlzLnVwZGF0ZVRyYW5zZm9ybSgpO1xuXHRcdHRoaXMudHJpZ2dlclNhdmUoKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlTWluaW1hcCgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMubWluaW1hcCkgcmV0dXJuO1xuXG5cdFx0Y29uc3QgYm91bmRzID0gdGhpcy5nZXRDb250ZW50Qm91bmRzKCk7XG5cdFx0aWYgKCFib3VuZHMpIHtcblx0XHRcdHRoaXMubWluaW1hcFZpZXdwb3J0LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjYW52YXNSZWN0ID0gdGhpcy5jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0Y29uc3QgbWluaW1hcFJlY3QgPSB0aGlzLm1pbmltYXAuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cblx0XHQvLyBDb250ZW50IGJvdW5kcyB3aXRoIHBhZGRpbmdcblx0XHRjb25zdCBwYWRkaW5nID0gNTA7XG5cdFx0Y29uc3QgY29udGVudE1pblggPSBib3VuZHMubWluWCAtIHBhZGRpbmc7XG5cdFx0Y29uc3QgY29udGVudE1pblkgPSBib3VuZHMubWluWSAtIHBhZGRpbmc7XG5cdFx0Y29uc3QgY29udGVudFdpZHRoID0gYm91bmRzLm1heFggLSBib3VuZHMubWluWCArIHBhZGRpbmcgKiAyO1xuXHRcdGNvbnN0IGNvbnRlbnRIZWlnaHQgPSBib3VuZHMubWF4WSAtIGJvdW5kcy5taW5ZICsgcGFkZGluZyAqIDI7XG5cblx0XHQvLyBTY2FsZSB0byBmaXQgaW4gbWluaW1hcFxuXHRcdGNvbnN0IG1pbmltYXBTY2FsZSA9IE1hdGgubWluKFxuXHRcdFx0bWluaW1hcFJlY3Qud2lkdGggLyBjb250ZW50V2lkdGgsXG5cdFx0XHRtaW5pbWFwUmVjdC5oZWlnaHQgLyBjb250ZW50SGVpZ2h0XG5cdFx0KTtcblxuXHRcdC8vIE9mZnNldCBmb3IgY2VudGVyaW5nXG5cdFx0Y29uc3QgY29udGVudFNjYWxlZFdpZHRoID0gY29udGVudFdpZHRoICogbWluaW1hcFNjYWxlO1xuXHRcdGNvbnN0IGNvbnRlbnRTY2FsZWRIZWlnaHQgPSBjb250ZW50SGVpZ2h0ICogbWluaW1hcFNjYWxlO1xuXHRcdGNvbnN0IG9mZnNldFggPSAobWluaW1hcFJlY3Qud2lkdGggLSBjb250ZW50U2NhbGVkV2lkdGgpIC8gMjtcblx0XHRjb25zdCBvZmZzZXRZID0gKG1pbmltYXBSZWN0LmhlaWdodCAtIGNvbnRlbnRTY2FsZWRIZWlnaHQpIC8gMjtcblxuXHRcdC8vIFVwZGF0ZSBtaW5pbWFwIG5vZGVzXG5cdFx0Zm9yIChjb25zdCBbbm9kZUlkLCBub2RlXSBvZiB0aGlzLm5vZGVzKSB7XG5cdFx0XHRsZXQgbWluaW1hcE5vZGUgPSB0aGlzLm1pbmltYXBOb2Rlcy5nZXQobm9kZUlkKTtcblx0XHRcdGlmICghbWluaW1hcE5vZGUpIHtcblx0XHRcdFx0bWluaW1hcE5vZGUgPSB0aGlzLm1pbmltYXBDb250ZW50LmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtbWluaW1hcC1ub2RlXCIgfSk7XG5cdFx0XHRcdGlmIChub2RlLnR5cGUgPT09IFwiY2hhdFwiKSB7XG5cdFx0XHRcdFx0bWluaW1hcE5vZGUuYWRkQ2xhc3MoXCJyYWJiaXRtYXAtbWluaW1hcC1ub2RlLWNoYXRcIik7XG5cdFx0XHRcdH0gZWxzZSBpZiAobm9kZS50eXBlID09PSBcImxpbmtcIikge1xuXHRcdFx0XHRcdG1pbmltYXBOb2RlLmFkZENsYXNzKFwicmFiYml0bWFwLW1pbmltYXAtbm9kZS1saW5rXCIpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKG5vZGUudHlwZSA9PT0gXCJub3RlXCIpIHtcblx0XHRcdFx0XHRtaW5pbWFwTm9kZS5hZGRDbGFzcyhcInJhYmJpdG1hcC1taW5pbWFwLW5vZGUtbm90ZVwiKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLm1pbmltYXBOb2Rlcy5zZXQobm9kZUlkLCBtaW5pbWFwTm9kZSk7XG5cdFx0XHR9XG5cblx0XHRcdG1pbmltYXBOb2RlLnN0eWxlLmxlZnQgPSBgJHtvZmZzZXRYICsgKG5vZGUueCAtIGNvbnRlbnRNaW5YKSAqIG1pbmltYXBTY2FsZX1weGA7XG5cdFx0XHRtaW5pbWFwTm9kZS5zdHlsZS50b3AgPSBgJHtvZmZzZXRZICsgKG5vZGUueSAtIGNvbnRlbnRNaW5ZKSAqIG1pbmltYXBTY2FsZX1weGA7XG5cdFx0XHRtaW5pbWFwTm9kZS5zdHlsZS53aWR0aCA9IGAke25vZGUud2lkdGggKiBtaW5pbWFwU2NhbGV9cHhgO1xuXHRcdFx0bWluaW1hcE5vZGUuc3R5bGUuaGVpZ2h0ID0gYCR7bm9kZS5oZWlnaHQgKiBtaW5pbWFwU2NhbGV9cHhgO1xuXHRcdH1cblxuXHRcdC8vIFJlbW92ZSBkZWxldGVkIG5vZGVzIGZyb20gbWluaW1hcFxuXHRcdGZvciAoY29uc3QgW25vZGVJZCwgZWxdIG9mIHRoaXMubWluaW1hcE5vZGVzKSB7XG5cdFx0XHRpZiAoIXRoaXMubm9kZXMuaGFzKG5vZGVJZCkpIHtcblx0XHRcdFx0ZWwucmVtb3ZlKCk7XG5cdFx0XHRcdHRoaXMubWluaW1hcE5vZGVzLmRlbGV0ZShub2RlSWQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZSB2aWV3cG9ydCBpbmRpY2F0b3Jcblx0XHR0aGlzLm1pbmltYXBWaWV3cG9ydC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuXHRcdGNvbnN0IHZpZXdMZWZ0ID0gKC10aGlzLnBhblggLyB0aGlzLnNjYWxlIC0gY29udGVudE1pblgpICogbWluaW1hcFNjYWxlICsgb2Zmc2V0WDtcblx0XHRjb25zdCB2aWV3VG9wID0gKC10aGlzLnBhblkgLyB0aGlzLnNjYWxlIC0gY29udGVudE1pblkpICogbWluaW1hcFNjYWxlICsgb2Zmc2V0WTtcblx0XHRjb25zdCB2aWV3V2lkdGggPSAoY2FudmFzUmVjdC53aWR0aCAvIHRoaXMuc2NhbGUpICogbWluaW1hcFNjYWxlO1xuXHRcdGNvbnN0IHZpZXdIZWlnaHQgPSAoY2FudmFzUmVjdC5oZWlnaHQgLyB0aGlzLnNjYWxlKSAqIG1pbmltYXBTY2FsZTtcblxuXHRcdHRoaXMubWluaW1hcFZpZXdwb3J0LnN0eWxlLmxlZnQgPSBgJHt2aWV3TGVmdH1weGA7XG5cdFx0dGhpcy5taW5pbWFwVmlld3BvcnQuc3R5bGUudG9wID0gYCR7dmlld1RvcH1weGA7XG5cdFx0dGhpcy5taW5pbWFwVmlld3BvcnQuc3R5bGUud2lkdGggPSBgJHt2aWV3V2lkdGh9cHhgO1xuXHRcdHRoaXMubWluaW1hcFZpZXdwb3J0LnN0eWxlLmhlaWdodCA9IGAke3ZpZXdIZWlnaHR9cHhgO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVUb29sYmFyKGNvbnRhaW5lcjogRWxlbWVudCk6IHZvaWQge1xuXHRcdGNvbnN0IHRvb2xiYXIgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC10b29sYmFyXCIgfSk7XG5cblx0XHQvLyBBZGQgZWxlbWVudHMgYnV0dG9uXG5cdFx0Y29uc3QgYWRkQ2FyZEJ0biA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwicmFiYml0bWFwLWJ0biByYWJiaXRtYXAtYnRuLWljb25cIiwgYXR0cjogeyB0aXRsZTogXCJBZGQgQ2FyZFwiIH0gfSk7XG5cdFx0YWRkQ2FyZEJ0bi5pbm5lckhUTUwgPSBgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgd2lkdGg9XCIxOFwiIGhlaWdodD1cIjE4XCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPjxyZWN0IHg9XCIzXCIgeT1cIjNcIiB3aWR0aD1cIjE4XCIgaGVpZ2h0PVwiMThcIiByeD1cIjJcIi8+PGxpbmUgeDE9XCIxMlwiIHkxPVwiOFwiIHgyPVwiMTJcIiB5Mj1cIjE2XCIvPjxsaW5lIHgxPVwiOFwiIHkxPVwiMTJcIiB4Mj1cIjE2XCIgeTI9XCIxMlwiLz48L3N2Zz5gO1xuXHRcdGFkZENhcmRCdG4ub25jbGljayA9ICgpID0+IHRoaXMuYWRkQ2FyZEF0Q2VudGVyKCk7XG5cblx0XHRjb25zdCBhZGRDaGF0QnRuID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJyYWJiaXRtYXAtYnRuIHJhYmJpdG1hcC1idG4taWNvblwiLCBhdHRyOiB7IHRpdGxlOiBcIkFkZCBDaGF0XCIgfSB9KTtcblx0XHRhZGRDaGF0QnRuLmlubmVySFRNTCA9IGA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB3aWR0aD1cIjE4XCIgaGVpZ2h0PVwiMThcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PHBhdGggZD1cIk0yMSAxNWEyIDIgMCAwIDEtMiAySDdsLTQgNFY1YTIgMiAwIDAgMSAyLTJoMTRhMiAyIDAgMCAxIDIgMnpcIi8+PC9zdmc+YDtcblx0XHRhZGRDaGF0QnRuLm9uY2xpY2sgPSAoKSA9PiB0aGlzLmFkZENoYXRBdENlbnRlcigpO1xuXG5cdFx0Y29uc3QgYWRkTGlua0J0biA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwicmFiYml0bWFwLWJ0biByYWJiaXRtYXAtYnRuLWljb25cIiwgYXR0cjogeyB0aXRsZTogXCJBZGQgTGlua1wiIH0gfSk7XG5cdFx0YWRkTGlua0J0bi5pbm5lckhUTUwgPSBgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgd2lkdGg9XCIxOFwiIGhlaWdodD1cIjE4XCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPjxwYXRoIGQ9XCJNMTAgMTNhNSA1IDAgMCAwIDcuNTQuNTRsMy0zYTUgNSAwIDAgMC03LjA3LTcuMDdsLTEuNzIgMS43MVwiLz48cGF0aCBkPVwiTTE0IDExYTUgNSAwIDAgMC03LjU0LS41NGwtMyAzYTUgNSAwIDAgMCA3LjA3IDcuMDdsMS43MS0xLjcxXCIvPjwvc3ZnPmA7XG5cdFx0YWRkTGlua0J0bi5vbmNsaWNrID0gKCkgPT4gdGhpcy5zaG93QWRkTGlua01vZGFsKCk7XG5cblx0XHQvLyBTZXBhcmF0b3Jcblx0XHR0b29sYmFyLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtdG9vbGJhci1zZXBhcmF0b3JcIiB9KTtcblxuXHRcdC8vIFNldHRpbmdzIGJ1dHRvblxuXHRcdGNvbnN0IHNldHRpbmdzQnRuID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJyYWJiaXRtYXAtYnRuIHJhYmJpdG1hcC1idG4taWNvblwiLCBhdHRyOiB7IHRpdGxlOiBcIlNldHRpbmdzXCIgfSB9KTtcblx0XHRzZXR0aW5nc0J0bi5pbm5lckhUTUwgPSBgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgd2lkdGg9XCIxOFwiIGhlaWdodD1cIjE4XCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPjxjaXJjbGUgY3g9XCIxMlwiIGN5PVwiMTJcIiByPVwiM1wiLz48cGF0aCBkPVwiTTE5LjQgMTVhMS42NSAxLjY1IDAgMCAwIC4zMyAxLjgybC4wNi4wNmEyIDIgMCAwIDEgMCAyLjgzIDIgMiAwIDAgMS0yLjgzIDBsLS4wNi0uMDZhMS42NSAxLjY1IDAgMCAwLTEuODItLjMzIDEuNjUgMS42NSAwIDAgMC0xIDEuNTFWMjFhMiAyIDAgMCAxLTIgMiAyIDIgMCAwIDEtMi0ydi0uMDlBMS42NSAxLjY1IDAgMCAwIDkgMTkuNGExLjY1IDEuNjUgMCAwIDAtMS44Mi4zM2wtLjA2LjA2YTIgMiAwIDAgMS0yLjgzIDAgMiAyIDAgMCAxIDAtMi44M2wuMDYtLjA2YTEuNjUgMS42NSAwIDAgMCAuMzMtMS44MiAxLjY1IDEuNjUgMCAwIDAtMS41MS0xSDNhMiAyIDAgMCAxLTItMiAyIDIgMCAwIDEgMi0yaC4wOUExLjY1IDEuNjUgMCAwIDAgNC42IDlhMS42NSAxLjY1IDAgMCAwLS4zMy0xLjgybC0uMDYtLjA2YTIgMiAwIDAgMSAwLTIuODMgMiAyIDAgMCAxIDIuODMgMGwuMDYuMDZhMS42NSAxLjY1IDAgMCAwIDEuODIuMzNIOWExLjY1IDEuNjUgMCAwIDAgMS0xLjUxVjNhMiAyIDAgMCAxIDItMiAyIDIgMCAwIDEgMiAydi4wOWExLjY1IDEuNjUgMCAwIDAgMSAxLjUxIDEuNjUgMS42NSAwIDAgMCAxLjgyLS4zM2wuMDYtLjA2YTIgMiAwIDAgMSAyLjgzIDAgMiAyIDAgMCAxIDAgMi44M2wtLjA2LjA2YTEuNjUgMS42NSAwIDAgMC0uMzMgMS44MlY5YTEuNjUgMS42NSAwIDAgMCAxLjUxIDFIMjFhMiAyIDAgMCAxIDIgMiAyIDIgMCAwIDEtMiAyaC0uMDlhMS42NSAxLjY1IDAgMCAwLTEuNTEgMXpcIi8+PC9zdmc+YDtcblx0XHRzZXR0aW5nc0J0bi5vbmNsaWNrID0gKCkgPT4gdGhpcy5vcGVuU2V0dGluZ3MoKTtcblx0fVxuXG5cdHByaXZhdGUgb3BlblNldHRpbmdzKCk6IHZvaWQge1xuXHRcdG5ldyBTZXR0aW5nc01vZGFsKHRoaXMuYXBwLCB0aGlzLnBsdWdpbikub3BlbigpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXR1cEV2ZW50TGlzdGVuZXJzKCk6IHZvaWQge1xuXHRcdC8vIE1vdXNlIHdoZWVsIC8gdHJhY2twYWQgaGFuZGxpbmdcblx0XHR0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKFwid2hlZWxcIiwgKGUpID0+IHtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0Ly8gUGluY2ggdG8gem9vbSAoY3RybEtleSBpcyBzZXQgZm9yIHBpbmNoIGdlc3R1cmVzIG9uIHRyYWNrcGFkKVxuXHRcdFx0aWYgKGUuY3RybEtleSB8fCBlLm1ldGFLZXkpIHtcblx0XHRcdFx0Y29uc3QgZGVsdGEgPSAtZS5kZWx0YVkgKiAwLjAxOyAvLyBTbG93ZXIgem9vbVxuXHRcdFx0XHR0aGlzLnpvb21BdFBvaW50KGRlbHRhLCBlLmNsaWVudFgsIGUuY2xpZW50WSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBUd28tZmluZ2VyIHNjcm9sbCA9IHBhblxuXHRcdFx0XHRsZXQgbmV3UGFuWCA9IHRoaXMucGFuWCAtIGUuZGVsdGFYO1xuXHRcdFx0XHRsZXQgbmV3UGFuWSA9IHRoaXMucGFuWSAtIGUuZGVsdGFZO1xuXG5cdFx0XHRcdC8vIENsYW1wIHBhbiB0byBrZWVwIGNvbnRlbnQgdmlzaWJsZVxuXHRcdFx0XHRjb25zdCBjbGFtcGVkID0gdGhpcy5jbGFtcFBhbihuZXdQYW5YLCBuZXdQYW5ZKTtcblx0XHRcdFx0dGhpcy5wYW5YID0gY2xhbXBlZC54O1xuXHRcdFx0XHR0aGlzLnBhblkgPSBjbGFtcGVkLnk7XG5cdFx0XHRcdHRoaXMudXBkYXRlVHJhbnNmb3JtKCk7XG5cdFx0XHRcdHRoaXMudHJpZ2dlclNhdmUoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vIFBhbiB3aXRoIG1pZGRsZSBtb3VzZSBvciBzcGFjZSArIGxlZnQgbW91c2UsIG9yIHN0YXJ0IHNlbGVjdGlvblxuXHRcdHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgKGUpID0+IHtcblx0XHRcdGlmIChlLmJ1dHRvbiA9PT0gMSB8fCAoZS5idXR0b24gPT09IDAgJiYgdGhpcy5zcGFjZVByZXNzZWQpKSB7XG5cdFx0XHRcdC8vIFBhbm5pbmdcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR0aGlzLmlzUGFubmluZyA9IHRydWU7XG5cdFx0XHRcdHRoaXMucGFuU3RhcnRYID0gZS5jbGllbnRYIC0gdGhpcy5wYW5YO1xuXHRcdFx0XHR0aGlzLnBhblN0YXJ0WSA9IGUuY2xpZW50WSAtIHRoaXMucGFuWTtcblx0XHRcdFx0dGhpcy5jYW52YXMuYWRkQ2xhc3MoXCJwYW5uaW5nXCIpO1xuXHRcdFx0fSBlbHNlIGlmIChlLmJ1dHRvbiA9PT0gMCAmJiBlLnRhcmdldCA9PT0gdGhpcy5jYW52YXMpIHtcblx0XHRcdFx0Ly8gU3RhcnQgc2VsZWN0aW9uIGJveCAob25seSBpZiBjbGlja2luZyBvbiBjYW52YXMgaXRzZWxmLCBub3Qgb24gbm9kZXMpXG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0dGhpcy5pc1NlbGVjdGluZyA9IHRydWU7XG5cdFx0XHRcdGNvbnN0IHJlY3QgPSB0aGlzLmNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdFx0dGhpcy5zZWxlY3Rpb25TdGFydFggPSBlLmNsaWVudFggLSByZWN0LmxlZnQ7XG5cdFx0XHRcdHRoaXMuc2VsZWN0aW9uU3RhcnRZID0gZS5jbGllbnRZIC0gcmVjdC50b3A7XG5cblx0XHRcdFx0aWYgKHRoaXMuc2VsZWN0aW9uQm94KSB7XG5cdFx0XHRcdFx0dGhpcy5zZWxlY3Rpb25Cb3guc3R5bGUubGVmdCA9IGAke3RoaXMuc2VsZWN0aW9uU3RhcnRYfXB4YDtcblx0XHRcdFx0XHR0aGlzLnNlbGVjdGlvbkJveC5zdHlsZS50b3AgPSBgJHt0aGlzLnNlbGVjdGlvblN0YXJ0WX1weGA7XG5cdFx0XHRcdFx0dGhpcy5zZWxlY3Rpb25Cb3guc3R5bGUud2lkdGggPSBcIjBweFwiO1xuXHRcdFx0XHRcdHRoaXMuc2VsZWN0aW9uQm94LnN0eWxlLmhlaWdodCA9IFwiMHB4XCI7XG5cdFx0XHRcdFx0dGhpcy5zZWxlY3Rpb25Cb3guc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIENsZWFyIHNlbGVjdGlvbiBpZiBub3QgaG9sZGluZyBzaGlmdFxuXHRcdFx0XHRpZiAoIWUuc2hpZnRLZXkpIHtcblx0XHRcdFx0XHR0aGlzLmNsZWFyU2VsZWN0aW9uKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIiwgKGUpID0+IHtcblx0XHRcdGlmICh0aGlzLmlzUGFubmluZykge1xuXHRcdFx0XHRsZXQgbmV3UGFuWCA9IGUuY2xpZW50WCAtIHRoaXMucGFuU3RhcnRYO1xuXHRcdFx0XHRsZXQgbmV3UGFuWSA9IGUuY2xpZW50WSAtIHRoaXMucGFuU3RhcnRZO1xuXG5cdFx0XHRcdC8vIENsYW1wIHBhbiB0byBrZWVwIGNvbnRlbnQgdmlzaWJsZVxuXHRcdFx0XHRjb25zdCBjbGFtcGVkID0gdGhpcy5jbGFtcFBhbihuZXdQYW5YLCBuZXdQYW5ZKTtcblx0XHRcdFx0dGhpcy5wYW5YID0gY2xhbXBlZC54O1xuXHRcdFx0XHR0aGlzLnBhblkgPSBjbGFtcGVkLnk7XG5cdFx0XHRcdHRoaXMudXBkYXRlVHJhbnNmb3JtKCk7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuaXNTZWxlY3RpbmcgJiYgdGhpcy5zZWxlY3Rpb25Cb3gpIHtcblx0XHRcdFx0Ly8gVXBkYXRlIHNlbGVjdGlvbiBib3hcblx0XHRcdFx0Y29uc3QgcmVjdCA9IHRoaXMuY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0XHRjb25zdCBjdXJyZW50WCA9IGUuY2xpZW50WCAtIHJlY3QubGVmdDtcblx0XHRcdFx0Y29uc3QgY3VycmVudFkgPSBlLmNsaWVudFkgLSByZWN0LnRvcDtcblxuXHRcdFx0XHRjb25zdCBsZWZ0ID0gTWF0aC5taW4odGhpcy5zZWxlY3Rpb25TdGFydFgsIGN1cnJlbnRYKTtcblx0XHRcdFx0Y29uc3QgdG9wID0gTWF0aC5taW4odGhpcy5zZWxlY3Rpb25TdGFydFksIGN1cnJlbnRZKTtcblx0XHRcdFx0Y29uc3Qgd2lkdGggPSBNYXRoLmFicyhjdXJyZW50WCAtIHRoaXMuc2VsZWN0aW9uU3RhcnRYKTtcblx0XHRcdFx0Y29uc3QgaGVpZ2h0ID0gTWF0aC5hYnMoY3VycmVudFkgLSB0aGlzLnNlbGVjdGlvblN0YXJ0WSk7XG5cblx0XHRcdFx0dGhpcy5zZWxlY3Rpb25Cb3guc3R5bGUubGVmdCA9IGAke2xlZnR9cHhgO1xuXHRcdFx0XHR0aGlzLnNlbGVjdGlvbkJveC5zdHlsZS50b3AgPSBgJHt0b3B9cHhgO1xuXHRcdFx0XHR0aGlzLnNlbGVjdGlvbkJveC5zdHlsZS53aWR0aCA9IGAke3dpZHRofXB4YDtcblx0XHRcdFx0dGhpcy5zZWxlY3Rpb25Cb3guc3R5bGUuaGVpZ2h0ID0gYCR7aGVpZ2h0fXB4YDtcblxuXHRcdFx0XHQvLyBVcGRhdGUgc2VsZWN0aW9uIGJhc2VkIG9uIGludGVyc2VjdGlvblxuXHRcdFx0XHR0aGlzLnVwZGF0ZVNlbGVjdGlvbkZyb21Cb3gobGVmdCwgdG9wLCB3aWR0aCwgaGVpZ2h0KTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5pc0RyYXdpbmdFZGdlICYmIHRoaXMuZWRnZURyYXdUZW1wTGluZSkge1xuXHRcdFx0XHRjb25zdCByZWN0ID0gdGhpcy5jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRcdGNvbnN0IGNhbnZhc1ggPSAoZS5jbGllbnRYIC0gcmVjdC5sZWZ0IC0gdGhpcy5wYW5YKSAvIHRoaXMuc2NhbGU7XG5cdFx0XHRcdGNvbnN0IGNhbnZhc1kgPSAoZS5jbGllbnRZIC0gcmVjdC50b3AgLSB0aGlzLnBhblkpIC8gdGhpcy5zY2FsZTtcblx0XHRcdFx0dGhpcy5lZGdlRHJhd1RlbXBMaW5lLnNldEF0dHJpYnV0ZShcIngyXCIsIFN0cmluZyhjYW52YXNYKSk7XG5cdFx0XHRcdHRoaXMuZWRnZURyYXdUZW1wTGluZS5zZXRBdHRyaWJ1dGUoXCJ5MlwiLCBTdHJpbmcoY2FudmFzWSkpO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLmRyYWdnZWROb2RlKSB7XG5cdFx0XHRcdGNvbnN0IHJlY3QgPSB0aGlzLmNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdFx0Y29uc3QgbW91c2VYID0gKGUuY2xpZW50WCAtIHJlY3QubGVmdCAtIHRoaXMucGFuWCkgLyB0aGlzLnNjYWxlO1xuXHRcdFx0XHRjb25zdCBtb3VzZVkgPSAoZS5jbGllbnRZIC0gcmVjdC50b3AgLSB0aGlzLnBhblkpIC8gdGhpcy5zY2FsZTtcblxuXHRcdFx0XHQvLyBJZiBkcmFnZ2luZyBhIHNlbGVjdGVkIG5vZGUsIG1vdmUgYWxsIHNlbGVjdGVkIG5vZGVzXG5cdFx0XHRcdGlmICh0aGlzLnNlbGVjdGVkTm9kZXMuaGFzKHRoaXMuZHJhZ2dlZE5vZGUpICYmIHRoaXMuc2VsZWN0ZWROb2Rlcy5zaXplID4gMCkge1xuXHRcdFx0XHRcdGNvbnN0IGRlbHRhWCA9IG1vdXNlWCAtIHRoaXMuZHJhZ1N0YXJ0TW91c2VYO1xuXHRcdFx0XHRcdGNvbnN0IGRlbHRhWSA9IG1vdXNlWSAtIHRoaXMuZHJhZ1N0YXJ0TW91c2VZO1xuXG5cdFx0XHRcdFx0Zm9yIChjb25zdCBub2RlSWQgb2YgdGhpcy5zZWxlY3RlZE5vZGVzKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBzdGFydFBvcyA9IHRoaXMuZHJhZ1N0YXJ0UG9zaXRpb25zLmdldChub2RlSWQpO1xuXHRcdFx0XHRcdFx0aWYgKHN0YXJ0UG9zKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMudXBkYXRlTm9kZVBvc2l0aW9uKG5vZGVJZCwgc3RhcnRQb3MueCArIGRlbHRhWCwgc3RhcnRQb3MueSArIGRlbHRhWSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IHggPSBtb3VzZVggLSB0aGlzLmRyYWdPZmZzZXRYO1xuXHRcdFx0XHRcdGNvbnN0IHkgPSBtb3VzZVkgLSB0aGlzLmRyYWdPZmZzZXRZO1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlTm9kZVBvc2l0aW9uKHRoaXMuZHJhZ2dlZE5vZGUsIHgsIHkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMucmVzaXppbmdOb2RlKSB7XG5cdFx0XHRcdGNvbnN0IGRlbHRhWCA9IChlLmNsaWVudFggLSB0aGlzLnJlc2l6ZVN0YXJ0WCkgLyB0aGlzLnNjYWxlO1xuXHRcdFx0XHRjb25zdCBkZWx0YVkgPSAoZS5jbGllbnRZIC0gdGhpcy5yZXNpemVTdGFydFkpIC8gdGhpcy5zY2FsZTtcblx0XHRcdFx0Y29uc3QgbmV3V2lkdGggPSBNYXRoLm1heCgyMDAsIHRoaXMucmVzaXplU3RhcnRXaWR0aCArIGRlbHRhWCk7XG5cdFx0XHRcdGNvbnN0IG5ld0hlaWdodCA9IE1hdGgubWF4KDE1MCwgdGhpcy5yZXNpemVTdGFydEhlaWdodCArIGRlbHRhWSk7XG5cdFx0XHRcdHRoaXMudXBkYXRlTm9kZVNpemUodGhpcy5yZXNpemluZ05vZGUsIG5ld1dpZHRoLCBuZXdIZWlnaHQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNldXBcIiwgKGUpID0+IHtcblx0XHRcdC8vIEVkZ2UgZHJhd2luZyBjb21wbGV0aW9uXG5cdFx0XHRpZiAodGhpcy5pc0RyYXdpbmdFZGdlKSB7XG5cdFx0XHRcdGNvbnN0IHRhcmdldEluZm8gPSB0aGlzLmZpbmRUYXJnZXRIYW5kbGUoZSk7XG5cdFx0XHRcdGlmICh0YXJnZXRJbmZvICYmIHRhcmdldEluZm8ubm9kZUlkICE9PSB0aGlzLmVkZ2VEcmF3RnJvbU5vZGUpIHtcblx0XHRcdFx0XHQvLyBDaGVjayBmb3IgZHVwbGljYXRlIGVkZ2VzXG5cdFx0XHRcdFx0Y29uc3QgZHVwbGljYXRlID0gQXJyYXkuZnJvbSh0aGlzLmVkZ2VzLnZhbHVlcygpKS5zb21lKFxuXHRcdFx0XHRcdFx0KGVkZ2UpID0+XG5cdFx0XHRcdFx0XHRcdChlZGdlLmZyb20gPT09IHRoaXMuZWRnZURyYXdGcm9tTm9kZSAmJiBlZGdlLnRvID09PSB0YXJnZXRJbmZvLm5vZGVJZCkgfHxcblx0XHRcdFx0XHRcdFx0KGVkZ2UuZnJvbSA9PT0gdGFyZ2V0SW5mby5ub2RlSWQgJiYgZWRnZS50byA9PT0gdGhpcy5lZGdlRHJhd0Zyb21Ob2RlKVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0aWYgKCFkdXBsaWNhdGUpIHtcblx0XHRcdFx0XHRcdHRoaXMuYWRkRWRnZSh0aGlzLmVkZ2VEcmF3RnJvbU5vZGUhLCB0YXJnZXRJbmZvLm5vZGVJZCk7XG5cdFx0XHRcdFx0XHR0aGlzLnRyaWdnZXJTYXZlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIENsZWFudXBcblx0XHRcdFx0aWYgKHRoaXMuZWRnZURyYXdUZW1wTGluZSkge1xuXHRcdFx0XHRcdHRoaXMuZWRnZURyYXdUZW1wTGluZS5yZW1vdmUoKTtcblx0XHRcdFx0XHR0aGlzLmVkZ2VEcmF3VGVtcExpbmUgPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuaXNEcmF3aW5nRWRnZSA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLmVkZ2VEcmF3RnJvbU5vZGUgPSBudWxsO1xuXHRcdFx0XHR0aGlzLmVkZ2VEcmF3RnJvbVNpZGUgPSBudWxsO1xuXHRcdFx0XHR0aGlzLmNhbnZhcy5yZW1vdmVDbGFzcyhcImRyYXdpbmctZWRnZVwiKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5pc1Bhbm5pbmcgfHwgdGhpcy5kcmFnZ2VkTm9kZSB8fCB0aGlzLnJlc2l6aW5nTm9kZSkge1xuXHRcdFx0XHR0aGlzLnRyaWdnZXJTYXZlKCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmlzUGFubmluZyA9IGZhbHNlO1xuXHRcdFx0dGhpcy5kcmFnZ2VkTm9kZSA9IG51bGw7XG5cdFx0XHR0aGlzLmRyYWdTdGFydFBvc2l0aW9ucy5jbGVhcigpO1xuXHRcdFx0dGhpcy5yZXNpemluZ05vZGUgPSBudWxsO1xuXHRcdFx0dGhpcy5jYW52YXMucmVtb3ZlQ2xhc3MoXCJwYW5uaW5nXCIpO1xuXG5cdFx0XHQvLyBFbmQgc2VsZWN0aW9uXG5cdFx0XHRpZiAodGhpcy5pc1NlbGVjdGluZyAmJiB0aGlzLnNlbGVjdGlvbkJveCkge1xuXHRcdFx0XHR0aGlzLmlzU2VsZWN0aW5nID0gZmFsc2U7XG5cdFx0XHRcdHRoaXMuc2VsZWN0aW9uQm94LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vIFNwYWNlIGtleSBmb3IgcGFuIG1vZGVcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZSkgPT4ge1xuXHRcdFx0aWYgKGUuY29kZSA9PT0gXCJTcGFjZVwiICYmICF0aGlzLmlzSW5wdXRGb2N1c2VkKCkpIHtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR0aGlzLnNwYWNlUHJlc3NlZCA9IHRydWU7XG5cdFx0XHRcdHRoaXMuY2FudmFzLmFkZENsYXNzKFwicGFuLW1vZGVcIik7XG5cdFx0XHR9XG5cdFx0XHQvLyBEZWxldGUgc2VsZWN0ZWQgbm9kZXNcblx0XHRcdGlmICgoZS5jb2RlID09PSBcIkRlbGV0ZVwiIHx8IGUuY29kZSA9PT0gXCJCYWNrc3BhY2VcIikgJiYgIXRoaXMuaXNJbnB1dEZvY3VzZWQoKSAmJiB0aGlzLnNlbGVjdGVkTm9kZXMuc2l6ZSA+IDApIHtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR0aGlzLmRlbGV0ZVNlbGVjdGVkTm9kZXMoKTtcblx0XHRcdH1cblx0XHRcdC8vIEVzY2FwZSB0byBjbGVhciBzZWxlY3Rpb25cblx0XHRcdGlmIChlLmNvZGUgPT09IFwiRXNjYXBlXCIgJiYgdGhpcy5zZWxlY3RlZE5vZGVzLnNpemUgPiAwKSB7XG5cdFx0XHRcdHRoaXMuY2xlYXJTZWxlY3Rpb24oKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXl1cFwiLCAoZSkgPT4ge1xuXHRcdFx0aWYgKGUuY29kZSA9PT0gXCJTcGFjZVwiKSB7XG5cdFx0XHRcdHRoaXMuc3BhY2VQcmVzc2VkID0gZmFsc2U7XG5cdFx0XHRcdHRoaXMuY2FudmFzLnJlbW92ZUNsYXNzKFwicGFuLW1vZGVcIik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHQvLyBQYXN0ZSBoYW5kbGVyIGZvciBVUkxzXG5cdFx0dGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcihcInBhc3RlXCIsIChlKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5pc0lucHV0Rm9jdXNlZCgpKSByZXR1cm47XG5cdFx0XHRjb25zdCB0ZXh0ID0gZS5jbGlwYm9hcmREYXRhPy5nZXREYXRhKFwidGV4dC9wbGFpblwiKT8udHJpbSgpO1xuXHRcdFx0aWYgKHRleHQgJiYgL15odHRwcz86XFwvXFwvL2kudGVzdCh0ZXh0KSkge1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHRoaXMuYWRkTGlua0F0Q2VudGVyKHRleHQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Ly8gQ2FudmFzLWxldmVsIGRyYWcgYW5kIGRyb3AgZm9yIGltcG9ydGluZyBub3Rlc1xuXHRcdHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnb3ZlclwiLCAoZSkgPT4ge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dGhpcy5jYW52YXMuYWRkQ2xhc3MoXCJyYWJiaXRtYXAtY2FudmFzLWRyYWctb3ZlclwiKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnbGVhdmVcIiwgKGUpID0+IHtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHRoaXMuY2FudmFzLnJlbW92ZUNsYXNzKFwicmFiYml0bWFwLWNhbnZhcy1kcmFnLW92ZXJcIik7XG5cdFx0fSk7XG5cblx0XHR0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKFwiZHJvcFwiLCBhc3luYyAoZSkgPT4ge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dGhpcy5jYW52YXMucmVtb3ZlQ2xhc3MoXCJyYWJiaXRtYXAtY2FudmFzLWRyYWctb3ZlclwiKTtcblxuXHRcdFx0Y29uc3QgcGxhaW5UZXh0ID0gZS5kYXRhVHJhbnNmZXI/LmdldERhdGEoXCJ0ZXh0L3BsYWluXCIpIHx8IFwiXCI7XG5cdFx0XHRpZiAoIXBsYWluVGV4dCkgcmV0dXJuO1xuXG5cdFx0XHRjb25zdCBjYW52YXNSZWN0ID0gdGhpcy5jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRjb25zdCBkcm9wWCA9IChlLmNsaWVudFggLSBjYW52YXNSZWN0LmxlZnQgLSB0aGlzLnBhblgpIC8gdGhpcy5zY2FsZTtcblx0XHRcdGNvbnN0IGRyb3BZID0gKGUuY2xpZW50WSAtIGNhbnZhc1JlY3QudG9wIC0gdGhpcy5wYW5ZKSAvIHRoaXMuc2NhbGU7XG5cblx0XHRcdGNvbnN0IGxpbmVzID0gcGxhaW5UZXh0LnNwbGl0KFwiXFxuXCIpLm1hcChsID0+IGwudHJpbSgpKS5maWx0ZXIobCA9PiBsKTtcblx0XHRcdGxldCBvZmZzZXRJbmRleCA9IDA7XG5cblx0XHRcdGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuXHRcdFx0XHRjb25zdCBwYXRoID0gdGhpcy5wYXJzZVBhdGgobGluZSk7XG5cdFx0XHRcdGlmICghcGF0aCkgY29udGludWU7XG5cblx0XHRcdFx0Ly8gU2tpcCBIVFRQIFVSTHMgXHUyMDE0IHRob3NlIGFyZSBoYW5kbGVkIGJ5IHRoZSBwYXN0ZSBoYW5kbGVyXG5cdFx0XHRcdGlmIChwYXRoLnN0YXJ0c1dpdGgoXCJodHRwXCIpKSB7XG5cdFx0XHRcdFx0dGhpcy5hZGRMaW5rTm9kZShwYXRoLCBkcm9wWCAtIDE1MCArIG9mZnNldEluZGV4ICogMzAsIGRyb3BZIC0gMTAwICsgb2Zmc2V0SW5kZXggKiAzMCk7XG5cdFx0XHRcdFx0b2Zmc2V0SW5kZXgrKztcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFRyeSB0byByZXNvbHZlIGFzIGZpbGUgb3IgZm9sZGVyXG5cdFx0XHRcdGNvbnN0IGl0ZW0gPSB0aGlzLnJlc29sdmVWYXVsdEl0ZW0ocGF0aCk7XG5cblx0XHRcdFx0aWYgKGl0ZW0gaW5zdGFuY2VvZiBURm9sZGVyKSB7XG5cdFx0XHRcdFx0Ly8gQWRkIGFsbCBtYXJrZG93biBmaWxlcyBmcm9tIGZvbGRlciBhcyBub3RlIG5vZGVzXG5cdFx0XHRcdFx0Y29uc3QgbWRGaWxlcyA9IHRoaXMuZ2V0TWRGaWxlc0Zyb21Gb2xkZXIoaXRlbSk7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBmaWxlIG9mIG1kRmlsZXMpIHtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuXHRcdFx0XHRcdFx0XHR0aGlzLmFkZE5vdGVOb2RlKGZpbGUucGF0aCwgY29udGVudCwgZHJvcFggKyBvZmZzZXRJbmRleCAqIDMwLCBkcm9wWSArIG9mZnNldEluZGV4ICogMzApO1xuXHRcdFx0XHRcdFx0XHRvZmZzZXRJbmRleCsrO1xuXHRcdFx0XHRcdFx0fSBjYXRjaCB7fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmIChpdGVtIGluc3RhbmNlb2YgVEZpbGUgJiYgaXRlbS5leHRlbnNpb24gPT09IFwibWRcIikge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChpdGVtKTtcblx0XHRcdFx0XHRcdHRoaXMuYWRkTm90ZU5vZGUoaXRlbS5wYXRoLCBjb250ZW50LCBkcm9wWCArIG9mZnNldEluZGV4ICogMzAsIGRyb3BZICsgb2Zmc2V0SW5kZXggKiAzMCk7XG5cdFx0XHRcdFx0XHRvZmZzZXRJbmRleCsrO1xuXHRcdFx0XHRcdH0gY2F0Y2gge31cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVTZWxlY3Rpb25Gcm9tQm94KGxlZnQ6IG51bWJlciwgdG9wOiBudW1iZXIsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKTogdm9pZCB7XG5cdFx0Ly8gQ29udmVydCBzY3JlZW4gY29vcmRzIHRvIGNhbnZhcyBjb29yZHNcblx0XHRjb25zdCBib3hMZWZ0ID0gKGxlZnQgLSB0aGlzLnBhblgpIC8gdGhpcy5zY2FsZTtcblx0XHRjb25zdCBib3hUb3AgPSAodG9wIC0gdGhpcy5wYW5ZKSAvIHRoaXMuc2NhbGU7XG5cdFx0Y29uc3QgYm94UmlnaHQgPSAobGVmdCArIHdpZHRoIC0gdGhpcy5wYW5YKSAvIHRoaXMuc2NhbGU7XG5cdFx0Y29uc3QgYm94Qm90dG9tID0gKHRvcCArIGhlaWdodCAtIHRoaXMucGFuWSkgLyB0aGlzLnNjYWxlO1xuXG5cdFx0Zm9yIChjb25zdCBbbm9kZUlkLCBub2RlXSBvZiB0aGlzLm5vZGVzKSB7XG5cdFx0XHRjb25zdCBub2RlUmlnaHQgPSBub2RlLnggKyBub2RlLndpZHRoO1xuXHRcdFx0Y29uc3Qgbm9kZUJvdHRvbSA9IG5vZGUueSArIG5vZGUuaGVpZ2h0O1xuXG5cdFx0XHQvLyBDaGVjayBpbnRlcnNlY3Rpb25cblx0XHRcdGNvbnN0IGludGVyc2VjdHMgPVxuXHRcdFx0XHRub2RlLnggPCBib3hSaWdodCAmJlxuXHRcdFx0XHRub2RlUmlnaHQgPiBib3hMZWZ0ICYmXG5cdFx0XHRcdG5vZGUueSA8IGJveEJvdHRvbSAmJlxuXHRcdFx0XHRub2RlQm90dG9tID4gYm94VG9wO1xuXG5cdFx0XHRpZiAoaW50ZXJzZWN0cykge1xuXHRcdFx0XHR0aGlzLnNlbGVjdE5vZGUobm9kZUlkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuZGVzZWxlY3ROb2RlKG5vZGVJZCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzZWxlY3ROb2RlKG5vZGVJZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLnNlbGVjdGVkTm9kZXMuaGFzKG5vZGVJZCkpIHtcblx0XHRcdHRoaXMuc2VsZWN0ZWROb2Rlcy5hZGQobm9kZUlkKTtcblx0XHRcdGNvbnN0IGVsID0gdGhpcy5ub2RlRWxlbWVudHMuZ2V0KG5vZGVJZCk7XG5cdFx0XHRpZiAoZWwpIHtcblx0XHRcdFx0ZWwuYWRkQ2xhc3MoXCJyYWJiaXRtYXAtbm9kZS1zZWxlY3RlZFwiKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGRlc2VsZWN0Tm9kZShub2RlSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnNlbGVjdGVkTm9kZXMuaGFzKG5vZGVJZCkpIHtcblx0XHRcdHRoaXMuc2VsZWN0ZWROb2Rlcy5kZWxldGUobm9kZUlkKTtcblx0XHRcdGNvbnN0IGVsID0gdGhpcy5ub2RlRWxlbWVudHMuZ2V0KG5vZGVJZCk7XG5cdFx0XHRpZiAoZWwpIHtcblx0XHRcdFx0ZWwucmVtb3ZlQ2xhc3MoXCJyYWJiaXRtYXAtbm9kZS1zZWxlY3RlZFwiKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyU2VsZWN0aW9uKCk6IHZvaWQge1xuXHRcdGZvciAoY29uc3Qgbm9kZUlkIG9mIHRoaXMuc2VsZWN0ZWROb2Rlcykge1xuXHRcdFx0Y29uc3QgZWwgPSB0aGlzLm5vZGVFbGVtZW50cy5nZXQobm9kZUlkKTtcblx0XHRcdGlmIChlbCkge1xuXHRcdFx0XHRlbC5yZW1vdmVDbGFzcyhcInJhYmJpdG1hcC1ub2RlLXNlbGVjdGVkXCIpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLnNlbGVjdGVkTm9kZXMuY2xlYXIoKTtcblx0fVxuXG5cdHByaXZhdGUgZGVsZXRlU2VsZWN0ZWROb2RlcygpOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IG5vZGVJZCBvZiB0aGlzLnNlbGVjdGVkTm9kZXMpIHtcblx0XHRcdHRoaXMubm9kZXMuZGVsZXRlKG5vZGVJZCk7XG5cdFx0XHR0aGlzLmNoYXRNZXNzYWdlcy5kZWxldGUobm9kZUlkKTtcblx0XHRcdHRoaXMuY2hhdFN0YXRlcy5kZWxldGUobm9kZUlkKTtcblx0XHRcdGNvbnN0IGVsID0gdGhpcy5ub2RlRWxlbWVudHMuZ2V0KG5vZGVJZCk7XG5cdFx0XHRpZiAoZWwpIHtcblx0XHRcdFx0ZWwucmVtb3ZlKCk7XG5cdFx0XHRcdHRoaXMubm9kZUVsZW1lbnRzLmRlbGV0ZShub2RlSWQpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gUmVtb3ZlIGVkZ2VzIGNvbm5lY3RlZCB0byB0aGlzIG5vZGVcblx0XHRcdGZvciAoY29uc3QgW2VkZ2VJZCwgZWRnZV0gb2YgdGhpcy5lZGdlcykge1xuXHRcdFx0XHRpZiAoZWRnZS5mcm9tID09PSBub2RlSWQgfHwgZWRnZS50byA9PT0gbm9kZUlkKSB7XG5cdFx0XHRcdFx0dGhpcy5lZGdlcy5kZWxldGUoZWRnZUlkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLnNlbGVjdGVkTm9kZXMuY2xlYXIoKTtcblx0XHR0aGlzLnVwZGF0ZUVkZ2VzKCk7XG5cdFx0dGhpcy51cGRhdGVNaW5pbWFwKCk7XG5cdFx0dGhpcy50cmlnZ2VyU2F2ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc0lucHV0Rm9jdXNlZCgpOiBib29sZWFuIHtcblx0XHRjb25zdCBhY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXHRcdHJldHVybiAoXG5cdFx0XHRhY3RpdmUgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50IHx8XG5cdFx0XHRhY3RpdmUgaW5zdGFuY2VvZiBIVE1MVGV4dEFyZWFFbGVtZW50IHx8XG5cdFx0XHQoYWN0aXZlIGFzIEhUTUxFbGVtZW50KT8uaXNDb250ZW50RWRpdGFibGVcblx0XHQpO1xuXHR9XG5cblx0cHJpdmF0ZSB6b29tKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBmYWN0b3IgPSBNYXRoLmV4cChkZWx0YSk7XG5cdFx0Y29uc3QgbmV3U2NhbGUgPSBNYXRoLm1pbihNYXRoLm1heCh0aGlzLnNjYWxlICogZmFjdG9yLCAwLjEpLCAyKTtcblx0XHR0aGlzLnNjYWxlID0gbmV3U2NhbGU7XG5cdFx0dGhpcy51cGRhdGVUcmFuc2Zvcm0oKTtcblx0XHR0aGlzLnRyaWdnZXJTYXZlKCk7XG5cdH1cblxuXHRwcml2YXRlIHpvb21BdFBvaW50KGRlbHRhOiBudW1iZXIsIGNsaWVudFg6IG51bWJlciwgY2xpZW50WTogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgcmVjdCA9IHRoaXMuY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdGNvbnN0IG1vdXNlWCA9IGNsaWVudFggLSByZWN0LmxlZnQ7XG5cdFx0Y29uc3QgbW91c2VZID0gY2xpZW50WSAtIHJlY3QudG9wO1xuXG5cdFx0Y29uc3Qgb2xkU2NhbGUgPSB0aGlzLnNjYWxlO1xuXHRcdGNvbnN0IGZhY3RvciA9IE1hdGguZXhwKGRlbHRhKTtcblx0XHRjb25zdCBuZXdTY2FsZSA9IE1hdGgubWluKE1hdGgubWF4KHRoaXMuc2NhbGUgKiBmYWN0b3IsIDAuMSksIDIpO1xuXG5cdFx0aWYgKG5ld1NjYWxlICE9PSBvbGRTY2FsZSkge1xuXHRcdFx0dGhpcy5wYW5YID0gbW91c2VYIC0gKChtb3VzZVggLSB0aGlzLnBhblgpICogbmV3U2NhbGUpIC8gb2xkU2NhbGU7XG5cdFx0XHR0aGlzLnBhblkgPSBtb3VzZVkgLSAoKG1vdXNlWSAtIHRoaXMucGFuWSkgKiBuZXdTY2FsZSkgLyBvbGRTY2FsZTtcblx0XHRcdHRoaXMuc2NhbGUgPSBuZXdTY2FsZTtcblxuXHRcdFx0dGhpcy51cGRhdGVUcmFuc2Zvcm0oKTtcblx0XHRcdHRoaXMudHJpZ2dlclNhdmUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlc2V0VmlldygpOiB2b2lkIHtcblx0XHR0aGlzLnNjYWxlID0gMTtcblx0XHR0aGlzLnBhblggPSAwO1xuXHRcdHRoaXMucGFuWSA9IDA7XG5cdFx0dGhpcy51cGRhdGVUcmFuc2Zvcm0oKTtcblx0XHR0aGlzLnRyaWdnZXJTYXZlKCk7XG5cdH1cblxuXHRwcml2YXRlIGdldENvbnRlbnRCb3VuZHMoKTogeyBtaW5YOiBudW1iZXI7IG1pblk6IG51bWJlcjsgbWF4WDogbnVtYmVyOyBtYXhZOiBudW1iZXIgfSB8IG51bGwge1xuXHRcdGlmICh0aGlzLm5vZGVzLnNpemUgPT09IDApIHJldHVybiBudWxsO1xuXG5cdFx0bGV0IG1pblggPSBJbmZpbml0eSwgbWluWSA9IEluZmluaXR5LCBtYXhYID0gLUluZmluaXR5LCBtYXhZID0gLUluZmluaXR5O1xuXG5cdFx0Zm9yIChjb25zdCBub2RlIG9mIHRoaXMubm9kZXMudmFsdWVzKCkpIHtcblx0XHRcdG1pblggPSBNYXRoLm1pbihtaW5YLCBub2RlLngpO1xuXHRcdFx0bWluWSA9IE1hdGgubWluKG1pblksIG5vZGUueSk7XG5cdFx0XHRtYXhYID0gTWF0aC5tYXgobWF4WCwgbm9kZS54ICsgbm9kZS53aWR0aCk7XG5cdFx0XHRtYXhZID0gTWF0aC5tYXgobWF4WSwgbm9kZS55ICsgbm9kZS5oZWlnaHQpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7IG1pblgsIG1pblksIG1heFgsIG1heFkgfTtcblx0fVxuXG5cdHByaXZhdGUgY2xhbXBQYW4ocGFuWDogbnVtYmVyLCBwYW5ZOiBudW1iZXIpOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0ge1xuXHRcdGNvbnN0IGJvdW5kcyA9IHRoaXMuZ2V0Q29udGVudEJvdW5kcygpO1xuXHRcdGlmICghYm91bmRzKSByZXR1cm4geyB4OiBwYW5YLCB5OiBwYW5ZIH07XG5cblx0XHRjb25zdCByZWN0ID0gdGhpcy5jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0Y29uc3Qgdmlld1dpZHRoID0gcmVjdC53aWR0aDtcblx0XHRjb25zdCB2aWV3SGVpZ2h0ID0gcmVjdC5oZWlnaHQ7XG5cblx0XHQvLyBFbnN1cmUgbWluaW11bSBlZmZlY3RpdmUgY29udGVudCBhcmVhIHNvIGZldyBub2RlcyBkb24ndCBvdmVyLWNvbnN0cmFpbiBwYW5uaW5nXG5cdFx0Y29uc3QgbWluQ29udGVudFNpemUgPSAyMDAwO1xuXHRcdGNvbnN0IGVmZmVjdGl2ZVdpZHRoID0gTWF0aC5tYXgoYm91bmRzLm1heFggLSBib3VuZHMubWluWCwgbWluQ29udGVudFNpemUpO1xuXHRcdGNvbnN0IGVmZmVjdGl2ZUhlaWdodCA9IE1hdGgubWF4KGJvdW5kcy5tYXhZIC0gYm91bmRzLm1pblksIG1pbkNvbnRlbnRTaXplKTtcblx0XHRjb25zdCBjZW50ZXJYID0gKGJvdW5kcy5taW5YICsgYm91bmRzLm1heFgpIC8gMjtcblx0XHRjb25zdCBjZW50ZXJZID0gKGJvdW5kcy5taW5ZICsgYm91bmRzLm1heFkpIC8gMjtcblx0XHRjb25zdCBlZmZlY3RpdmVCb3VuZHMgPSB7XG5cdFx0XHRtaW5YOiBjZW50ZXJYIC0gZWZmZWN0aXZlV2lkdGggLyAyLFxuXHRcdFx0bWF4WDogY2VudGVyWCArIGVmZmVjdGl2ZVdpZHRoIC8gMixcblx0XHRcdG1pblk6IGNlbnRlclkgLSBlZmZlY3RpdmVIZWlnaHQgLyAyLFxuXHRcdFx0bWF4WTogY2VudGVyWSArIGVmZmVjdGl2ZUhlaWdodCAvIDIsXG5cdFx0fTtcblxuXHRcdC8vIEFsbG93IGNvbnRlbnQgdG8gZ28gb2ZmLXNjcmVlbiBidXQga2VlcCBhdCBsZWFzdCAyMCUgdmlzaWJsZVxuXHRcdGNvbnN0IGtlZXBWaXNpYmxlID0gMC4yO1xuXHRcdGNvbnN0IGNvbnRlbnRXaWR0aCA9IChlZmZlY3RpdmVCb3VuZHMubWF4WCAtIGVmZmVjdGl2ZUJvdW5kcy5taW5YKSAqIHRoaXMuc2NhbGU7XG5cdFx0Y29uc3QgY29udGVudEhlaWdodCA9IChlZmZlY3RpdmVCb3VuZHMubWF4WSAtIGVmZmVjdGl2ZUJvdW5kcy5taW5ZKSAqIHRoaXMuc2NhbGU7XG5cblx0XHQvLyBNaW4gdmlzaWJsZSBhbW91bnRcblx0XHRjb25zdCBtaW5WaXNpYmxlWCA9IE1hdGgubWluKGNvbnRlbnRXaWR0aCAqIGtlZXBWaXNpYmxlLCAxMDApO1xuXHRcdGNvbnN0IG1pblZpc2libGVZID0gTWF0aC5taW4oY29udGVudEhlaWdodCAqIGtlZXBWaXNpYmxlLCAxMDApO1xuXG5cdFx0Y29uc3QgY29udGVudExlZnQgPSBlZmZlY3RpdmVCb3VuZHMubWluWCAqIHRoaXMuc2NhbGU7XG5cdFx0Y29uc3QgY29udGVudFJpZ2h0ID0gZWZmZWN0aXZlQm91bmRzLm1heFggKiB0aGlzLnNjYWxlO1xuXHRcdGNvbnN0IGNvbnRlbnRUb3AgPSBlZmZlY3RpdmVCb3VuZHMubWluWSAqIHRoaXMuc2NhbGU7XG5cdFx0Y29uc3QgY29udGVudEJvdHRvbSA9IGVmZmVjdGl2ZUJvdW5kcy5tYXhZICogdGhpcy5zY2FsZTtcblxuXHRcdC8vIENvbnRlbnQgY2FuIGdvIG1vc3RseSBvZmYtc2NyZWVuIGJ1dCBub3QgY29tcGxldGVseVxuXHRcdGNvbnN0IG1pblBhblggPSBtaW5WaXNpYmxlWCAtIGNvbnRlbnRSaWdodDtcblx0XHRjb25zdCBtYXhQYW5YID0gdmlld1dpZHRoIC0gbWluVmlzaWJsZVggLSBjb250ZW50TGVmdDtcblx0XHRjb25zdCBtaW5QYW5ZID0gbWluVmlzaWJsZVkgLSBjb250ZW50Qm90dG9tO1xuXHRcdGNvbnN0IG1heFBhblkgPSB2aWV3SGVpZ2h0IC0gbWluVmlzaWJsZVkgLSBjb250ZW50VG9wO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHg6IE1hdGgubWluKE1hdGgubWF4KHBhblgsIG1pblBhblgpLCBtYXhQYW5YKSxcblx0XHRcdHk6IE1hdGgubWluKE1hdGgubWF4KHBhblksIG1pblBhblkpLCBtYXhQYW5ZKSxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSB6b29tVG9Ob2RlKG5vZGVJZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMubm9kZXMuZ2V0KG5vZGVJZCk7XG5cdFx0aWYgKCFub2RlKSByZXR1cm47XG5cblx0XHRjb25zdCByZWN0ID0gdGhpcy5jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0Y29uc3Qgdmlld1dpZHRoID0gcmVjdC53aWR0aDtcblx0XHRjb25zdCB2aWV3SGVpZ2h0ID0gcmVjdC5oZWlnaHQ7XG5cblx0XHQvLyBDYWxjdWxhdGUgc2NhbGUgdG8gZml0IG5vZGUgd2l0aCBwYWRkaW5nXG5cdFx0Y29uc3QgcGFkZGluZyA9IDEwMDtcblx0XHRjb25zdCBzY2FsZVggPSB2aWV3V2lkdGggLyAobm9kZS53aWR0aCArIHBhZGRpbmcgKiAyKTtcblx0XHRjb25zdCBzY2FsZVkgPSB2aWV3SGVpZ2h0IC8gKG5vZGUuaGVpZ2h0ICsgcGFkZGluZyAqIDIpO1xuXHRcdGNvbnN0IHRhcmdldFNjYWxlID0gTWF0aC5taW4oTWF0aC5tYXgoTWF0aC5taW4oc2NhbGVYLCBzY2FsZVkpLCAwLjEpLCAyKTtcblxuXHRcdC8vIENlbnRlciBub2RlIGluIHZpZXdcblx0XHRjb25zdCBub2RlQ2VudGVyWCA9IG5vZGUueCArIG5vZGUud2lkdGggLyAyO1xuXHRcdGNvbnN0IG5vZGVDZW50ZXJZID0gbm9kZS55ICsgbm9kZS5oZWlnaHQgLyAyO1xuXG5cdFx0Y29uc3QgdGFyZ2V0UGFuWCA9IHZpZXdXaWR0aCAvIDIgLSBub2RlQ2VudGVyWCAqIHRhcmdldFNjYWxlO1xuXHRcdGNvbnN0IHRhcmdldFBhblkgPSB2aWV3SGVpZ2h0IC8gMiAtIG5vZGVDZW50ZXJZICogdGFyZ2V0U2NhbGU7XG5cblx0XHQvLyBBbmltYXRlIHRvIHRhcmdldFxuXHRcdHRoaXMuYW5pbWF0ZVRvKHRhcmdldFNjYWxlLCB0YXJnZXRQYW5YLCB0YXJnZXRQYW5ZKTtcblx0fVxuXG5cdHByaXZhdGUgc2hvd0NoYXRDb250ZXh0TWVudShub2RlSWQ6IHN0cmluZywgZTogTW91c2VFdmVudCk6IHZvaWQge1xuXHRcdGNvbnN0IG1lbnUgPSBuZXcgTWVudSgpO1xuXG5cdFx0bWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG5cdFx0XHRpdGVtLnNldFRpdGxlKFwiQnJhbmNoXCIpXG5cdFx0XHRcdC5zZXRJY29uKFwiZ2l0LWJyYW5jaFwiKVxuXHRcdFx0XHQub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5icmFuY2hDaGF0KG5vZGVJZCk7XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0bWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG5cdFx0XHRpdGVtLnNldFRpdGxlKFwiRm9ya1wiKVxuXHRcdFx0XHQuc2V0SWNvbihcImdpdC1mb3JrXCIpXG5cdFx0XHRcdC5vbkNsaWNrKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLmZvcmtDaGF0KG5vZGVJZCk7XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0bWVudS5zaG93QXRNb3VzZUV2ZW50KGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBicmFuY2hDaGF0KG5vZGVJZDogc3RyaW5nLCB1cFRvTXNnSW5kZXg/OiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBzb3VyY2VOb2RlID0gdGhpcy5ub2Rlcy5nZXQobm9kZUlkKTtcblx0XHRjb25zdCBzb3VyY2VTdGF0ZSA9IHRoaXMuY2hhdFN0YXRlcy5nZXQobm9kZUlkKTtcblx0XHRjb25zdCBzb3VyY2VNZXNzYWdlcyA9IHRoaXMuY2hhdE1lc3NhZ2VzLmdldChub2RlSWQpO1xuXHRcdGlmICghc291cmNlTm9kZSB8fCAhc291cmNlU3RhdGUpIHJldHVybjtcblxuXHRcdC8vIEZpbmQgZnJlZSBwb3NpdGlvblxuXHRcdGNvbnN0IHBvcyA9IHRoaXMuZmluZEZyZWVQb3NpdGlvbihzb3VyY2VOb2RlKTtcblxuXHRcdC8vIENyZWF0ZSBuZXcgbm9kZSB3aXRoIGJyYW5jaCBzdWZmaXhcblx0XHRjb25zdCBiYXNlVGl0bGUgPSBzb3VyY2VOb2RlLnRpdGxlIHx8IFwiQ2hhdFwiO1xuXHRcdGNvbnN0IG5ld05vZGU6IENhbnZhc05vZGUgPSB7XG5cdFx0XHRpZDogdGhpcy5nZW5lcmF0ZUlkKCksXG5cdFx0XHR4OiBwb3MueCxcblx0XHRcdHk6IHBvcy55LFxuXHRcdFx0d2lkdGg6IHNvdXJjZU5vZGUud2lkdGgsXG5cdFx0XHRoZWlnaHQ6IHNvdXJjZU5vZGUuaGVpZ2h0LFxuXHRcdFx0dHlwZTogXCJjaGF0XCIsXG5cdFx0XHRjb250ZW50OiBcIlwiLFxuXHRcdFx0dGl0bGU6IGAke2Jhc2VUaXRsZX0gKGJyYW5jaClgLFxuXHRcdH07XG5cblx0XHQvLyBDb3B5IHN0YXRlXG5cdFx0Y29uc3QgbmV3U3RhdGU6IENoYXROb2RlU3RhdGUgPSB7XG5cdFx0XHRwcm92aWRlcjogc291cmNlU3RhdGUucHJvdmlkZXIsXG5cdFx0XHRtb2RlbDogc291cmNlU3RhdGUubW9kZWwsXG5cdFx0XHRjb250ZXh0RmlsZXM6IFsuLi5zb3VyY2VTdGF0ZS5jb250ZXh0RmlsZXNdLFxuXHRcdFx0c3lzdGVtUHJvbXB0OiBzb3VyY2VTdGF0ZS5zeXN0ZW1Qcm9tcHQsXG5cdFx0XHRjb250ZXh0VGVtcGxhdGU6IHNvdXJjZVN0YXRlLmNvbnRleHRUZW1wbGF0ZSxcblx0XHR9O1xuXG5cdFx0Ly8gQ29weSBtZXNzYWdlcyB1cCB0byBzcGVjaWZpZWQgaW5kZXggKG9yIGFsbCBpZiBub3Qgc3BlY2lmaWVkKVxuXHRcdGxldCBuZXdNZXNzYWdlczogQ2hhdE1lc3NhZ2VbXSA9IFtdO1xuXHRcdGlmIChzb3VyY2VNZXNzYWdlcykge1xuXHRcdFx0aWYgKHVwVG9Nc2dJbmRleCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdG5ld01lc3NhZ2VzID0gc291cmNlTWVzc2FnZXMuc2xpY2UoMCwgdXBUb01zZ0luZGV4ICsgMSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuZXdNZXNzYWdlcyA9IFsuLi5zb3VyY2VNZXNzYWdlc107XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5ub2Rlcy5zZXQobmV3Tm9kZS5pZCwgbmV3Tm9kZSk7XG5cdFx0dGhpcy5jaGF0U3RhdGVzLnNldChuZXdOb2RlLmlkLCBuZXdTdGF0ZSk7XG5cdFx0dGhpcy5jaGF0TWVzc2FnZXMuc2V0KG5ld05vZGUuaWQsIG5ld01lc3NhZ2VzKTtcblx0XHR0aGlzLnJlbmRlck5vZGUobmV3Tm9kZSk7XG5cblx0XHQvLyBBZGQgZWRnZSBmcm9tIHNvdXJjZSB0byBuZXcgbm9kZVxuXHRcdHRoaXMuYWRkRWRnZShub2RlSWQsIG5ld05vZGUuaWQpO1xuXG5cdFx0dGhpcy51cGRhdGVNaW5pbWFwKCk7XG5cdFx0dGhpcy50cmlnZ2VyU2F2ZSgpO1xuXG5cdFx0Ly8gWm9vbSB0byBuZXcgbm9kZSwgc2Nyb2xsIHRvIGxhc3QgbWVzc2FnZSwgYW5kIGZvY3VzIGlucHV0XG5cdFx0dGhpcy56b29tVG9Ob2RlKG5ld05vZGUuaWQpO1xuXHRcdHRoaXMuc2Nyb2xsQ2hhdFRvQm90dG9tKG5ld05vZGUuaWQpO1xuXHRcdHRoaXMuZm9jdXNDaGF0SW5wdXQobmV3Tm9kZS5pZCk7XG5cdH1cblxuXHRwcml2YXRlIHNjcm9sbENoYXRUb0JvdHRvbShub2RlSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IG5vZGVFbCA9IHRoaXMubm9kZUVsZW1lbnRzLmdldChub2RlSWQpO1xuXHRcdGlmICghbm9kZUVsKSByZXR1cm47XG5cblx0XHRjb25zdCBtZXNzYWdlc0NvbnRhaW5lciA9IG5vZGVFbC5xdWVyeVNlbGVjdG9yKFwiLnJhYmJpdG1hcC1jaGF0LW1lc3NhZ2VzXCIpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGlmIChtZXNzYWdlc0NvbnRhaW5lcikge1xuXHRcdFx0Ly8gVXNlIHNldFRpbWVvdXQgdG8gZW5zdXJlIERPTSBpcyByZWFkeSBhZnRlciByZW5kZXJcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRtZXNzYWdlc0NvbnRhaW5lci5zY3JvbGxUb3AgPSBtZXNzYWdlc0NvbnRhaW5lci5zY3JvbGxIZWlnaHQ7XG5cdFx0XHR9LCA1MCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBmb2N1c0NoYXRJbnB1dChub2RlSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IG5vZGVFbCA9IHRoaXMubm9kZUVsZW1lbnRzLmdldChub2RlSWQpO1xuXHRcdGlmICghbm9kZUVsKSByZXR1cm47XG5cblx0XHQvLyBVc2Ugc2V0VGltZW91dCB0byBlbnN1cmUgRE9NIGFuZCBhbmltYXRpb25zIGFyZSByZWFkeVxuXHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBub2RlRWwucXVlcnlTZWxlY3RvcihcIi5yYWJiaXRtYXAtY2hhdC1pbnB1dFwiKSBhcyBIVE1MVGV4dEFyZWFFbGVtZW50O1xuXHRcdFx0aWYgKGlucHV0KSB7XG5cdFx0XHRcdGlucHV0LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fSwgMzUwKTsgLy8gQWZ0ZXIgem9vbSBhbmltYXRpb24gKDMwMG1zKVxuXHR9XG5cblx0Ly8gUHVibGljIG1ldGhvZHMgZm9yIEV4cGFuZGVkQ2hhdE1vZGFsXG5cdGdldE5vZGUobm9kZUlkOiBzdHJpbmcpOiBDYW52YXNOb2RlIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5ub2Rlcy5nZXQobm9kZUlkKTtcblx0fVxuXG5cdGdldENoYXRTdGF0ZShub2RlSWQ6IHN0cmluZyk6IENoYXROb2RlU3RhdGUgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmNoYXRTdGF0ZXMuZ2V0KG5vZGVJZCk7XG5cdH1cblxuXHRnZXRDaGF0TWVzc2FnZXMobm9kZUlkOiBzdHJpbmcpOiBDaGF0TWVzc2FnZVtdIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5jaGF0TWVzc2FnZXMuZ2V0KG5vZGVJZCk7XG5cdH1cblxuXHRwcml2YXRlIG9wZW5FeHBhbmRlZENoYXQobm9kZUlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRuZXcgRXhwYW5kZWRDaGF0TW9kYWwodGhpcy5hcHAsIHRoaXMsIG5vZGVJZCkub3BlbigpO1xuXHR9XG5cblx0YXN5bmMgc2VuZENoYXRNZXNzYWdlKG5vZGVJZDogc3RyaW5nLCB0ZXh0OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjaGF0U3RhdGUgPSB0aGlzLmNoYXRTdGF0ZXMuZ2V0KG5vZGVJZCk7XG5cdFx0aWYgKCFjaGF0U3RhdGUpIHJldHVybjtcblxuXHRcdGNvbnN0IG1zZzogQ2hhdE1lc3NhZ2UgPSB7XG5cdFx0XHRyb2xlOiBcInVzZXJcIixcblx0XHRcdGNvbnRlbnQ6IHRleHQsXG5cdFx0XHRjb250ZXh0RmlsZXM6IGNoYXRTdGF0ZS5jb250ZXh0RmlsZXMgPyBbLi4uY2hhdFN0YXRlLmNvbnRleHRGaWxlc10gOiBbXVxuXHRcdH07XG5cblx0XHRjb25zdCBtZXNzYWdlcyA9IHRoaXMuY2hhdE1lc3NhZ2VzLmdldChub2RlSWQpIHx8IFtdO1xuXHRcdG1lc3NhZ2VzLnB1c2gobXNnKTtcblx0XHR0aGlzLmNoYXRNZXNzYWdlcy5zZXQobm9kZUlkLCBtZXNzYWdlcyk7XG5cblx0XHQvLyBVcGRhdGUgbm9kZSBVSVxuXHRcdHRoaXMucmVmcmVzaENoYXROb2RlKG5vZGVJZCk7XG5cdFx0dGhpcy50cmlnZ2VyU2F2ZSgpO1xuXG5cdFx0Ly8gR2V0IHByb3ZpZGVyXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5wcm92aWRlcnMuZmluZChwID0+IHAubmFtZSA9PT0gY2hhdFN0YXRlLnByb3ZpZGVyKTtcblx0XHRpZiAoIXByb3ZpZGVyKSByZXR1cm47XG5cblx0XHQvLyBHZXQgQVBJIGtleSBmcm9tIHByb3ZpZGVyIGNvbmZpZyAod2l0aCBmYWxsYmFjayB0byBsZWdhY3kgZmllbGRzIGZvciBtaWdyYXRpb24pXG5cdFx0bGV0IGFwaUtleSA9IHByb3ZpZGVyLmFwaUtleSB8fCBcIlwiO1xuXHRcdGlmICghYXBpS2V5KSB7XG5cdFx0XHQvLyBGYWxsYmFjayB0byBsZWdhY3kgQVBJIGtleSBmaWVsZHMgZm9yIGJhY2t3YXJkIGNvbXBhdGliaWxpdHlcblx0XHRcdGlmIChjaGF0U3RhdGUucHJvdmlkZXIgPT09IFwiT3BlbkFJXCIgJiYgdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmFpQXBpS2V5KSB7XG5cdFx0XHRcdGFwaUtleSA9IHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haUFwaUtleTtcblx0XHRcdH0gZWxzZSBpZiAoY2hhdFN0YXRlLnByb3ZpZGVyID09PSBcIk9wZW5Sb3V0ZXJcIiAmJiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcGVucm91dGVyQXBpS2V5KSB7XG5cdFx0XHRcdGFwaUtleSA9IHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5yb3V0ZXJBcGlLZXk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFhcGlLZXkpIHtcblx0XHRcdGNvbnN0IGVycm9yTXNnOiBDaGF0TWVzc2FnZSA9IHtcblx0XHRcdFx0cm9sZTogXCJhc3Npc3RhbnRcIixcblx0XHRcdFx0Y29udGVudDogYFBsZWFzZSBzZXQgeW91ciAke2NoYXRTdGF0ZS5wcm92aWRlcn0gQVBJIGtleSBpbiBzZXR0aW5ncy5gLFxuXHRcdFx0fTtcblx0XHRcdG1lc3NhZ2VzLnB1c2goZXJyb3JNc2cpO1xuXHRcdFx0dGhpcy5yZWZyZXNoQ2hhdE5vZGUobm9kZUlkKTtcblx0XHRcdHRoaXMudHJpZ2dlclNhdmUoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBMb2FkIGNvbnRleHRcblx0XHRsZXQgY29udGV4dENvbnRlbnQgPSBcIlwiO1xuXHRcdGlmIChjaGF0U3RhdGUuY29udGV4dEZpbGVzICYmIGNoYXRTdGF0ZS5jb250ZXh0RmlsZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0Y29uc3QgdGVtcGxhdGUgPSBjaGF0U3RhdGUuY29udGV4dFRlbXBsYXRlIHx8IERFRkFVTFRfQ09OVEVYVF9URU1QTEFURTtcblx0XHRcdGNvbnN0IGNvbnRleHRQYXJ0czogc3RyaW5nW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgZmlsZVBhdGggb2YgY2hhdFN0YXRlLmNvbnRleHRGaWxlcykge1xuXHRcdFx0XHRjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZpbGVQYXRoKTtcblx0XHRcdFx0aWYgKGZpbGUgJiYgZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuXHRcdFx0XHRcdFx0Y29uc3QgZm9ybWF0dGVkID0gdGVtcGxhdGVcblx0XHRcdFx0XHRcdFx0LnJlcGxhY2UoL1xce2ZpbGVwYXRoXFx9L2csIGZpbGVQYXRoKVxuXHRcdFx0XHRcdFx0XHQucmVwbGFjZSgvXFx7ZmlsZW5hbWVcXH0vZywgZmlsZS5uYW1lKVxuXHRcdFx0XHRcdFx0XHQucmVwbGFjZSgvXFx7Y29udGVudFxcfS9nLCBjb250ZW50KTtcblx0XHRcdFx0XHRcdGNvbnRleHRQYXJ0cy5wdXNoKGZvcm1hdHRlZCk7XG5cdFx0XHRcdFx0fSBjYXRjaCB7fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoY29udGV4dFBhcnRzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0Y29udGV4dENvbnRlbnQgPSBcIkNvbnRleHQgZmlsZXM6XFxuXFxuXCIgKyBjb250ZXh0UGFydHMuam9pbihcIlxcblxcblwiKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmNhbGxMTE0ocHJvdmlkZXIsIGFwaUtleSwgY2hhdFN0YXRlLm1vZGVsLCBtZXNzYWdlcywgY29udGV4dENvbnRlbnQsIGNoYXRTdGF0ZS5zeXN0ZW1Qcm9tcHQgfHwgXCJcIik7XG5cdFx0XHRjb25zdCBhc3Npc3RhbnRNc2c6IENoYXRNZXNzYWdlID0ge1xuXHRcdFx0XHRyb2xlOiBcImFzc2lzdGFudFwiLFxuXHRcdFx0XHRjb250ZW50OiByZXNwb25zZSxcblx0XHRcdH07XG5cdFx0XHRtZXNzYWdlcy5wdXNoKGFzc2lzdGFudE1zZyk7XG5cdFx0XHR0aGlzLnJlZnJlc2hDaGF0Tm9kZShub2RlSWQpO1xuXHRcdFx0dGhpcy50cmlnZ2VyU2F2ZSgpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRjb25zdCBlcnJvck1zZzogQ2hhdE1lc3NhZ2UgPSB7XG5cdFx0XHRcdHJvbGU6IFwiYXNzaXN0YW50XCIsXG5cdFx0XHRcdGNvbnRlbnQ6IGBFcnJvcjogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiVW5rbm93biBlcnJvclwifWAsXG5cdFx0XHR9O1xuXHRcdFx0bWVzc2FnZXMucHVzaChlcnJvck1zZyk7XG5cdFx0XHR0aGlzLnJlZnJlc2hDaGF0Tm9kZShub2RlSWQpO1xuXHRcdFx0dGhpcy50cmlnZ2VyU2F2ZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVmcmVzaENoYXROb2RlKG5vZGVJZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3Qgbm9kZUVsID0gdGhpcy5ub2RlRWxlbWVudHMuZ2V0KG5vZGVJZCk7XG5cdFx0aWYgKCFub2RlRWwpIHJldHVybjtcblxuXHRcdGNvbnN0IG1lc3NhZ2VzQ29udGFpbmVyID0gbm9kZUVsLnF1ZXJ5U2VsZWN0b3IoXCIucmFiYml0bWFwLWNoYXQtbWVzc2FnZXNcIikgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0aWYgKCFtZXNzYWdlc0NvbnRhaW5lcikgcmV0dXJuO1xuXG5cdFx0bWVzc2FnZXNDb250YWluZXIuZW1wdHkoKTtcblx0XHRjb25zdCBtZXNzYWdlcyA9IHRoaXMuY2hhdE1lc3NhZ2VzLmdldChub2RlSWQpIHx8IFtdO1xuXHRcdG1lc3NhZ2VzLmZvckVhY2goKG1zZywgaW5kZXgpID0+IHtcblx0XHRcdHRoaXMucmVuZGVyQ2hhdE1lc3NhZ2UobWVzc2FnZXNDb250YWluZXIsIG1zZywgbm9kZUlkLCBpbmRleCk7XG5cdFx0fSk7XG5cdFx0bWVzc2FnZXNDb250YWluZXIuc2Nyb2xsVG9wID0gbWVzc2FnZXNDb250YWluZXIuc2Nyb2xsSGVpZ2h0O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBleHBvcnRDaGF0VG9NZChub2RlOiBDYW52YXNOb2RlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgbWVzc2FnZXMgPSB0aGlzLmNoYXRNZXNzYWdlcy5nZXQobm9kZS5pZCkgfHwgW107XG5cdFx0aWYgKG1lc3NhZ2VzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0bmV3IE5vdGljZShcIk5vIG1lc3NhZ2VzIHRvIGV4cG9ydFwiKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjaGF0U3RhdGUgPSB0aGlzLmNoYXRTdGF0ZXMuZ2V0KG5vZGUuaWQpO1xuXHRcdGNvbnN0IHRpdGxlID0gbm9kZS50aXRsZSB8fCBcIkNoYXRcIjtcblxuXHRcdC8vIEJ1aWxkIG1hcmtkb3duIGNvbnRlbnRcblx0XHRsZXQgbWQgPSBgIyAke3RpdGxlfVxcblxcbmA7XG5cblx0XHRpZiAoY2hhdFN0YXRlKSB7XG5cdFx0XHRtZCArPSBgPiAqKk1vZGVsOioqICR7Y2hhdFN0YXRlLnByb3ZpZGVyfSAvICR7Y2hhdFN0YXRlLm1vZGVsfVxcblxcbmA7XG5cdFx0fVxuXG5cdFx0bWQgKz0gYC0tLVxcblxcbmA7XG5cblx0XHRmb3IgKGNvbnN0IG1zZyBvZiBtZXNzYWdlcykge1xuXHRcdFx0aWYgKG1zZy5yb2xlID09PSBcInVzZXJcIikge1xuXHRcdFx0XHRtZCArPSBgIyMgVXNlclxcblxcbmA7XG5cdFx0XHRcdC8vIFNob3cgY29udGV4dCBmb3IgdGhpcyBzcGVjaWZpYyBtZXNzYWdlXG5cdFx0XHRcdGlmIChtc2cuY29udGV4dEZpbGVzICYmIG1zZy5jb250ZXh0RmlsZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdG1kICs9IGA+ICoqQ29udGV4dDoqKiBgO1xuXHRcdFx0XHRcdG1kICs9IG1zZy5jb250ZXh0RmlsZXMubWFwKGYgPT4gYFtbJHtmfV1dYCkuam9pbihcIiwgXCIpO1xuXHRcdFx0XHRcdG1kICs9IGBcXG5cXG5gO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG1kICs9IGAke21zZy5jb250ZW50fVxcblxcbmA7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtZCArPSBgIyMgQXNzaXN0YW50XFxuXFxuJHttc2cuY29udGVudH1cXG5cXG5gO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEdldCBmb2xkZXIgcGF0aCBmcm9tIGN1cnJlbnQgZmlsZVxuXHRcdGNvbnN0IGZvbGRlciA9IHRoaXMuZmlsZT8ucGFyZW50Py5wYXRoIHx8IFwiXCI7XG5cdFx0Y29uc3Qgbm93ID0gbmV3IERhdGUoKTtcblx0XHRjb25zdCBtb250aHMgPSBbXCJKYW5cIiwgXCJGZWJcIiwgXCJNYXJcIiwgXCJBcHJcIiwgXCJNYXlcIiwgXCJKdW5cIiwgXCJKdWxcIiwgXCJBdWdcIiwgXCJTZXBcIiwgXCJPY3RcIiwgXCJOb3ZcIiwgXCJEZWNcIl07XG5cdFx0Y29uc3QgaG91cnMgPSBub3cuZ2V0SG91cnMoKTtcblx0XHRjb25zdCBhbXBtID0gaG91cnMgPj0gMTIgPyBcIlBNXCIgOiBcIkFNXCI7XG5cdFx0Y29uc3QgaG91cnMxMiA9IGhvdXJzICUgMTIgfHwgMTI7XG5cdFx0Y29uc3QgdGltZXN0YW1wID0gYCR7bm93LmdldEZ1bGxZZWFyKCl9ICR7bW9udGhzW25vdy5nZXRNb250aCgpXX0gJHtub3cuZ2V0RGF0ZSgpfSAke2hvdXJzMTJ9LSR7U3RyaW5nKG5vdy5nZXRNaW51dGVzKCkpLnBhZFN0YXJ0KDIsIFwiMFwiKX0gJHthbXBtfWA7XG5cdFx0Y29uc3QgZmlsZU5hbWUgPSBgJHt0aXRsZS5yZXBsYWNlKC9bXFxcXC86Kj9cIjw+fF0vZywgXCItXCIpfSAke3RpbWVzdGFtcH1gO1xuXHRcdGNvbnN0IGZpbGVQYXRoID0gZm9sZGVyID8gYCR7Zm9sZGVyfS8ke2ZpbGVOYW1lfS5tZGAgOiBgJHtmaWxlTmFtZX0ubWRgO1xuXG5cdFx0Y29uc3QgZmlsZSA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNyZWF0ZShmaWxlUGF0aCwgbWQpO1xuXHRcdG5ldyBOb3RpY2UoYFNhdmVkIHRvICR7ZmlsZVBhdGh9YCk7XG5cblx0XHQvLyBPcGVuIHRoZSBmaWxlIGluIGEgbmV3IHRhYlxuXHRcdGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZih0cnVlKTtcblx0XHRhd2FpdCBsZWFmLm9wZW5GaWxlKGZpbGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBzaG93VGl0bGVFZGl0b3Iobm9kZTogQ2FudmFzTm9kZSwgdGl0bGVTcGFuOiBIVE1MRWxlbWVudCwgY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdGNvbnN0IGN1cnJlbnRUaXRsZSA9IG5vZGUudGl0bGUgfHwgKG5vZGUudHlwZSA9PT0gXCJjaGF0XCIgPyBcIkNoYXRcIiA6IFwiQ2FyZFwiKTtcblxuXHRcdC8vIEhpZGUgdGl0bGUgc3BhblxuXHRcdHRpdGxlU3Bhbi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cblx0XHQvLyBDcmVhdGUgaW5wdXRcblx0XHRjb25zdCBpbnB1dCA9IGNvbnRhaW5lci5jcmVhdGVFbChcImlucHV0XCIsIHtcblx0XHRcdGNsczogXCJyYWJiaXRtYXAtdGl0bGUtaW5wdXRcIixcblx0XHRcdGF0dHI6IHsgdHlwZTogXCJ0ZXh0XCIsIHZhbHVlOiBjdXJyZW50VGl0bGUgfVxuXHRcdH0pO1xuXHRcdGlucHV0LnZhbHVlID0gY3VycmVudFRpdGxlO1xuXHRcdGlucHV0LmZvY3VzKCk7XG5cdFx0aW5wdXQuc2VsZWN0KCk7XG5cblx0XHRjb25zdCBmaW5pc2hFZGl0ID0gKCkgPT4ge1xuXHRcdFx0Y29uc3QgbmV3VGl0bGUgPSBpbnB1dC52YWx1ZS50cmltKCk7XG5cdFx0XHRpZiAobmV3VGl0bGUgJiYgbmV3VGl0bGUgIT09IGN1cnJlbnRUaXRsZSkge1xuXHRcdFx0XHRub2RlLnRpdGxlID0gbmV3VGl0bGU7XG5cdFx0XHRcdHRpdGxlU3Bhbi5zZXRUZXh0KG5ld1RpdGxlKTtcblx0XHRcdFx0dGhpcy50cmlnZ2VyU2F2ZSgpO1xuXHRcdFx0fVxuXHRcdFx0aW5wdXQucmVtb3ZlKCk7XG5cdFx0XHR0aXRsZVNwYW4uc3R5bGUuZGlzcGxheSA9IFwiXCI7XG5cdFx0fTtcblxuXHRcdGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJibHVyXCIsIGZpbmlzaEVkaXQpO1xuXHRcdGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChlKSA9PiB7XG5cdFx0XHRpZiAoZS5rZXkgPT09IFwiRW50ZXJcIikge1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGlucHV0LmJsdXIoKTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmtleSA9PT0gXCJFc2NhcGVcIikge1xuXHRcdFx0XHRpbnB1dC52YWx1ZSA9IGN1cnJlbnRUaXRsZTtcblx0XHRcdFx0aW5wdXQuYmx1cigpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBmb3JrQ2hhdChub2RlSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IHNvdXJjZU5vZGUgPSB0aGlzLm5vZGVzLmdldChub2RlSWQpO1xuXHRcdGNvbnN0IHNvdXJjZVN0YXRlID0gdGhpcy5jaGF0U3RhdGVzLmdldChub2RlSWQpO1xuXHRcdGlmICghc291cmNlTm9kZSB8fCAhc291cmNlU3RhdGUpIHJldHVybjtcblxuXHRcdC8vIEZpbmQgZnJlZSBwb3NpdGlvblxuXHRcdGNvbnN0IHBvcyA9IHRoaXMuZmluZEZyZWVQb3NpdGlvbihzb3VyY2VOb2RlKTtcblxuXHRcdC8vIENyZWF0ZSBuZXcgbm9kZSB3aXRoIGZvcmsgc3VmZml4XG5cdFx0Y29uc3QgYmFzZVRpdGxlID0gc291cmNlTm9kZS50aXRsZSB8fCBcIkNoYXRcIjtcblx0XHRjb25zdCBuZXdOb2RlOiBDYW52YXNOb2RlID0ge1xuXHRcdFx0aWQ6IHRoaXMuZ2VuZXJhdGVJZCgpLFxuXHRcdFx0eDogcG9zLngsXG5cdFx0XHR5OiBwb3MueSxcblx0XHRcdHdpZHRoOiBzb3VyY2VOb2RlLndpZHRoLFxuXHRcdFx0aGVpZ2h0OiBzb3VyY2VOb2RlLmhlaWdodCxcblx0XHRcdHR5cGU6IFwiY2hhdFwiLFxuXHRcdFx0Y29udGVudDogXCJcIixcblx0XHRcdHRpdGxlOiBgJHtiYXNlVGl0bGV9IChmb3JrKWAsXG5cdFx0fTtcblxuXHRcdC8vIENvcHkgc3RhdGUgKGNvbnRleHQsIHByb21wdHMsIG1vZGVsKSBidXQgTk9UIG1lc3NhZ2VzXG5cdFx0Y29uc3QgbmV3U3RhdGU6IENoYXROb2RlU3RhdGUgPSB7XG5cdFx0XHRwcm92aWRlcjogc291cmNlU3RhdGUucHJvdmlkZXIsXG5cdFx0XHRtb2RlbDogc291cmNlU3RhdGUubW9kZWwsXG5cdFx0XHRjb250ZXh0RmlsZXM6IFsuLi5zb3VyY2VTdGF0ZS5jb250ZXh0RmlsZXNdLFxuXHRcdFx0c3lzdGVtUHJvbXB0OiBzb3VyY2VTdGF0ZS5zeXN0ZW1Qcm9tcHQsXG5cdFx0XHRjb250ZXh0VGVtcGxhdGU6IHNvdXJjZVN0YXRlLmNvbnRleHRUZW1wbGF0ZSxcblx0XHR9O1xuXG5cdFx0dGhpcy5ub2Rlcy5zZXQobmV3Tm9kZS5pZCwgbmV3Tm9kZSk7XG5cdFx0dGhpcy5jaGF0U3RhdGVzLnNldChuZXdOb2RlLmlkLCBuZXdTdGF0ZSk7XG5cdFx0dGhpcy5jaGF0TWVzc2FnZXMuc2V0KG5ld05vZGUuaWQsIFtdKTsgLy8gRW1wdHkgbWVzc2FnZXNcblx0XHR0aGlzLnJlbmRlck5vZGUobmV3Tm9kZSk7XG5cblx0XHQvLyBBZGQgZWRnZSBmcm9tIHNvdXJjZSB0byBuZXcgbm9kZVxuXHRcdHRoaXMuYWRkRWRnZShub2RlSWQsIG5ld05vZGUuaWQpO1xuXG5cdFx0dGhpcy51cGRhdGVNaW5pbWFwKCk7XG5cdFx0dGhpcy50cmlnZ2VyU2F2ZSgpO1xuXG5cdFx0Ly8gWm9vbSB0byBuZXcgbm9kZSBhbmQgZm9jdXMgaW5wdXRcblx0XHR0aGlzLnpvb21Ub05vZGUobmV3Tm9kZS5pZCk7XG5cdFx0dGhpcy5mb2N1c0NoYXRJbnB1dChuZXdOb2RlLmlkKTtcblx0fVxuXG5cdHByaXZhdGUgZmluZEZyZWVQb3NpdGlvbihzb3VyY2VOb2RlOiBDYW52YXNOb2RlKTogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9IHtcblx0XHRjb25zdCBnYXAgPSA1MDsgLy8gR2FwIGJldHdlZW4gbm9kZXNcblxuXHRcdC8vIFRyeSByaWdodCBwb3NpdGlvbiBmaXJzdFxuXHRcdGNvbnN0IHJpZ2h0WCA9IHNvdXJjZU5vZGUueCArIHNvdXJjZU5vZGUud2lkdGggKyBnYXA7XG5cdFx0Y29uc3QgcmlnaHRZID0gc291cmNlTm9kZS55O1xuXG5cdFx0aWYgKCF0aGlzLmlzUG9zaXRpb25PY2N1cGllZChyaWdodFgsIHJpZ2h0WSwgc291cmNlTm9kZS53aWR0aCwgc291cmNlTm9kZS5oZWlnaHQpKSB7XG5cdFx0XHRyZXR1cm4geyB4OiByaWdodFgsIHk6IHJpZ2h0WSB9O1xuXHRcdH1cblxuXHRcdC8vIEZpbmQgYmxvY2tpbmcgbm9kZSBvbiB0aGUgcmlnaHQgYW5kIHBsYWNlIGJlbG93IGl0XG5cdFx0Y29uc3QgYmxvY2tpbmdOb2RlID0gdGhpcy5maW5kQmxvY2tpbmdOb2RlKHJpZ2h0WCwgcmlnaHRZLCBzb3VyY2VOb2RlLndpZHRoLCBzb3VyY2VOb2RlLmhlaWdodCk7XG5cdFx0aWYgKGJsb2NraW5nTm9kZSkge1xuXHRcdFx0Y29uc3QgYmVsb3dCbG9ja2luZ1kgPSBibG9ja2luZ05vZGUueSArIGJsb2NraW5nTm9kZS5oZWlnaHQgKyBnYXA7XG5cdFx0XHRpZiAoIXRoaXMuaXNQb3NpdGlvbk9jY3VwaWVkKHJpZ2h0WCwgYmVsb3dCbG9ja2luZ1ksIHNvdXJjZU5vZGUud2lkdGgsIHNvdXJjZU5vZGUuaGVpZ2h0KSkge1xuXHRcdFx0XHRyZXR1cm4geyB4OiByaWdodFgsIHk6IGJlbG93QmxvY2tpbmdZIH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gS2VlcCB0cnlpbmcgZnVydGhlciBkb3duIG9uIHRoZSByaWdodCBzaWRlXG5cdFx0bGV0IHRyeVkgPSByaWdodFkgKyBzb3VyY2VOb2RlLmhlaWdodCArIGdhcDtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDU7IGkrKykge1xuXHRcdFx0aWYgKCF0aGlzLmlzUG9zaXRpb25PY2N1cGllZChyaWdodFgsIHRyeVksIHNvdXJjZU5vZGUud2lkdGgsIHNvdXJjZU5vZGUuaGVpZ2h0KSkge1xuXHRcdFx0XHRyZXR1cm4geyB4OiByaWdodFgsIHk6IHRyeVkgfTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGJsb2NrZXIgPSB0aGlzLmZpbmRCbG9ja2luZ05vZGUocmlnaHRYLCB0cnlZLCBzb3VyY2VOb2RlLndpZHRoLCBzb3VyY2VOb2RlLmhlaWdodCk7XG5cdFx0XHRpZiAoYmxvY2tlcikge1xuXHRcdFx0XHR0cnlZID0gYmxvY2tlci55ICsgYmxvY2tlci5oZWlnaHQgKyBnYXA7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0cnlZICs9IHNvdXJjZU5vZGUuaGVpZ2h0ICsgZ2FwO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEZhbGxiYWNrOiBvZmZzZXQgZnJvbSBzb3VyY2Vcblx0XHRyZXR1cm4geyB4OiBzb3VyY2VOb2RlLnggKyA2MCwgeTogc291cmNlTm9kZS55ICsgNjAgfTtcblx0fVxuXG5cdHByaXZhdGUgZmluZEJsb2NraW5nTm9kZSh4OiBudW1iZXIsIHk6IG51bWJlciwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpOiBDYW52YXNOb2RlIHwgbnVsbCB7XG5cdFx0Y29uc3QgcGFkZGluZyA9IDIwO1xuXG5cdFx0Zm9yIChjb25zdCBub2RlIG9mIHRoaXMubm9kZXMudmFsdWVzKCkpIHtcblx0XHRcdGNvbnN0IG92ZXJsYXBzID1cblx0XHRcdFx0eCA8IG5vZGUueCArIG5vZGUud2lkdGggKyBwYWRkaW5nICYmXG5cdFx0XHRcdHggKyB3aWR0aCArIHBhZGRpbmcgPiBub2RlLnggJiZcblx0XHRcdFx0eSA8IG5vZGUueSArIG5vZGUuaGVpZ2h0ICsgcGFkZGluZyAmJlxuXHRcdFx0XHR5ICsgaGVpZ2h0ICsgcGFkZGluZyA+IG5vZGUueTtcblxuXHRcdFx0aWYgKG92ZXJsYXBzKSByZXR1cm4gbm9kZTtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRwcml2YXRlIGlzUG9zaXRpb25PY2N1cGllZCh4OiBudW1iZXIsIHk6IG51bWJlciwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRjb25zdCBwYWRkaW5nID0gMjA7IC8vIE1pbmltdW0gZ2FwXG5cblx0XHRmb3IgKGNvbnN0IG5vZGUgb2YgdGhpcy5ub2Rlcy52YWx1ZXMoKSkge1xuXHRcdFx0Ly8gQ2hlY2sgaWYgcmVjdGFuZ2xlcyBvdmVybGFwXG5cdFx0XHRjb25zdCBvdmVybGFwcyA9XG5cdFx0XHRcdHggPCBub2RlLnggKyBub2RlLndpZHRoICsgcGFkZGluZyAmJlxuXHRcdFx0XHR4ICsgd2lkdGggKyBwYWRkaW5nID4gbm9kZS54ICYmXG5cdFx0XHRcdHkgPCBub2RlLnkgKyBub2RlLmhlaWdodCArIHBhZGRpbmcgJiZcblx0XHRcdFx0eSArIGhlaWdodCArIHBhZGRpbmcgPiBub2RlLnk7XG5cblx0XHRcdGlmIChvdmVybGFwcykgcmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgYWRkRWRnZShmcm9tSWQ6IHN0cmluZywgdG9JZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgZWRnZTogRWRnZSA9IHtcblx0XHRcdGlkOiBgZWRnZS0ke0RhdGUubm93KCl9LSR7TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyKDIsIDkpfWAsXG5cdFx0XHRmcm9tOiBmcm9tSWQsXG5cdFx0XHR0bzogdG9JZCxcblx0XHR9O1xuXHRcdHRoaXMuZWRnZXMuc2V0KGVkZ2UuaWQsIGVkZ2UpO1xuXHRcdHRoaXMucmVuZGVyRWRnZShlZGdlKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyQWxsRWRnZXMoKTogdm9pZCB7XG5cdFx0Ly8gQ2xlYXIgZXhpc3RpbmcgZWRnZSBlbGVtZW50c1xuXHRcdHRoaXMuZWRnZXNDb250YWluZXIuaW5uZXJIVE1MID0gXCJcIjtcblxuXHRcdGZvciAoY29uc3QgZWRnZSBvZiB0aGlzLmVkZ2VzLnZhbHVlcygpKSB7XG5cdFx0XHR0aGlzLnJlbmRlckVkZ2UoZWRnZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJFZGdlKGVkZ2U6IEVkZ2UpOiB2b2lkIHtcblx0XHRjb25zdCBmcm9tTm9kZSA9IHRoaXMubm9kZXMuZ2V0KGVkZ2UuZnJvbSk7XG5cdFx0Y29uc3QgdG9Ob2RlID0gdGhpcy5ub2Rlcy5nZXQoZWRnZS50byk7XG5cdFx0aWYgKCFmcm9tTm9kZSB8fCAhdG9Ob2RlKSByZXR1cm47XG5cblx0XHQvLyBDYWxjdWxhdGUgY29ubmVjdGlvbiBwb2ludHNcblx0XHRjb25zdCBmcm9tQ2VudGVyWCA9IGZyb21Ob2RlLnggKyBmcm9tTm9kZS53aWR0aCAvIDI7XG5cdFx0Y29uc3QgZnJvbUNlbnRlclkgPSBmcm9tTm9kZS55ICsgZnJvbU5vZGUuaGVpZ2h0IC8gMjtcblx0XHRjb25zdCB0b0NlbnRlclggPSB0b05vZGUueCArIHRvTm9kZS53aWR0aCAvIDI7XG5cdFx0Y29uc3QgdG9DZW50ZXJZID0gdG9Ob2RlLnkgKyB0b05vZGUuaGVpZ2h0IC8gMjtcblxuXHRcdC8vIERldGVybWluZSB3aGljaCBzaWRlcyB0byBjb25uZWN0XG5cdFx0bGV0IGZyb21YOiBudW1iZXIsIGZyb21ZOiBudW1iZXIsIHRvWDogbnVtYmVyLCB0b1k6IG51bWJlcjtcblxuXHRcdGNvbnN0IGR4ID0gdG9DZW50ZXJYIC0gZnJvbUNlbnRlclg7XG5cdFx0Y29uc3QgZHkgPSB0b0NlbnRlclkgLSBmcm9tQ2VudGVyWTtcblxuXHRcdGNvbnN0IGFycm93U2l6ZSA9IDE0O1xuXG5cdFx0aWYgKE1hdGguYWJzKGR4KSA+IE1hdGguYWJzKGR5KSkge1xuXHRcdFx0Ly8gSG9yaXpvbnRhbCBjb25uZWN0aW9uXG5cdFx0XHRpZiAoZHggPiAwKSB7XG5cdFx0XHRcdC8vIFRvIGlzIG9uIHRoZSByaWdodFxuXHRcdFx0XHRmcm9tWCA9IGZyb21Ob2RlLnggKyBmcm9tTm9kZS53aWR0aDtcblx0XHRcdFx0ZnJvbVkgPSBmcm9tQ2VudGVyWTtcblx0XHRcdFx0dG9YID0gdG9Ob2RlLng7XG5cdFx0XHRcdHRvWSA9IHRvQ2VudGVyWTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIFRvIGlzIG9uIHRoZSBsZWZ0XG5cdFx0XHRcdGZyb21YID0gZnJvbU5vZGUueDtcblx0XHRcdFx0ZnJvbVkgPSBmcm9tQ2VudGVyWTtcblx0XHRcdFx0dG9YID0gdG9Ob2RlLnggKyB0b05vZGUud2lkdGg7XG5cdFx0XHRcdHRvWSA9IHRvQ2VudGVyWTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gVmVydGljYWwgY29ubmVjdGlvblxuXHRcdFx0aWYgKGR5ID4gMCkge1xuXHRcdFx0XHQvLyBUbyBpcyBiZWxvd1xuXHRcdFx0XHRmcm9tWCA9IGZyb21DZW50ZXJYO1xuXHRcdFx0XHRmcm9tWSA9IGZyb21Ob2RlLnkgKyBmcm9tTm9kZS5oZWlnaHQ7XG5cdFx0XHRcdHRvWCA9IHRvQ2VudGVyWDtcblx0XHRcdFx0dG9ZID0gdG9Ob2RlLnk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBUbyBpcyBhYm92ZVxuXHRcdFx0XHRmcm9tWCA9IGZyb21DZW50ZXJYO1xuXHRcdFx0XHRmcm9tWSA9IGZyb21Ob2RlLnk7XG5cdFx0XHRcdHRvWCA9IHRvQ2VudGVyWDtcblx0XHRcdFx0dG9ZID0gdG9Ob2RlLnkgKyB0b05vZGUuaGVpZ2h0O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIENyZWF0ZSBncm91cCBmb3IgZWRnZVxuXHRcdGNvbnN0IGdyb3VwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJnXCIpO1xuXHRcdGdyb3VwLnNldEF0dHJpYnV0ZShcImlkXCIsIGVkZ2UuaWQpO1xuXG5cdFx0Ly8gQ3JlYXRlIHBhdGggZWxlbWVudFxuXHRcdGNvbnN0IHBhdGggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInBhdGhcIik7XG5cdFx0cGF0aC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcInJhYmJpdG1hcC1lZGdlXCIpO1xuXG5cdFx0Ly8gQ3JlYXRlIGEgY3VydmVkIHBhdGhcblx0XHRjb25zdCBtaWRYID0gKGZyb21YICsgdG9YKSAvIDI7XG5cdFx0Y29uc3QgbWlkWSA9IChmcm9tWSArIHRvWSkgLyAyO1xuXG5cdFx0Ly8gQmV6aWVyIGN1cnZlIGNvbnRyb2wgcG9pbnRzXG5cdFx0bGV0IGN4MTogbnVtYmVyLCBjeTE6IG51bWJlciwgY3gyOiBudW1iZXIsIGN5MjogbnVtYmVyO1xuXG5cdFx0aWYgKE1hdGguYWJzKGR4KSA+IE1hdGguYWJzKGR5KSkge1xuXHRcdFx0Ly8gSG9yaXpvbnRhbDogY3VydmUgaG9yaXpvbnRhbGx5XG5cdFx0XHRjeDEgPSBtaWRYO1xuXHRcdFx0Y3kxID0gZnJvbVk7XG5cdFx0XHRjeDIgPSBtaWRYO1xuXHRcdFx0Y3kyID0gdG9ZO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBWZXJ0aWNhbDogY3VydmUgdmVydGljYWxseVxuXHRcdFx0Y3gxID0gZnJvbVg7XG5cdFx0XHRjeTEgPSBtaWRZO1xuXHRcdFx0Y3gyID0gdG9YO1xuXHRcdFx0Y3kyID0gbWlkWTtcblx0XHR9XG5cblx0XHRjb25zdCBkID0gYE0gJHtmcm9tWH0gJHtmcm9tWX0gQyAke2N4MX0gJHtjeTF9LCAke2N4Mn0gJHtjeTJ9LCAke3RvWH0gJHt0b1l9YDtcblx0XHRwYXRoLnNldEF0dHJpYnV0ZShcImRcIiwgZCk7XG5cblx0XHQvLyBIaXQgYXJlYSAoaW52aXNpYmxlLCB3aWRlciBzdHJva2UgZm9yIGVhc2llciBjbGlja2luZylcblx0XHRjb25zdCBoaXRBcmVhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiwgXCJwYXRoXCIpO1xuXHRcdGhpdEFyZWEuc2V0QXR0cmlidXRlKFwiZFwiLCBkKTtcblx0XHRoaXRBcmVhLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwicmFiYml0bWFwLWVkZ2UtaGl0YXJlYVwiKTtcblx0XHRoaXRBcmVhLnNldEF0dHJpYnV0ZShcImRhdGEtZWRnZS1pZFwiLCBlZGdlLmlkKTtcblx0XHRncm91cC5hcHBlbmRDaGlsZChoaXRBcmVhKTtcblx0XHRncm91cC5hcHBlbmRDaGlsZChwYXRoKTtcblxuXHRcdC8vIEVkZ2UgaG92ZXIgYW5kIGNvbnRleHQgbWVudVxuXHRcdGdyb3VwLnN0eWxlLnBvaW50ZXJFdmVudHMgPSBcImF1dG9cIjtcblx0XHRncm91cC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VlbnRlclwiLCAoKSA9PiB7XG5cdFx0XHRwYXRoLmNsYXNzTGlzdC5hZGQoXCJyYWJiaXRtYXAtZWRnZS1ob3ZlclwiKTtcblx0XHR9KTtcblx0XHRncm91cC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VsZWF2ZVwiLCAoKSA9PiB7XG5cdFx0XHRwYXRoLmNsYXNzTGlzdC5yZW1vdmUoXCJyYWJiaXRtYXAtZWRnZS1ob3ZlclwiKTtcblx0XHR9KTtcblx0XHRncm91cC5hZGRFdmVudExpc3RlbmVyKFwiY29udGV4dG1lbnVcIiwgKGUpID0+IHtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHR0aGlzLnNob3dFZGdlQ29udGV4dE1lbnUoZWRnZS5pZCwgZSBhcyBNb3VzZUV2ZW50KTtcblx0XHR9KTtcblxuXHRcdC8vIENhbGN1bGF0ZSBhcnJvdyBkaXJlY3Rpb24gZnJvbSBjdXJ2ZSBlbmQgdGFuZ2VudFxuXHRcdC8vIFRhbmdlbnQgYXQgdD0xIGZvciBjdWJpYyBiZXppZXI6IDMqKFAzLVAyKSA9IDMqKHRvWC1jeDIsIHRvWS1jeTIpXG5cdFx0Y29uc3QgdGFuZ2VudFggPSB0b1ggLSBjeDI7XG5cdFx0Y29uc3QgdGFuZ2VudFkgPSB0b1kgLSBjeTI7XG5cdFx0Y29uc3QgbGVuID0gTWF0aC5zcXJ0KHRhbmdlbnRYICogdGFuZ2VudFggKyB0YW5nZW50WSAqIHRhbmdlbnRZKTtcblx0XHRjb25zdCBub3JtWCA9IHRhbmdlbnRYIC8gbGVuO1xuXHRcdGNvbnN0IG5vcm1ZID0gdGFuZ2VudFkgLyBsZW47XG5cblx0XHQvLyBBcnJvdyBwb2ludHNcblx0XHRjb25zdCBhcnJvd1RpcFggPSB0b1g7XG5cdFx0Y29uc3QgYXJyb3dUaXBZID0gdG9ZO1xuXHRcdGNvbnN0IGFycm93QmFzZVggPSB0b1ggLSBub3JtWCAqIGFycm93U2l6ZTtcblx0XHRjb25zdCBhcnJvd0Jhc2VZID0gdG9ZIC0gbm9ybVkgKiBhcnJvd1NpemU7XG5cblx0XHQvLyBQZXJwZW5kaWN1bGFyIGZvciBhcnJvdyB3aWR0aFxuXHRcdGNvbnN0IHBlcnBYID0gLW5vcm1ZICogKGFycm93U2l6ZSAvIDIpO1xuXHRcdGNvbnN0IHBlcnBZID0gbm9ybVggKiAoYXJyb3dTaXplIC8gMik7XG5cblx0XHRjb25zdCBhcnJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsIFwicG9seWdvblwiKTtcblx0XHRjb25zdCBwb2ludHMgPSBgJHthcnJvd1RpcFh9LCR7YXJyb3dUaXBZfSAke2Fycm93QmFzZVggKyBwZXJwWH0sJHthcnJvd0Jhc2VZICsgcGVycFl9ICR7YXJyb3dCYXNlWCAtIHBlcnBYfSwke2Fycm93QmFzZVkgLSBwZXJwWX1gO1xuXHRcdGFycm93LnNldEF0dHJpYnV0ZShcInBvaW50c1wiLCBwb2ludHMpO1xuXHRcdGFycm93LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwicmFiYml0bWFwLWFycm93XCIpO1xuXHRcdGdyb3VwLmFwcGVuZENoaWxkKGFycm93KTtcblxuXHRcdHRoaXMuZWRnZXNDb250YWluZXIuYXBwZW5kQ2hpbGQoZ3JvdXApO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVFZGdlcygpOiB2b2lkIHtcblx0XHR0aGlzLnJlbmRlckFsbEVkZ2VzKCk7XG5cdH1cblxuXHRwcml2YXRlIGdldEhhbmRsZVBvc2l0aW9uKG5vZGU6IENhbnZhc05vZGUsIHNpZGU6IFwidG9wXCIgfCBcInJpZ2h0XCIgfCBcImJvdHRvbVwiIHwgXCJsZWZ0XCIpOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0ge1xuXHRcdHN3aXRjaCAoc2lkZSkge1xuXHRcdFx0Y2FzZSBcInRvcFwiOiByZXR1cm4geyB4OiBub2RlLnggKyBub2RlLndpZHRoIC8gMiwgeTogbm9kZS55IH07XG5cdFx0XHRjYXNlIFwicmlnaHRcIjogcmV0dXJuIHsgeDogbm9kZS54ICsgbm9kZS53aWR0aCwgeTogbm9kZS55ICsgbm9kZS5oZWlnaHQgLyAyIH07XG5cdFx0XHRjYXNlIFwiYm90dG9tXCI6IHJldHVybiB7IHg6IG5vZGUueCArIG5vZGUud2lkdGggLyAyLCB5OiBub2RlLnkgKyBub2RlLmhlaWdodCB9O1xuXHRcdFx0Y2FzZSBcImxlZnRcIjogcmV0dXJuIHsgeDogbm9kZS54LCB5OiBub2RlLnkgKyBub2RlLmhlaWdodCAvIDIgfTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHN0YXJ0RWRnZURyYXdpbmcobm9kZUlkOiBzdHJpbmcsIHNpZGU6IFwidG9wXCIgfCBcInJpZ2h0XCIgfCBcImJvdHRvbVwiIHwgXCJsZWZ0XCIsIGU6IE1vdXNlRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLmlzRHJhd2luZ0VkZ2UgPSB0cnVlO1xuXHRcdHRoaXMuZWRnZURyYXdGcm9tTm9kZSA9IG5vZGVJZDtcblx0XHR0aGlzLmVkZ2VEcmF3RnJvbVNpZGUgPSBzaWRlO1xuXHRcdHRoaXMuY2FudmFzLmFkZENsYXNzKFwiZHJhd2luZy1lZGdlXCIpO1xuXG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMubm9kZXMuZ2V0KG5vZGVJZCk7XG5cdFx0aWYgKCFub2RlKSByZXR1cm47XG5cdFx0Y29uc3QgYW5jaG9yID0gdGhpcy5nZXRIYW5kbGVQb3NpdGlvbihub2RlLCBzaWRlKTtcblxuXHRcdGNvbnN0IGxpbmUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcImxpbmVcIik7XG5cdFx0bGluZS5zZXRBdHRyaWJ1dGUoXCJ4MVwiLCBTdHJpbmcoYW5jaG9yLngpKTtcblx0XHRsaW5lLnNldEF0dHJpYnV0ZShcInkxXCIsIFN0cmluZyhhbmNob3IueSkpO1xuXHRcdGxpbmUuc2V0QXR0cmlidXRlKFwieDJcIiwgU3RyaW5nKGFuY2hvci54KSk7XG5cdFx0bGluZS5zZXRBdHRyaWJ1dGUoXCJ5MlwiLCBTdHJpbmcoYW5jaG9yLnkpKTtcblx0XHRsaW5lLnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwicmFiYml0bWFwLWVkZ2UtdGVtcFwiKTtcblx0XHR0aGlzLmVkZ2VzQ29udGFpbmVyLmFwcGVuZENoaWxkKGxpbmUpO1xuXHRcdHRoaXMuZWRnZURyYXdUZW1wTGluZSA9IGxpbmU7XG5cdH1cblxuXHRwcml2YXRlIGZpbmRUYXJnZXRIYW5kbGUoZTogTW91c2VFdmVudCk6IHsgbm9kZUlkOiBzdHJpbmc7IHNpZGU6IHN0cmluZyB9IHwgbnVsbCB7XG5cdFx0Ly8gRmlyc3QgdHJ5IGVsZW1lbnRGcm9tUG9pbnQgKGV4YWN0IGhpdClcblx0XHRjb25zdCBlbCA9IGRvY3VtZW50LmVsZW1lbnRGcm9tUG9pbnQoZS5jbGllbnRYLCBlLmNsaWVudFkpO1xuXHRcdGlmIChlbCkge1xuXHRcdFx0Y29uc3QgaGFuZGxlID0gKGVsIGFzIEhUTUxFbGVtZW50KS5jbG9zZXN0KFwiLnJhYmJpdG1hcC1jb25uZWN0aW9uLWhhbmRsZVwiKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0XHRpZiAoaGFuZGxlKSB7XG5cdFx0XHRcdGNvbnN0IG5vZGVJZCA9IGhhbmRsZS5nZXRBdHRyaWJ1dGUoXCJkYXRhLW5vZGUtaWRcIik7XG5cdFx0XHRcdGNvbnN0IHNpZGUgPSBoYW5kbGUuZ2V0QXR0cmlidXRlKFwiZGF0YS1zaWRlXCIpO1xuXHRcdFx0XHRpZiAobm9kZUlkICYmIHNpZGUpIHJldHVybiB7IG5vZGVJZCwgc2lkZSB9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEZhbGxiYWNrOiBwcm94aW1pdHktYmFzZWQgXHUyMDE0IGZpbmQgbmVhcmVzdCBoYW5kbGUgd2l0aGluIDMwcHhcblx0XHRjb25zdCByZWN0ID0gdGhpcy5jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0Y29uc3QgY2FudmFzWCA9IChlLmNsaWVudFggLSByZWN0LmxlZnQgLSB0aGlzLnBhblgpIC8gdGhpcy5zY2FsZTtcblx0XHRjb25zdCBjYW52YXNZID0gKGUuY2xpZW50WSAtIHJlY3QudG9wIC0gdGhpcy5wYW5ZKSAvIHRoaXMuc2NhbGU7XG5cdFx0Y29uc3QgdGhyZXNob2xkID0gMzA7XG5cdFx0bGV0IGJlc3Q6IHsgbm9kZUlkOiBzdHJpbmc7IHNpZGU6IHN0cmluZzsgZGlzdDogbnVtYmVyIH0gfCBudWxsID0gbnVsbDtcblx0XHRjb25zdCBzaWRlczogQXJyYXk8XCJ0b3BcIiB8IFwicmlnaHRcIiB8IFwiYm90dG9tXCIgfCBcImxlZnRcIj4gPSBbXCJ0b3BcIiwgXCJyaWdodFwiLCBcImJvdHRvbVwiLCBcImxlZnRcIl07XG5cblx0XHRmb3IgKGNvbnN0IG5vZGUgb2YgdGhpcy5ub2Rlcy52YWx1ZXMoKSkge1xuXHRcdFx0aWYgKG5vZGUuaWQgPT09IHRoaXMuZWRnZURyYXdGcm9tTm9kZSkgY29udGludWU7XG5cdFx0XHRmb3IgKGNvbnN0IHNpZGUgb2Ygc2lkZXMpIHtcblx0XHRcdFx0Y29uc3QgcG9zID0gdGhpcy5nZXRIYW5kbGVQb3NpdGlvbihub2RlLCBzaWRlKTtcblx0XHRcdFx0Y29uc3QgZGlzdCA9IE1hdGguc3FydCgoY2FudmFzWCAtIHBvcy54KSAqKiAyICsgKGNhbnZhc1kgLSBwb3MueSkgKiogMik7XG5cdFx0XHRcdGlmIChkaXN0IDwgdGhyZXNob2xkICYmICghYmVzdCB8fCBkaXN0IDwgYmVzdC5kaXN0KSkge1xuXHRcdFx0XHRcdGJlc3QgPSB7IG5vZGVJZDogbm9kZS5pZCwgc2lkZSwgZGlzdCB9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChiZXN0KSByZXR1cm4geyBub2RlSWQ6IGJlc3Qubm9kZUlkLCBzaWRlOiBiZXN0LnNpZGUgfTtcblxuXHRcdC8vIExhc3QgcmVzb3J0OiBjaGVjayBpZiBjdXJzb3IgaXMgb3ZlciBhbnkgbm9kZSBib2R5XG5cdFx0Zm9yIChjb25zdCBub2RlIG9mIHRoaXMubm9kZXMudmFsdWVzKCkpIHtcblx0XHRcdGlmIChub2RlLmlkID09PSB0aGlzLmVkZ2VEcmF3RnJvbU5vZGUpIGNvbnRpbnVlO1xuXHRcdFx0aWYgKGNhbnZhc1ggPj0gbm9kZS54ICYmIGNhbnZhc1ggPD0gbm9kZS54ICsgbm9kZS53aWR0aCAmJlxuXHRcdFx0XHRjYW52YXNZID49IG5vZGUueSAmJiBjYW52YXNZIDw9IG5vZGUueSArIG5vZGUuaGVpZ2h0KSB7XG5cdFx0XHRcdC8vIFBpY2sgdGhlIGNsb3Nlc3Qgc2lkZVxuXHRcdFx0XHRjb25zdCBkaXN0YW5jZXMgPSBzaWRlcy5tYXAoc2lkZSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgcG9zID0gdGhpcy5nZXRIYW5kbGVQb3NpdGlvbihub2RlLCBzaWRlKTtcblx0XHRcdFx0XHRyZXR1cm4geyBzaWRlLCBkaXN0OiBNYXRoLnNxcnQoKGNhbnZhc1ggLSBwb3MueCkgKiogMiArIChjYW52YXNZIC0gcG9zLnkpICoqIDIpIH07XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRkaXN0YW5jZXMuc29ydCgoYSwgYikgPT4gYS5kaXN0IC0gYi5kaXN0KTtcblx0XHRcdFx0cmV0dXJuIHsgbm9kZUlkOiBub2RlLmlkLCBzaWRlOiBkaXN0YW5jZXNbMF0uc2lkZSB9O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgc2hvd0VkZ2VDb250ZXh0TWVudShlZGdlSWQ6IHN0cmluZywgZTogTW91c2VFdmVudCk6IHZvaWQge1xuXHRcdGNvbnN0IG1lbnUgPSBuZXcgTWVudSgpO1xuXHRcdG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuXHRcdFx0aXRlbS5zZXRUaXRsZShcIkRlbGV0ZSBjb25uZWN0aW9uXCIpXG5cdFx0XHRcdC5zZXRJY29uKFwidHJhc2gtMlwiKVxuXHRcdFx0XHQub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5kZWxldGVFZGdlKGVkZ2VJZCk7XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdG1lbnUuc2hvd0F0TW91c2VFdmVudChlKTtcblx0fVxuXG5cdHByaXZhdGUgZGVsZXRlRWRnZShlZGdlSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuZWRnZXMuZGVsZXRlKGVkZ2VJZCk7XG5cdFx0dGhpcy5yZW5kZXJBbGxFZGdlcygpO1xuXHRcdHRoaXMudHJpZ2dlclNhdmUoKTtcblx0fVxuXG5cdHByaXZhdGUgYW5pbWF0ZVRvKHRhcmdldFNjYWxlOiBudW1iZXIsIHRhcmdldFBhblg6IG51bWJlciwgdGFyZ2V0UGFuWTogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RhcnRTY2FsZSA9IHRoaXMuc2NhbGU7XG5cdFx0Y29uc3Qgc3RhcnRQYW5YID0gdGhpcy5wYW5YO1xuXHRcdGNvbnN0IHN0YXJ0UGFuWSA9IHRoaXMucGFuWTtcblx0XHRjb25zdCBkdXJhdGlvbiA9IDMwMDtcblx0XHRjb25zdCBzdGFydFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcblxuXHRcdGNvbnN0IGFuaW1hdGUgPSAoY3VycmVudFRpbWU6IG51bWJlcikgPT4ge1xuXHRcdFx0Y29uc3QgZWxhcHNlZCA9IGN1cnJlbnRUaW1lIC0gc3RhcnRUaW1lO1xuXHRcdFx0Y29uc3QgcHJvZ3Jlc3MgPSBNYXRoLm1pbihlbGFwc2VkIC8gZHVyYXRpb24sIDEpO1xuXG5cdFx0XHQvLyBFYXNlIG91dCBjdWJpY1xuXHRcdFx0Y29uc3QgZWFzZWQgPSAxIC0gTWF0aC5wb3coMSAtIHByb2dyZXNzLCAzKTtcblxuXHRcdFx0dGhpcy5zY2FsZSA9IHN0YXJ0U2NhbGUgKyAodGFyZ2V0U2NhbGUgLSBzdGFydFNjYWxlKSAqIGVhc2VkO1xuXHRcdFx0dGhpcy5wYW5YID0gc3RhcnRQYW5YICsgKHRhcmdldFBhblggLSBzdGFydFBhblgpICogZWFzZWQ7XG5cdFx0XHR0aGlzLnBhblkgPSBzdGFydFBhblkgKyAodGFyZ2V0UGFuWSAtIHN0YXJ0UGFuWSkgKiBlYXNlZDtcblxuXHRcdFx0dGhpcy51cGRhdGVUcmFuc2Zvcm0oKTtcblxuXHRcdFx0aWYgKHByb2dyZXNzIDwgMSkge1xuXHRcdFx0XHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUoYW5pbWF0ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnRyaWdnZXJTYXZlKCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHJlcXVlc3RBbmltYXRpb25GcmFtZShhbmltYXRlKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlVHJhbnNmb3JtKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLm5vZGVzQ29udGFpbmVyKSB7XG5cdFx0XHR0aGlzLm5vZGVzQ29udGFpbmVyLnN0eWxlLnRyYW5zZm9ybSA9IGB0cmFuc2xhdGUoJHt0aGlzLnBhblh9cHgsICR7dGhpcy5wYW5ZfXB4KSBzY2FsZSgke3RoaXMuc2NhbGV9KWA7XG5cdFx0fVxuXHRcdC8vIFRyYW5zZm9ybSBlZGdlcyBjb250YWluZXIgc2FtZSBhcyBub2Rlc1xuXHRcdGlmICh0aGlzLmVkZ2VzQ29udGFpbmVyKSB7XG5cdFx0XHR0aGlzLmVkZ2VzQ29udGFpbmVyLnN0eWxlLnRyYW5zZm9ybSA9IGB0cmFuc2xhdGUoJHt0aGlzLnBhblh9cHgsICR7dGhpcy5wYW5ZfXB4KSBzY2FsZSgke3RoaXMuc2NhbGV9KWA7XG5cdFx0fVxuXHRcdC8vIE1vdmUgZ3JpZCB3aXRoIHBhbi96b29tXG5cdFx0aWYgKHRoaXMuY2FudmFzKSB7XG5cdFx0XHRjb25zdCBncmlkU2l6ZSA9IDIwICogdGhpcy5zY2FsZTtcblx0XHRcdHRoaXMuY2FudmFzLnN0eWxlLmJhY2tncm91bmRTaXplID0gYCR7Z3JpZFNpemV9cHggJHtncmlkU2l6ZX1weGA7XG5cdFx0XHR0aGlzLmNhbnZhcy5zdHlsZS5iYWNrZ3JvdW5kUG9zaXRpb24gPSBgJHt0aGlzLnBhblh9cHggJHt0aGlzLnBhbll9cHhgO1xuXHRcdH1cblx0XHR0aGlzLnVwZGF0ZU1pbmltYXAoKTtcblx0fVxuXG5cdHByaXZhdGUgZ2VuZXJhdGVJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBcIm5vZGUtXCIgKyBEYXRlLm5vdygpICsgXCItXCIgKyBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHIoMiwgOSk7XG5cdH1cblxuXHRwcml2YXRlIGFkZE5vZGUobm9kZTogQ2FudmFzTm9kZSwgc2F2ZTogYm9vbGVhbiA9IHRydWUpOiB2b2lkIHtcblx0XHR0aGlzLm5vZGVzLnNldChub2RlLmlkLCBub2RlKTtcblxuXHRcdGlmIChub2RlLnR5cGUgPT09IFwiY2hhdFwiKSB7XG5cdFx0XHRpZiAoIXRoaXMuY2hhdE1lc3NhZ2VzLmhhcyhub2RlLmlkKSkge1xuXHRcdFx0XHR0aGlzLmNoYXRNZXNzYWdlcy5zZXQobm9kZS5pZCwgW10pO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCF0aGlzLmNoYXRTdGF0ZXMuaGFzKG5vZGUuaWQpKSB7XG5cdFx0XHRcdGNvbnN0IGRlZmF1bHRQcm92aWRlciA9IHRoaXMucGx1Z2luLnNldHRpbmdzLnByb3ZpZGVyc1swXTtcblx0XHRcdFx0dGhpcy5jaGF0U3RhdGVzLnNldChub2RlLmlkLCB7XG5cdFx0XHRcdFx0cHJvdmlkZXI6IGRlZmF1bHRQcm92aWRlci5uYW1lLFxuXHRcdFx0XHRcdG1vZGVsOiBkZWZhdWx0UHJvdmlkZXIubW9kZWxzWzBdLFxuXHRcdFx0XHRcdGNvbnRleHRGaWxlczogW10sXG5cdFx0XHRcdFx0c3lzdGVtUHJvbXB0OiBERUZBVUxUX1NZU1RFTV9QUk9NUFQsXG5cdFx0XHRcdFx0Y29udGV4dFRlbXBsYXRlOiBERUZBVUxUX0NPTlRFWFRfVEVNUExBVEVcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5yZW5kZXJOb2RlKG5vZGUpO1xuXG5cdFx0aWYgKHNhdmUpIHtcblx0XHRcdHRoaXMudHJpZ2dlclNhdmUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlck5vZGUobm9kZTogQ2FudmFzTm9kZSk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5ub2Rlc0NvbnRhaW5lcikgcmV0dXJuO1xuXG5cdFx0Y29uc3QgZWwgPSB0aGlzLm5vZGVzQ29udGFpbmVyLmNyZWF0ZURpdih7XG5cdFx0XHRjbHM6IGByYWJiaXRtYXAtbm9kZSByYWJiaXRtYXAtbm9kZS0ke25vZGUudHlwZX1gLFxuXHRcdH0pO1xuXHRcdGVsLnN0eWxlLmxlZnQgPSBgJHtub2RlLnh9cHhgO1xuXHRcdGVsLnN0eWxlLnRvcCA9IGAke25vZGUueX1weGA7XG5cdFx0ZWwuc3R5bGUud2lkdGggPSBgJHtub2RlLndpZHRofXB4YDtcblx0XHRlbC5zdHlsZS5oZWlnaHQgPSBgJHtub2RlLmhlaWdodH1weGA7XG5cblx0XHQvLyBIZWFkZXIgZm9yIGRyYWdnaW5nXG5cdFx0Y29uc3QgaGVhZGVyID0gZWwuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1ub2RlLWhlYWRlclwiIH0pO1xuXG5cdFx0Y29uc3QgdGl0bGVDb250YWluZXIgPSBoZWFkZXIuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1ub2RlLXRpdGxlLWNvbnRhaW5lclwiIH0pO1xuXHRcdGNvbnN0IGRlZmF1bHRUaXRsZSA9IG5vZGUudHlwZSA9PT0gXCJjaGF0XCIgPyBcIkNoYXRcIiA6IG5vZGUudHlwZSA9PT0gXCJsaW5rXCIgPyAobm9kZS5saW5rVGl0bGUgfHwgXCJMaW5rXCIpIDogbm9kZS50eXBlID09PSBcIm5vdGVcIiA/IChub2RlLnRpdGxlIHx8IFwiTm90ZVwiKSA6IFwiQ2FyZFwiO1xuXHRcdGNvbnN0IHRpdGxlU3BhbiA9IHRpdGxlQ29udGFpbmVyLmNyZWF0ZVNwYW4oe1xuXHRcdFx0dGV4dDogbm9kZS50aXRsZSB8fCBkZWZhdWx0VGl0bGUsXG5cdFx0XHRjbHM6IFwicmFiYml0bWFwLW5vZGUtdGl0bGVcIlxuXHRcdH0pO1xuXG5cdFx0Ly8gRWRpdCB0aXRsZSBidXR0b24gKHBlbmNpbCBpY29uKVxuXHRcdGNvbnN0IGVkaXRUaXRsZUJ0biA9IHRpdGxlQ29udGFpbmVyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcInJhYmJpdG1hcC1lZGl0LXRpdGxlLWJ0blwiIH0pO1xuXHRcdGVkaXRUaXRsZUJ0bi5pbm5lckhUTUwgPSBgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgd2lkdGg9XCIxMlwiIGhlaWdodD1cIjEyXCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPjxwYXRoIGQ9XCJNMTcgM2EyLjg1IDIuODMgMCAxIDEgNCA0TDcuNSAyMC41IDIgMjJsMS41LTUuNVpcIi8+PHBhdGggZD1cIm0xNSA1IDQgNFwiLz48L3N2Zz5gO1xuXG5cdFx0ZWRpdFRpdGxlQnRuLm9uY2xpY2sgPSAoZSkgPT4ge1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdHRoaXMuc2hvd1RpdGxlRWRpdG9yKG5vZGUsIHRpdGxlU3BhbiwgdGl0bGVDb250YWluZXIpO1xuXHRcdH07XG5cblx0XHQvLyBFeHBvcnQgdG8gTUQgYnV0dG9uIChvbmx5IGZvciBjaGF0IG5vZGVzKVxuXHRcdGlmIChub2RlLnR5cGUgPT09IFwiY2hhdFwiKSB7XG5cdFx0XHRjb25zdCBleHBvcnRCdG4gPSB0aXRsZUNvbnRhaW5lci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJyYWJiaXRtYXAtZXhwb3J0LWJ0blwiIH0pO1xuXHRcdFx0ZXhwb3J0QnRuLmlubmVySFRNTCA9IGA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB3aWR0aD1cIjEyXCIgaGVpZ2h0PVwiMTJcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PHBhdGggZD1cIk0yMSAxNXY0YTIgMiAwIDAgMS0yIDJINWEyIDIgMCAwIDEtMi0ydi00XCIvPjxwb2x5bGluZSBwb2ludHM9XCI3IDEwIDEyIDE1IDE3IDEwXCIvPjxsaW5lIHgxPVwiMTJcIiB5MT1cIjE1XCIgeDI9XCIxMlwiIHkyPVwiM1wiLz48L3N2Zz5gO1xuXHRcdFx0ZXhwb3J0QnRuLnRpdGxlID0gXCJTYXZlIGFzIE1EXCI7XG5cblx0XHRcdGV4cG9ydEJ0bi5vbmNsaWNrID0gKGUpID0+IHtcblx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0dGhpcy5leHBvcnRDaGF0VG9NZChub2RlKTtcblx0XHRcdH07XG5cblx0XHRcdC8vIEV4cGFuZCBjaGF0IGJ1dHRvblxuXHRcdFx0Y29uc3QgZXhwYW5kQnRuID0gdGl0bGVDb250YWluZXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwicmFiYml0bWFwLWV4cGFuZC1idG5cIiB9KTtcblx0XHRcdGV4cGFuZEJ0bi5pbm5lckhUTUwgPSBgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgd2lkdGg9XCIxMlwiIGhlaWdodD1cIjEyXCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPjxwb2x5bGluZSBwb2ludHM9XCIxNSAzIDIxIDMgMjEgOVwiLz48cG9seWxpbmUgcG9pbnRzPVwiOSAyMSAzIDIxIDMgMTVcIi8+PGxpbmUgeDE9XCIyMVwiIHkxPVwiM1wiIHgyPVwiMTRcIiB5Mj1cIjEwXCIvPjxsaW5lIHgxPVwiM1wiIHkxPVwiMjFcIiB4Mj1cIjEwXCIgeTI9XCIxNFwiLz48L3N2Zz5gO1xuXHRcdFx0ZXhwYW5kQnRuLnRpdGxlID0gXCJFeHBhbmQgY2hhdFwiO1xuXG5cdFx0XHRleHBhbmRCdG4ub25jbGljayA9IChlKSA9PiB7XG5cdFx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdHRoaXMub3BlbkV4cGFuZGVkQ2hhdChub2RlLmlkKTtcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gRGVsZXRlIGJ1dHRvblxuXHRcdGNvbnN0IGRlbGV0ZUJ0biA9IGhlYWRlci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHUwMEQ3XCIsIGNsczogXCJyYWJiaXRtYXAtZGVsZXRlLWJ0blwiIH0pO1xuXHRcdGRlbGV0ZUJ0bi5vbmNsaWNrID0gKGUpID0+IHtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHR0aGlzLmRlbGV0ZU5vZGUobm9kZS5pZCk7XG5cdFx0fTtcblxuXHRcdC8vIE1ha2UgaGVhZGVyIGRyYWdnYWJsZVxuXHRcdGhlYWRlci5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIChlKSA9PiB7XG5cdFx0XHRpZiAoZS5idXR0b24gPT09IDAgJiYgIXRoaXMuc3BhY2VQcmVzc2VkKSB7XG5cdFx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cblx0XHRcdFx0Ly8gSGFuZGxlIHNlbGVjdGlvblxuXHRcdFx0XHRpZiAoZS5zaGlmdEtleSkge1xuXHRcdFx0XHRcdC8vIFRvZ2dsZSBzZWxlY3Rpb24gd2l0aCBzaGlmdFxuXHRcdFx0XHRcdGlmICh0aGlzLnNlbGVjdGVkTm9kZXMuaGFzKG5vZGUuaWQpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmRlc2VsZWN0Tm9kZShub2RlLmlkKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5zZWxlY3ROb2RlKG5vZGUuaWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmICghdGhpcy5zZWxlY3RlZE5vZGVzLmhhcyhub2RlLmlkKSkge1xuXHRcdFx0XHRcdC8vIENsaWNrIG9uIHVuc2VsZWN0ZWQgbm9kZSAtIGNsZWFyIG90aGVycyBhbmQgc2VsZWN0IHRoaXMgb25lXG5cdFx0XHRcdFx0dGhpcy5jbGVhclNlbGVjdGlvbigpO1xuXHRcdFx0XHRcdHRoaXMuc2VsZWN0Tm9kZShub2RlLmlkKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFN0YXJ0IGRyYWdcblx0XHRcdFx0dGhpcy5kcmFnZ2VkTm9kZSA9IG5vZGUuaWQ7XG5cdFx0XHRcdGNvbnN0IHJlY3QgPSBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdFx0dGhpcy5kcmFnT2Zmc2V0WCA9IChlLmNsaWVudFggLSByZWN0LmxlZnQpIC8gdGhpcy5zY2FsZTtcblx0XHRcdFx0dGhpcy5kcmFnT2Zmc2V0WSA9IChlLmNsaWVudFkgLSByZWN0LnRvcCkgLyB0aGlzLnNjYWxlO1xuXG5cdFx0XHRcdC8vIFN0b3JlIHN0YXJ0IG1vdXNlIHBvc2l0aW9uIGluIGNhbnZhcyBjb29yZHNcblx0XHRcdFx0Y29uc3QgY2FudmFzUmVjdCA9IHRoaXMuY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0XHR0aGlzLmRyYWdTdGFydE1vdXNlWCA9IChlLmNsaWVudFggLSBjYW52YXNSZWN0LmxlZnQgLSB0aGlzLnBhblgpIC8gdGhpcy5zY2FsZTtcblx0XHRcdFx0dGhpcy5kcmFnU3RhcnRNb3VzZVkgPSAoZS5jbGllbnRZIC0gY2FudmFzUmVjdC50b3AgLSB0aGlzLnBhblkpIC8gdGhpcy5zY2FsZTtcblxuXHRcdFx0XHQvLyBTdG9yZSBzdGFydCBwb3NpdGlvbnMgZm9yIGFsbCBzZWxlY3RlZCBub2Rlc1xuXHRcdFx0XHR0aGlzLmRyYWdTdGFydFBvc2l0aW9ucy5jbGVhcigpO1xuXHRcdFx0XHRmb3IgKGNvbnN0IG5vZGVJZCBvZiB0aGlzLnNlbGVjdGVkTm9kZXMpIHtcblx0XHRcdFx0XHRjb25zdCBuID0gdGhpcy5ub2Rlcy5nZXQobm9kZUlkKTtcblx0XHRcdFx0XHRpZiAobikge1xuXHRcdFx0XHRcdFx0dGhpcy5kcmFnU3RhcnRQb3NpdGlvbnMuc2V0KG5vZGVJZCwgeyB4OiBuLngsIHk6IG4ueSB9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vIERvdWJsZS1jbGljayB0byB6b29tIHRvIG5vZGVcblx0XHRoZWFkZXIuYWRkRXZlbnRMaXN0ZW5lcihcImRibGNsaWNrXCIsIChlKSA9PiB7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0dGhpcy56b29tVG9Ob2RlKG5vZGUuaWQpO1xuXHRcdH0pO1xuXG5cdFx0Ly8gUmlnaHQtY2xpY2sgY29udGV4dCBtZW51IGZvciBjaGF0IG5vZGVzXG5cdFx0aWYgKG5vZGUudHlwZSA9PT0gXCJjaGF0XCIpIHtcblx0XHRcdGVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjb250ZXh0bWVudVwiLCAoZSkgPT4ge1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdHRoaXMuc2hvd0NoYXRDb250ZXh0TWVudShub2RlLmlkLCBlKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIFJpZ2h0LWNsaWNrIGNvbnRleHQgbWVudSBmb3IgbGluayBub2Rlc1xuXHRcdGlmIChub2RlLnR5cGUgPT09IFwibGlua1wiKSB7XG5cdFx0XHRlbC5hZGRFdmVudExpc3RlbmVyKFwiY29udGV4dG1lbnVcIiwgKGUpID0+IHtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHR0aGlzLnNob3dMaW5rQ29udGV4dE1lbnUobm9kZS5pZCwgZSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHQvLyBSaWdodC1jbGljayBjb250ZXh0IG1lbnUgZm9yIG5vdGUgbm9kZXNcblx0XHRpZiAobm9kZS50eXBlID09PSBcIm5vdGVcIikge1xuXHRcdFx0ZWwuYWRkRXZlbnRMaXN0ZW5lcihcImNvbnRleHRtZW51XCIsIChlKSA9PiB7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0dGhpcy5zaG93Tm90ZUNvbnRleHRNZW51KG5vZGUuaWQsIGUpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gQ29udGVudCBhcmVhXG5cdFx0Y29uc3QgY29udGVudCA9IGVsLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtbm9kZS1jb250ZW50XCIgfSk7XG5cblx0XHRpZiAobm9kZS50eXBlID09PSBcImNoYXRcIikge1xuXHRcdFx0dGhpcy5yZW5kZXJDaGF0Q29udGVudChub2RlLmlkLCBjb250ZW50KTtcblx0XHR9IGVsc2UgaWYgKG5vZGUudHlwZSA9PT0gXCJsaW5rXCIpIHtcblx0XHRcdHRoaXMucmVuZGVyTGlua0NvbnRlbnQobm9kZSwgY29udGVudCk7XG5cdFx0fSBlbHNlIGlmIChub2RlLnR5cGUgPT09IFwibm90ZVwiKSB7XG5cdFx0XHR0aGlzLnJlbmRlck5vdGVDb250ZW50KG5vZGUsIGNvbnRlbnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnJlbmRlckNhcmRDb250ZW50KG5vZGUsIGNvbnRlbnQpO1xuXHRcdH1cblxuXHRcdC8vIENvbm5lY3Rpb24gaGFuZGxlc1xuXHRcdGNvbnN0IHNpZGVzOiBBcnJheTxcInRvcFwiIHwgXCJyaWdodFwiIHwgXCJib3R0b21cIiB8IFwibGVmdFwiPiA9IFtcInRvcFwiLCBcInJpZ2h0XCIsIFwiYm90dG9tXCIsIFwibGVmdFwiXTtcblx0XHRmb3IgKGNvbnN0IHNpZGUgb2Ygc2lkZXMpIHtcblx0XHRcdGNvbnN0IGhhbmRsZSA9IGVsLmNyZWF0ZURpdih7IGNsczogYHJhYmJpdG1hcC1jb25uZWN0aW9uLWhhbmRsZSByYWJiaXRtYXAtaGFuZGxlLSR7c2lkZX1gIH0pO1xuXHRcdFx0aGFuZGxlLnNldEF0dHJpYnV0ZShcImRhdGEtbm9kZS1pZFwiLCBub2RlLmlkKTtcblx0XHRcdGhhbmRsZS5zZXRBdHRyaWJ1dGUoXCJkYXRhLXNpZGVcIiwgc2lkZSk7XG5cdFx0XHRoYW5kbGUuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCAoZSkgPT4ge1xuXHRcdFx0XHRpZiAoZS5idXR0b24gIT09IDApIHJldHVybjtcblx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR0aGlzLnN0YXJ0RWRnZURyYXdpbmcobm9kZS5pZCwgc2lkZSwgZSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHQvLyBSZXNpemUgaGFuZGxlXG5cdFx0Y29uc3QgcmVzaXplSGFuZGxlID0gZWwuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1yZXNpemUtaGFuZGxlXCIgfSk7XG5cdFx0cmVzaXplSGFuZGxlLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgKGUpID0+IHtcblx0XHRcdGlmIChlLmJ1dHRvbiA9PT0gMCkge1xuXHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHRoaXMucmVzaXppbmdOb2RlID0gbm9kZS5pZDtcblx0XHRcdFx0dGhpcy5yZXNpemVTdGFydFdpZHRoID0gbm9kZS53aWR0aDtcblx0XHRcdFx0dGhpcy5yZXNpemVTdGFydEhlaWdodCA9IG5vZGUuaGVpZ2h0O1xuXHRcdFx0XHR0aGlzLnJlc2l6ZVN0YXJ0WCA9IGUuY2xpZW50WDtcblx0XHRcdFx0dGhpcy5yZXNpemVTdGFydFkgPSBlLmNsaWVudFk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLm5vZGVFbGVtZW50cy5zZXQobm9kZS5pZCwgZWwpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJMaW5rQ29udGVudChub2RlOiBDYW52YXNOb2RlLCBjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Y29udGFpbmVyLmFkZENsYXNzKFwicmFiYml0bWFwLWxpbmstY29udGVudFwiKTtcblxuXHRcdC8vIFRodW1ibmFpbCAvIGltYWdlXG5cdFx0aWYgKG5vZGUubGlua0ltYWdlKSB7XG5cdFx0XHRjb25zdCBpbWdXcmFwID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtbGluay10aHVtYm5haWxcIiB9KTtcblx0XHRcdGNvbnN0IGltZyA9IGltZ1dyYXAuY3JlYXRlRWwoXCJpbWdcIiwgeyBhdHRyOiB7IHNyYzogbm9kZS5saW5rSW1hZ2UsIGFsdDogbm9kZS5saW5rVGl0bGUgfHwgXCJcIiB9IH0pO1xuXHRcdFx0aW1nLmFkZEV2ZW50TGlzdGVuZXIoXCJlcnJvclwiLCAoKSA9PiB7XG5cdFx0XHRcdGltZ1dyYXAucmVtb3ZlKCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRjb25zdCBpbmZvID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtbGluay1pbmZvXCIgfSk7XG5cblx0XHQvLyBUaXRsZVxuXHRcdGNvbnN0IHRpdGxlID0gaW5mby5jcmVhdGVEaXYoe1xuXHRcdFx0Y2xzOiBcInJhYmJpdG1hcC1saW5rLXRpdGxlXCIsXG5cdFx0XHR0ZXh0OiBub2RlLmxpbmtUaXRsZSB8fCBcIkxvYWRpbmcuLi5cIixcblx0XHR9KTtcblxuXHRcdC8vIFVSTFxuXHRcdGlmIChub2RlLnVybCkge1xuXHRcdFx0bGV0IGRpc3BsYXlVcmwgPSBub2RlLnVybDtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHBhcnNlZCA9IG5ldyBVUkwobm9kZS51cmwpO1xuXHRcdFx0XHRkaXNwbGF5VXJsID0gcGFyc2VkLmhvc3RuYW1lICsgKHBhcnNlZC5wYXRobmFtZSAhPT0gXCIvXCIgPyBwYXJzZWQucGF0aG5hbWUgOiBcIlwiKTtcblx0XHRcdH0gY2F0Y2gge31cblx0XHRcdGluZm8uY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBcInJhYmJpdG1hcC1saW5rLXVybFwiLFxuXHRcdFx0XHR0ZXh0OiBkaXNwbGF5VXJsLFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gRGVzY3JpcHRpb25cblx0XHRpZiAobm9kZS5saW5rRGVzY3JpcHRpb24pIHtcblx0XHRcdGluZm8uY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBcInJhYmJpdG1hcC1saW5rLWRlc2NyaXB0aW9uXCIsXG5cdFx0XHRcdHRleHQ6IG5vZGUubGlua0Rlc2NyaXB0aW9uLFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gTG9hZGluZyBzdGF0ZVxuXHRcdGlmIChub2RlLmxpbmtUaXRsZSA9PT0gXCJMb2FkaW5nLi4uXCIpIHtcblx0XHRcdGNvbnN0IHNwaW5uZXIgPSBpbmZvLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtbGluay1sb2FkaW5nXCIgfSk7XG5cdFx0XHRzcGlubmVyLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIkZldGNoaW5nIGNvbnRlbnQuLi5cIiB9KTtcblx0XHR9XG5cblx0XHQvLyBPcGVuIGJ1dHRvblxuXHRcdGNvbnN0IG9wZW5CdG4gPSBjb250YWluZXIuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuXHRcdFx0Y2xzOiBcInJhYmJpdG1hcC1saW5rLW9wZW4tYnRuXCIsXG5cdFx0XHR0ZXh0OiBcIk9wZW4gTGlua1wiLFxuXHRcdH0pO1xuXHRcdG9wZW5CdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0aWYgKG5vZGUudXJsKSB7XG5cdFx0XHRcdHdpbmRvdy5vcGVuKG5vZGUudXJsLCBcIl9ibGFua1wiKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vIFByZXZlbnQgd2hlZWwgZXZlbnRzIGZyb20gYnViYmxpbmdcblx0XHRjb250YWluZXIuYWRkRXZlbnRMaXN0ZW5lcihcIndoZWVsXCIsIChlKSA9PiB7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzaG93TGlua0NvbnRleHRNZW51KG5vZGVJZDogc3RyaW5nLCBlOiBNb3VzZUV2ZW50KTogdm9pZCB7XG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMubm9kZXMuZ2V0KG5vZGVJZCk7XG5cdFx0aWYgKCFub2RlKSByZXR1cm47XG5cblx0XHRjb25zdCBtZW51ID0gbmV3IE1lbnUoKTtcblxuXHRcdG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuXHRcdFx0aXRlbS5zZXRUaXRsZShcIk9wZW4gVVJMXCIpXG5cdFx0XHRcdC5zZXRJY29uKFwiZXh0ZXJuYWwtbGlua1wiKVxuXHRcdFx0XHQub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKG5vZGUudXJsKSB3aW5kb3cub3Blbihub2RlLnVybCwgXCJfYmxhbmtcIik7XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0bWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG5cdFx0XHRpdGVtLnNldFRpdGxlKFwiUmVmcmVzaCBtZXRhZGF0YVwiKVxuXHRcdFx0XHQuc2V0SWNvbihcInJlZnJlc2gtY3dcIilcblx0XHRcdFx0Lm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0XHRcdGlmIChub2RlLnVybCkge1xuXHRcdFx0XHRcdFx0bm9kZS5saW5rVGl0bGUgPSBcIkxvYWRpbmcuLi5cIjtcblx0XHRcdFx0XHRcdG5vZGUubGlua0Rlc2NyaXB0aW9uID0gXCJcIjtcblx0XHRcdFx0XHRcdG5vZGUubGlua0ltYWdlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0bm9kZS5saW5rQ29udGVudCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdHRoaXMucmVyZW5kZXJOb2RlKG5vZGVJZCk7XG5cdFx0XHRcdFx0XHR0aGlzLmZldGNoTGlua01ldGFkYXRhKG5vZGUudXJsLCBub2RlSWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcblx0XHRcdGl0ZW0uc2V0VGl0bGUoXCJDb3B5IFVSTFwiKVxuXHRcdFx0XHQuc2V0SWNvbihcImNvcHlcIilcblx0XHRcdFx0Lm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0XHRcdGlmIChub2RlLnVybCkge1xuXHRcdFx0XHRcdFx0bmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQobm9kZS51cmwpO1xuXHRcdFx0XHRcdFx0bmV3IE5vdGljZShcIlVSTCBjb3BpZWQgdG8gY2xpcGJvYXJkXCIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRtZW51LnNob3dBdE1vdXNlRXZlbnQoZSk7XG5cdH1cblxuXHRwcml2YXRlIHNob3dOb3RlQ29udGV4dE1lbnUobm9kZUlkOiBzdHJpbmcsIGU6IE1vdXNlRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCBub2RlID0gdGhpcy5ub2Rlcy5nZXQobm9kZUlkKTtcblx0XHRpZiAoIW5vZGUpIHJldHVybjtcblxuXHRcdGNvbnN0IG1lbnUgPSBuZXcgTWVudSgpO1xuXG5cdFx0aWYgKG5vZGUuZmlsZVBhdGgpIHtcblx0XHRcdG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuXHRcdFx0XHRpdGVtLnNldFRpdGxlKFwiT3BlbiBpbiBPYnNpZGlhblwiKVxuXHRcdFx0XHRcdC5zZXRJY29uKFwiZmlsZS10ZXh0XCIpXG5cdFx0XHRcdFx0Lm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChub2RlLmZpbGVQYXRoISwgXCJcIiwgZmFsc2UpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuXHRcdFx0XHRpdGVtLnNldFRpdGxlKFwiUmVmcmVzaCBmcm9tIGZpbGVcIilcblx0XHRcdFx0XHQuc2V0SWNvbihcInJlZnJlc2gtY3dcIilcblx0XHRcdFx0XHQub25DbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKG5vZGUuZmlsZVBhdGghKTtcblx0XHRcdFx0XHRcdGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG5cdFx0XHRcdFx0XHRcdG5vZGUuY29udGVudCA9IGNvbnRlbnQ7XG5cdFx0XHRcdFx0XHRcdHRoaXMucmVyZW5kZXJOb2RlKG5vZGVJZCk7XG5cdFx0XHRcdFx0XHRcdHRoaXMudHJpZ2dlclNhdmUoKTtcblx0XHRcdFx0XHRcdFx0bmV3IE5vdGljZShcIk5vdGUgcmVmcmVzaGVkIGZyb20gZmlsZVwiKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdG5ldyBOb3RpY2UoXCJTb3VyY2UgZmlsZSBub3QgZm91bmRcIik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcblx0XHRcdGl0ZW0uc2V0VGl0bGUoXCJDb3B5IGNvbnRlbnRcIilcblx0XHRcdFx0LnNldEljb24oXCJjb3B5XCIpXG5cdFx0XHRcdC5vbkNsaWNrKCgpID0+IHtcblx0XHRcdFx0XHRuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChub2RlLmNvbnRlbnQpO1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UoXCJDb250ZW50IGNvcGllZCB0byBjbGlwYm9hcmRcIik7XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0bWVudS5zaG93QXRNb3VzZUV2ZW50KGUpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJDYXJkQ29udGVudChub2RlOiBDYW52YXNOb2RlLCBjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgdGV4dGFyZWEgPSBjb250YWluZXIuY3JlYXRlRWwoXCJ0ZXh0YXJlYVwiLCB7XG5cdFx0XHRjbHM6IFwicmFiYml0bWFwLWNhcmQtdGV4dGFyZWFcIixcblx0XHRcdGF0dHI6IHsgcGxhY2Vob2xkZXI6IFwiV3JpdGUgc29tZXRoaW5nLi4uXCIgfSxcblx0XHR9KTtcblx0XHR0ZXh0YXJlYS52YWx1ZSA9IG5vZGUuY29udGVudDtcblx0XHR0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKFwiaW5wdXRcIiwgKCkgPT4ge1xuXHRcdFx0bm9kZS5jb250ZW50ID0gdGV4dGFyZWEudmFsdWU7XG5cdFx0XHR0aGlzLnRyaWdnZXJTYXZlKCk7XG5cdFx0fSk7XG5cdFx0Ly8gUHJldmVudCB3aGVlbCBldmVudHMgZnJvbSBidWJibGluZyB0byBjYW52YXNcblx0XHR0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKFwid2hlZWxcIiwgKGUpID0+IHtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlck5vdGVDb250ZW50KG5vZGU6IENhbnZhc05vZGUsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRjb250YWluZXIuYWRkQ2xhc3MoXCJyYWJiaXRtYXAtbm90ZS1jb250ZW50XCIpO1xuXG5cdFx0Ly8gUmVuZGVyZWQgbWFya2Rvd24gYXJlYVxuXHRcdGNvbnN0IG1hcmtkb3duQ29udGFpbmVyID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtbm90ZS1tYXJrZG93blwiIH0pO1xuXHRcdE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKFxuXHRcdFx0dGhpcy5hcHAsXG5cdFx0XHRub2RlLmNvbnRlbnQsXG5cdFx0XHRtYXJrZG93bkNvbnRhaW5lcixcblx0XHRcdG5vZGUuZmlsZVBhdGggfHwgXCJcIixcblx0XHRcdG5ldyBDb21wb25lbnQoKVxuXHRcdCk7XG5cblx0XHQvLyBPcGVuIGluIE9ic2lkaWFuIGJ1dHRvblxuXHRcdGlmIChub2RlLmZpbGVQYXRoKSB7XG5cdFx0XHRjb25zdCBvcGVuQnRuID0gY29udGFpbmVyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdFx0Y2xzOiBcInJhYmJpdG1hcC1ub3RlLW9wZW4tYnRuXCIsXG5cdFx0XHRcdHRleHQ6IFwiT3BlbiBpbiBPYnNpZGlhblwiLFxuXHRcdFx0fSk7XG5cdFx0XHRvcGVuQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuXHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHR0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KG5vZGUuZmlsZVBhdGghLCBcIlwiLCBmYWxzZSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHQvLyBQcmV2ZW50IHdoZWVsIGV2ZW50cyBmcm9tIGJ1YmJsaW5nIHRvIGNhbnZhc1xuXHRcdGNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKFwid2hlZWxcIiwgKGUpID0+IHtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckNoYXRDb250ZW50KG5vZGVJZDogc3RyaW5nLCBjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Ly8gTW9kZWwgc2VsZWN0b3IgYmFyXG5cdFx0Y29uc3Qgc2VsZWN0b3JCYXIgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1jaGF0LXNlbGVjdG9yLWJhclwiIH0pO1xuXG5cdFx0Ly8gQ2xpY2sgb24gc2VsZWN0b3IgYmFyIHNlbGVjdHMgdGhlIG5vZGVcblx0XHRzZWxlY3RvckJhci5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIChlKSA9PiB7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0aWYgKCF0aGlzLnNlbGVjdGVkTm9kZXMuaGFzKG5vZGVJZCkpIHtcblx0XHRcdFx0dGhpcy5jbGVhclNlbGVjdGlvbigpO1xuXHRcdFx0XHR0aGlzLnNlbGVjdE5vZGUobm9kZUlkKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vIEdldCBjdXJyZW50IHN0YXRlIG9yIHVzZSBkZWZhdWx0c1xuXHRcdGxldCBzdGF0ZSA9IHRoaXMuY2hhdFN0YXRlcy5nZXQobm9kZUlkKTtcblx0XHRpZiAoIXN0YXRlKSB7XG5cdFx0XHRjb25zdCBkZWZhdWx0UHJvdmlkZXIgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5wcm92aWRlcnNbMF07XG5cdFx0XHRzdGF0ZSA9IHtcblx0XHRcdFx0cHJvdmlkZXI6IGRlZmF1bHRQcm92aWRlci5uYW1lLFxuXHRcdFx0XHRtb2RlbDogZGVmYXVsdFByb3ZpZGVyLm1vZGVsc1swXSxcblx0XHRcdFx0Y29udGV4dEZpbGVzOiBbXSxcblx0XHRcdFx0c3lzdGVtUHJvbXB0OiBERUZBVUxUX1NZU1RFTV9QUk9NUFQsXG5cdFx0XHRcdGNvbnRleHRUZW1wbGF0ZTogREVGQVVMVF9DT05URVhUX1RFTVBMQVRFXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5jaGF0U3RhdGVzLnNldChub2RlSWQsIHN0YXRlKTtcblx0XHR9XG5cdFx0Ly8gRW5zdXJlIGZpZWxkcyBleGlzdCBmb3Igb2xkIGRhdGFcblx0XHRpZiAoIXN0YXRlLmNvbnRleHRGaWxlcykge1xuXHRcdFx0c3RhdGUuY29udGV4dEZpbGVzID0gW107XG5cdFx0fVxuXHRcdGlmICghc3RhdGUuc3lzdGVtUHJvbXB0KSB7XG5cdFx0XHRzdGF0ZS5zeXN0ZW1Qcm9tcHQgPSBERUZBVUxUX1NZU1RFTV9QUk9NUFQ7XG5cdFx0fVxuXHRcdGlmICghc3RhdGUuY29udGV4dFRlbXBsYXRlKSB7XG5cdFx0XHRzdGF0ZS5jb250ZXh0VGVtcGxhdGUgPSBERUZBVUxUX0NPTlRFWFRfVEVNUExBVEU7XG5cdFx0fVxuXG5cdFx0Ly8gUHJvdmlkZXIgc2VsZWN0b3Jcblx0XHRjb25zdCBwcm92aWRlclNlbGVjdCA9IHNlbGVjdG9yQmFyLmNyZWF0ZUVsKFwic2VsZWN0XCIsIHsgY2xzOiBcInJhYmJpdG1hcC1zZWxlY3RcIiB9KTtcblx0XHRmb3IgKGNvbnN0IHByb3ZpZGVyIG9mIHRoaXMucGx1Z2luLnNldHRpbmdzLnByb3ZpZGVycykge1xuXHRcdFx0Y29uc3Qgb3B0aW9uID0gcHJvdmlkZXJTZWxlY3QuY3JlYXRlRWwoXCJvcHRpb25cIiwge1xuXHRcdFx0XHR0ZXh0OiBwcm92aWRlci5uYW1lLFxuXHRcdFx0XHR2YWx1ZTogcHJvdmlkZXIubmFtZVxuXHRcdFx0fSk7XG5cdFx0XHRpZiAocHJvdmlkZXIubmFtZSA9PT0gc3RhdGUucHJvdmlkZXIpIHtcblx0XHRcdFx0b3B0aW9uLnNlbGVjdGVkID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBNb2RlbCBzZWxlY3RvclxuXHRcdGNvbnN0IG1vZGVsU2VsZWN0ID0gc2VsZWN0b3JCYXIuY3JlYXRlRWwoXCJzZWxlY3RcIiwgeyBjbHM6IFwicmFiYml0bWFwLXNlbGVjdCByYWJiaXRtYXAtbW9kZWwtc2VsZWN0XCIgfSk7XG5cblx0XHQvLyBFZGl0IFByb21wdCBidXR0b25cblx0XHRjb25zdCBlZGl0UHJvbXB0QnRuID0gc2VsZWN0b3JCYXIuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuXHRcdFx0dGV4dDogXCJQcm9tcHRcIixcblx0XHRcdGNsczogXCJyYWJiaXRtYXAtYnRuIHJhYmJpdG1hcC1lZGl0LXByb21wdC1idG5cIlxuXHRcdH0pO1xuXHRcdGVkaXRQcm9tcHRCdG4ub25jbGljayA9IChlKSA9PiB7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0Y29uc3QgY3VycmVudFN0YXRlID0gdGhpcy5jaGF0U3RhdGVzLmdldChub2RlSWQpO1xuXHRcdFx0bmV3IFByb21wdEVkaXRvck1vZGFsKFxuXHRcdFx0XHR0aGlzLmFwcCxcblx0XHRcdFx0Y3VycmVudFN0YXRlPy5zeXN0ZW1Qcm9tcHQgfHwgXCJcIixcblx0XHRcdFx0Y3VycmVudFN0YXRlPy5jb250ZXh0VGVtcGxhdGUgfHwgREVGQVVMVF9DT05URVhUX1RFTVBMQVRFLFxuXHRcdFx0XHQobmV3UHJvbXB0LCBuZXdUZW1wbGF0ZSkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHN0YXRlID0gdGhpcy5jaGF0U3RhdGVzLmdldChub2RlSWQpO1xuXHRcdFx0XHRcdGlmIChzdGF0ZSkge1xuXHRcdFx0XHRcdFx0c3RhdGUuc3lzdGVtUHJvbXB0ID0gbmV3UHJvbXB0O1xuXHRcdFx0XHRcdFx0c3RhdGUuY29udGV4dFRlbXBsYXRlID0gbmV3VGVtcGxhdGU7XG5cdFx0XHRcdFx0XHR0aGlzLmNoYXRTdGF0ZXMuc2V0KG5vZGVJZCwgc3RhdGUpO1xuXHRcdFx0XHRcdFx0dGhpcy50cmlnZ2VyU2F2ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0KS5vcGVuKCk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHVwZGF0ZU1vZGVsT3B0aW9ucyA9ICgpID0+IHtcblx0XHRcdGNvbnN0IGN1cnJlbnRTdGF0ZSA9IHRoaXMuY2hhdFN0YXRlcy5nZXQobm9kZUlkKSE7XG5cdFx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMucGx1Z2luLnNldHRpbmdzLnByb3ZpZGVycy5maW5kKHAgPT4gcC5uYW1lID09PSBjdXJyZW50U3RhdGUucHJvdmlkZXIpO1xuXHRcdFx0aWYgKCFwcm92aWRlcikgcmV0dXJuO1xuXG5cdFx0XHQvLyBVc2UgY3VzdG9tIG1vZGVscyBmb3IgT3BlblJvdXRlciBpZiBzcGVjaWZpZWRcblx0XHRcdGxldCBtb2RlbHMgPSBwcm92aWRlci5tb2RlbHM7XG5cdFx0XHRpZiAocHJvdmlkZXIubmFtZSA9PT0gXCJPcGVuUm91dGVyXCIgJiYgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY3VzdG9tT3BlblJvdXRlck1vZGVscy50cmltKCkpIHtcblx0XHRcdFx0bW9kZWxzID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MuY3VzdG9tT3BlblJvdXRlck1vZGVsc1xuXHRcdFx0XHRcdC5zcGxpdChcIlxcblwiKVxuXHRcdFx0XHRcdC5tYXAobSA9PiBtLnRyaW0oKSlcblx0XHRcdFx0XHQuZmlsdGVyKG0gPT4gbS5sZW5ndGggPiAwKTtcblx0XHRcdH1cblxuXHRcdFx0bW9kZWxTZWxlY3QuZW1wdHkoKTtcblx0XHRcdGZvciAoY29uc3QgbW9kZWwgb2YgbW9kZWxzKSB7XG5cdFx0XHRcdGNvbnN0IG9wdGlvbiA9IG1vZGVsU2VsZWN0LmNyZWF0ZUVsKFwib3B0aW9uXCIsIHtcblx0XHRcdFx0XHR0ZXh0OiBtb2RlbCxcblx0XHRcdFx0XHR2YWx1ZTogbW9kZWxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGlmIChtb2RlbCA9PT0gY3VycmVudFN0YXRlLm1vZGVsKSB7XG5cdFx0XHRcdFx0b3B0aW9uLnNlbGVjdGVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR1cGRhdGVNb2RlbE9wdGlvbnMoKTtcblxuXHRcdHByb3ZpZGVyU2VsZWN0Lm9uY2hhbmdlID0gKCkgPT4ge1xuXHRcdFx0Y29uc3QgbmV3UHJvdmlkZXIgPSBwcm92aWRlclNlbGVjdC52YWx1ZTtcblx0XHRcdGNvbnN0IHByb3ZpZGVyID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MucHJvdmlkZXJzLmZpbmQocCA9PiBwLm5hbWUgPT09IG5ld1Byb3ZpZGVyKTtcblx0XHRcdGlmIChwcm92aWRlcikge1xuXHRcdFx0XHQvLyBVc2UgY3VzdG9tIG1vZGVscyBmb3IgT3BlblJvdXRlciBpZiBzcGVjaWZpZWRcblx0XHRcdFx0bGV0IG1vZGVscyA9IHByb3ZpZGVyLm1vZGVscztcblx0XHRcdFx0aWYgKHByb3ZpZGVyLm5hbWUgPT09IFwiT3BlblJvdXRlclwiICYmIHRoaXMucGx1Z2luLnNldHRpbmdzLmN1c3RvbU9wZW5Sb3V0ZXJNb2RlbHMudHJpbSgpKSB7XG5cdFx0XHRcdFx0bW9kZWxzID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MuY3VzdG9tT3BlblJvdXRlck1vZGVsc1xuXHRcdFx0XHRcdFx0LnNwbGl0KFwiXFxuXCIpXG5cdFx0XHRcdFx0XHQubWFwKG0gPT4gbS50cmltKCkpXG5cdFx0XHRcdFx0XHQuZmlsdGVyKG0gPT4gbS5sZW5ndGggPiAwKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGN1cnJlbnRTdGF0ZSA9IHRoaXMuY2hhdFN0YXRlcy5nZXQobm9kZUlkKTtcblx0XHRcdFx0Y29uc3QgbmV3U3RhdGU6IENoYXROb2RlU3RhdGUgPSB7XG5cdFx0XHRcdFx0cHJvdmlkZXI6IG5ld1Byb3ZpZGVyLFxuXHRcdFx0XHRcdG1vZGVsOiBtb2RlbHNbMF0sXG5cdFx0XHRcdFx0Y29udGV4dEZpbGVzOiBjdXJyZW50U3RhdGU/LmNvbnRleHRGaWxlcyB8fCBbXSxcblx0XHRcdFx0XHRzeXN0ZW1Qcm9tcHQ6IGN1cnJlbnRTdGF0ZT8uc3lzdGVtUHJvbXB0IHx8IERFRkFVTFRfU1lTVEVNX1BST01QVCxcblx0XHRcdFx0XHRjb250ZXh0VGVtcGxhdGU6IGN1cnJlbnRTdGF0ZT8uY29udGV4dFRlbXBsYXRlIHx8IERFRkFVTFRfQ09OVEVYVF9URU1QTEFURVxuXHRcdFx0XHR9O1xuXHRcdFx0XHR0aGlzLmNoYXRTdGF0ZXMuc2V0KG5vZGVJZCwgbmV3U3RhdGUpO1xuXHRcdFx0XHR1cGRhdGVNb2RlbE9wdGlvbnMoKTtcblx0XHRcdFx0dGhpcy50cmlnZ2VyU2F2ZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRtb2RlbFNlbGVjdC5vbmNoYW5nZSA9ICgpID0+IHtcblx0XHRcdGNvbnN0IGN1cnJlbnRTdGF0ZSA9IHRoaXMuY2hhdFN0YXRlcy5nZXQobm9kZUlkKSE7XG5cdFx0XHRjdXJyZW50U3RhdGUubW9kZWwgPSBtb2RlbFNlbGVjdC52YWx1ZTtcblx0XHRcdHRoaXMuY2hhdFN0YXRlcy5zZXQobm9kZUlkLCBjdXJyZW50U3RhdGUpO1xuXHRcdFx0dGhpcy50cmlnZ2VyU2F2ZSgpO1xuXHRcdH07XG5cblx0XHQvLyBDb250ZXh0IHNlY3Rpb25cblx0XHRjb25zdCBjb250ZXh0U2VjdGlvbiA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLWNoYXQtY29udGV4dFwiIH0pO1xuXHRcdGNvbnN0IGNvbnRleHRIZWFkZXIgPSBjb250ZXh0U2VjdGlvbi5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLWNoYXQtY29udGV4dC1oZWFkZXJcIiB9KTtcblx0XHRjb250ZXh0SGVhZGVyLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIkNvbnRleHRcIiwgY2xzOiBcInJhYmJpdG1hcC1jaGF0LWNvbnRleHQtdGl0bGVcIiB9KTtcblxuXHRcdGNvbnN0IGNvbnRleHRMaXN0ID0gY29udGV4dFNlY3Rpb24uY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1jaGF0LWNvbnRleHQtbGlzdFwiIH0pO1xuXG5cdFx0Y29uc3QgcmVuZGVyQ29udGV4dEZpbGVzID0gKCkgPT4ge1xuXHRcdFx0Y29udGV4dExpc3QuZW1wdHkoKTtcblx0XHRcdGNvbnN0IGN1cnJlbnRTdGF0ZSA9IHRoaXMuY2hhdFN0YXRlcy5nZXQobm9kZUlkKTtcblxuXHRcdFx0aWYgKCFjdXJyZW50U3RhdGUgfHwgY3VycmVudFN0YXRlLmNvbnRleHRGaWxlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0Ly8gU2hvdyBwbGFjZWhvbGRlclxuXHRcdFx0XHRjb25zdCBwbGFjZWhvbGRlciA9IGNvbnRleHRMaXN0LmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtY2hhdC1jb250ZXh0LXBsYWNlaG9sZGVyXCIgfSk7XG5cdFx0XHRcdHBsYWNlaG9sZGVyLnNldFRleHQoXCJEcmFnIHlvdXIgbWQvZm9sZGVycyBoZXJlXCIpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3QgZmlsZVBhdGggb2YgY3VycmVudFN0YXRlLmNvbnRleHRGaWxlcykge1xuXHRcdFx0XHRjb25zdCBmaWxlSXRlbSA9IGNvbnRleHRMaXN0LmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtY2hhdC1jb250ZXh0LWl0ZW1cIiB9KTtcblx0XHRcdFx0Y29uc3QgZmlsZU5hbWUgPSBmaWxlUGF0aC5zcGxpdChcIi9cIikucG9wKCkgfHwgZmlsZVBhdGg7XG5cdFx0XHRcdGZpbGVJdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBmaWxlTmFtZSwgY2xzOiBcInJhYmJpdG1hcC1jaGF0LWNvbnRleHQtZmlsZW5hbWVcIiB9KTtcblxuXHRcdFx0XHRjb25zdCByZW1vdmVCdG4gPSBmaWxlSXRlbS5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHUwMEQ3XCIsIGNsczogXCJyYWJiaXRtYXAtY2hhdC1jb250ZXh0LXJlbW92ZVwiIH0pO1xuXHRcdFx0XHRyZW1vdmVCdG4ub25jbGljayA9IChlKSA9PiB7XG5cdFx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuY2hhdFN0YXRlcy5nZXQobm9kZUlkKTtcblx0XHRcdFx0XHRpZiAoc3RhdGUpIHtcblx0XHRcdFx0XHRcdHN0YXRlLmNvbnRleHRGaWxlcyA9IHN0YXRlLmNvbnRleHRGaWxlcy5maWx0ZXIoZiA9PiBmICE9PSBmaWxlUGF0aCk7XG5cdFx0XHRcdFx0XHR0aGlzLmNoYXRTdGF0ZXMuc2V0KG5vZGVJZCwgc3RhdGUpO1xuXHRcdFx0XHRcdFx0cmVuZGVyQ29udGV4dEZpbGVzKCk7XG5cdFx0XHRcdFx0XHR0aGlzLnRyaWdnZXJTYXZlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRyZW5kZXJDb250ZXh0RmlsZXMoKTtcblxuXHRcdC8vIERyYWcgYW5kIGRyb3AgaGFuZGxpbmdcblx0XHRjb250YWluZXIuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdvdmVyXCIsIChlKSA9PiB7XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0Y29udGFpbmVyLmFkZENsYXNzKFwicmFiYml0bWFwLWRyYWctb3ZlclwiKTtcblx0XHR9KTtcblxuXHRcdGNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ2xlYXZlXCIsIChlKSA9PiB7XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRjb250YWluZXIucmVtb3ZlQ2xhc3MoXCJyYWJiaXRtYXAtZHJhZy1vdmVyXCIpO1xuXHRcdH0pO1xuXG5cdFx0Y29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoXCJkcm9wXCIsIChlKSA9PiB7XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0Y29udGFpbmVyLnJlbW92ZUNsYXNzKFwicmFiYml0bWFwLWRyYWctb3ZlclwiKTtcblxuXHRcdFx0Ly8gR2V0IGRyb3BwZWQgZGF0YSBmcm9tIE9ic2lkaWFuXG5cdFx0XHRjb25zdCBwbGFpblRleHQgPSBlLmRhdGFUcmFuc2Zlcj8uZ2V0RGF0YShcInRleHQvcGxhaW5cIikgfHwgXCJcIjtcblxuXHRcdFx0Ly8gUGFyc2UgcGF0aCBmcm9tIHZhcmlvdXMgZm9ybWF0c1xuXHRcdFx0Y29uc3QgcGFyc2VQYXRoID0gKGlucHV0OiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuXHRcdFx0XHRpbnB1dCA9IGlucHV0LnRyaW0oKTtcblxuXHRcdFx0XHQvLyBIYW5kbGUgb2JzaWRpYW46Ly8gVVJMIGZvcm1hdFxuXHRcdFx0XHRpZiAoaW5wdXQuc3RhcnRzV2l0aChcIm9ic2lkaWFuOi8vXCIpKSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGNvbnN0IHVybCA9IG5ldyBVUkwoaW5wdXQpO1xuXHRcdFx0XHRcdFx0Y29uc3QgZmlsZVBhdGggPSB1cmwuc2VhcmNoUGFyYW1zLmdldChcImZpbGVcIik7XG5cdFx0XHRcdFx0XHRpZiAoZmlsZVBhdGgpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChmaWxlUGF0aCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBjYXRjaCB7fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gSGFuZGxlIFVSTCBlbmNvZGluZ1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGlucHV0ID0gZGVjb2RlVVJJQ29tcG9uZW50KGlucHV0KTtcblx0XHRcdFx0fSBjYXRjaCB7fVxuXG5cdFx0XHRcdC8vIEhhbmRsZSBbW3dpa2lsaW5rXV0gZm9ybWF0XG5cdFx0XHRcdGNvbnN0IHdpa2lNYXRjaCA9IGlucHV0Lm1hdGNoKC9eXFxbXFxbKC4rPylcXF1cXF0kLyk7XG5cdFx0XHRcdGlmICh3aWtpTWF0Y2gpIHtcblx0XHRcdFx0XHRyZXR1cm4gd2lraU1hdGNoWzFdO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gSGFuZGxlIFtuYW1lXShwYXRoKSBmb3JtYXRcblx0XHRcdFx0Y29uc3QgbWRNYXRjaCA9IGlucHV0Lm1hdGNoKC9eXFxbLis/XFxdXFwoKC4rPylcXCkkLyk7XG5cdFx0XHRcdGlmIChtZE1hdGNoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG1kTWF0Y2hbMV07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBSZW1vdmUgbGVhZGluZyBzbGFzaCBpZiBwcmVzZW50XG5cdFx0XHRcdGlmIChpbnB1dC5zdGFydHNXaXRoKFwiL1wiKSkge1xuXHRcdFx0XHRcdGlucHV0ID0gaW5wdXQuc2xpY2UoMSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gaW5wdXQ7XG5cdFx0XHR9O1xuXG5cdFx0XHQvLyBBZGQgYWxsIGZpbGVzIGZyb20gYSBmb2xkZXIgcmVjdXJzaXZlbHlcblx0XHRcdGNvbnN0IGFkZEZpbGVzRnJvbUZvbGRlciA9IChmb2xkZXI6IFRGb2xkZXIsIHN0YXRlOiBDaGF0Tm9kZVN0YXRlKSA9PiB7XG5cdFx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2YgZm9sZGVyLmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0aWYgKGNoaWxkIGluc3RhbmNlb2YgVEZpbGUpIHtcblx0XHRcdFx0XHRcdGlmICghc3RhdGUuY29udGV4dEZpbGVzLmluY2x1ZGVzKGNoaWxkLnBhdGgpKSB7XG5cdFx0XHRcdFx0XHRcdHN0YXRlLmNvbnRleHRGaWxlcy5wdXNoKGNoaWxkLnBhdGgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURm9sZGVyKSB7XG5cdFx0XHRcdFx0XHRhZGRGaWxlc0Zyb21Gb2xkZXIoY2hpbGQsIHN0YXRlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdC8vIEdldCBhbGwgZm9sZGVycyByZWN1cnNpdmVseVxuXHRcdFx0Y29uc3QgZ2V0QWxsRm9sZGVycyA9IChmb2xkZXI6IFRGb2xkZXIpOiBURm9sZGVyW10gPT4ge1xuXHRcdFx0XHRjb25zdCBmb2xkZXJzOiBURm9sZGVyW10gPSBbZm9sZGVyXTtcblx0XHRcdFx0Zm9yIChjb25zdCBjaGlsZCBvZiBmb2xkZXIuY2hpbGRyZW4pIHtcblx0XHRcdFx0XHRpZiAoY2hpbGQgaW5zdGFuY2VvZiBURm9sZGVyKSB7XG5cdFx0XHRcdFx0XHRmb2xkZXJzLnB1c2goLi4uZ2V0QWxsRm9sZGVycyhjaGlsZCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZm9sZGVycztcblx0XHRcdH07XG5cblx0XHRcdC8vIFRyeSB0byBmaW5kIGZpbGUvZm9sZGVyIGJ5IHZhcmlvdXMgbWV0aG9kc1xuXHRcdFx0Y29uc3QgdHJ5QWRkUGF0aCA9IChpbnB1dDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdGlmICghaW5wdXQpIHJldHVybiBmYWxzZTtcblxuXHRcdFx0XHRsZXQgcGF0aCA9IHBhcnNlUGF0aChpbnB1dCk7XG5cdFx0XHRcdGlmICghcGF0aCkgcmV0dXJuIGZhbHNlO1xuXG5cdFx0XHRcdC8vIEhhbmRsZSBIVFRQIFVSTHMgYnkgY3JlYXRpbmcgYSBsaW5rIG5vZGVcblx0XHRcdFx0aWYgKHBhdGguc3RhcnRzV2l0aChcImh0dHBcIikpIHtcblx0XHRcdFx0XHRjb25zdCBjYW52YXNSZWN0ID0gdGhpcy5jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRcdFx0Y29uc3QgeCA9IChlLmNsaWVudFggLSBjYW52YXNSZWN0LmxlZnQgLSB0aGlzLnBhblgpIC8gdGhpcy5zY2FsZTtcblx0XHRcdFx0XHRjb25zdCB5ID0gKGUuY2xpZW50WSAtIGNhbnZhc1JlY3QudG9wIC0gdGhpcy5wYW5ZKSAvIHRoaXMuc2NhbGU7XG5cdFx0XHRcdFx0dGhpcy5hZGRMaW5rTm9kZShwYXRoLCB4IC0gMTUwLCB5IC0gMTAwKTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFRyeSB0byBmaW5kIHRoZSBmaWxlIG9yIGZvbGRlclxuXHRcdFx0XHRsZXQgaXRlbSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTtcblxuXHRcdFx0XHQvLyBJZiBub3QgZm91bmQsIHRyeSBhZGRpbmcgLm1kIGV4dGVuc2lvblxuXHRcdFx0XHRpZiAoIWl0ZW0gJiYgIXBhdGguaW5jbHVkZXMoXCIuXCIpKSB7XG5cdFx0XHRcdFx0aXRlbSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoICsgXCIubWRcIik7XG5cdFx0XHRcdFx0aWYgKGl0ZW0pIHBhdGggPSBwYXRoICsgXCIubWRcIjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIElmIHN0aWxsIG5vdCBmb3VuZCwgdHJ5IHRvIGZpbmQgZm9sZGVyIGJ5IG5hbWVcblx0XHRcdFx0aWYgKCFpdGVtICYmICFwYXRoLmluY2x1ZGVzKFwiLlwiKSkge1xuXHRcdFx0XHRcdGNvbnN0IHJvb3RGb2xkZXIgPSB0aGlzLmFwcC52YXVsdC5nZXRSb290KCk7XG5cdFx0XHRcdFx0Y29uc3QgYWxsRm9sZGVycyA9IGdldEFsbEZvbGRlcnMocm9vdEZvbGRlcik7XG5cdFx0XHRcdFx0Y29uc3QgZm9sZGVyTmFtZSA9IHBhdGguc3BsaXQoXCIvXCIpLnBvcCgpIHx8IHBhdGg7XG5cdFx0XHRcdFx0aXRlbSA9IGFsbEZvbGRlcnMuZmluZChmID0+XG5cdFx0XHRcdFx0XHRmLnBhdGggPT09IHBhdGggfHxcblx0XHRcdFx0XHRcdGYubmFtZSA9PT0gZm9sZGVyTmFtZSB8fFxuXHRcdFx0XHRcdFx0Zi5wYXRoLmVuZHNXaXRoKFwiL1wiICsgcGF0aClcblx0XHRcdFx0XHQpIHx8IG51bGw7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBJZiBzdGlsbCBub3QgZm91bmQsIHRyeSB0byBmaW5kIGJ5IG5hbWUgaW4gYWxsIGZpbGVzXG5cdFx0XHRcdGlmICghaXRlbSkge1xuXHRcdFx0XHRcdGNvbnN0IGFsbEZpbGVzID0gdGhpcy5hcHAudmF1bHQuZ2V0RmlsZXMoKTtcblx0XHRcdFx0XHRjb25zdCBmaWxlTmFtZSA9IHBhdGguc3BsaXQoXCIvXCIpLnBvcCgpIHx8IHBhdGg7XG5cdFx0XHRcdFx0aXRlbSA9IGFsbEZpbGVzLmZpbmQoZiA9PlxuXHRcdFx0XHRcdFx0Zi5wYXRoID09PSBwYXRoIHx8XG5cdFx0XHRcdFx0XHRmLm5hbWUgPT09IGZpbGVOYW1lIHx8XG5cdFx0XHRcdFx0XHRmLmJhc2VuYW1lID09PSBmaWxlTmFtZSB8fFxuXHRcdFx0XHRcdFx0Zi5wYXRoLmVuZHNXaXRoKFwiL1wiICsgcGF0aClcblx0XHRcdFx0XHQpIHx8IG51bGw7XG5cdFx0XHRcdFx0aWYgKGl0ZW0pIHBhdGggPSBpdGVtLnBhdGg7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuY2hhdFN0YXRlcy5nZXQobm9kZUlkKTtcblx0XHRcdFx0aWYgKCFzdGF0ZSkgcmV0dXJuIGZhbHNlO1xuXG5cdFx0XHRcdC8vIEhhbmRsZSBmb2xkZXIgLSBhZGQgYWxsIGZpbGVzIGZyb20gaXRcblx0XHRcdFx0aWYgKGl0ZW0gaW5zdGFuY2VvZiBURm9sZGVyKSB7XG5cdFx0XHRcdFx0YWRkRmlsZXNGcm9tRm9sZGVyKGl0ZW0sIHN0YXRlKTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEhhbmRsZSBmaWxlXG5cdFx0XHRcdGlmIChpdGVtIGluc3RhbmNlb2YgVEZpbGUpIHtcblx0XHRcdFx0XHRpZiAoIXN0YXRlLmNvbnRleHRGaWxlcy5pbmNsdWRlcyhwYXRoKSkge1xuXHRcdFx0XHRcdFx0c3RhdGUuY29udGV4dEZpbGVzLnB1c2gocGF0aCk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fTtcblxuXHRcdFx0bGV0IGFkZGVkID0gZmFsc2U7XG5cblx0XHRcdC8vIFRyeSBwbGFpbiB0ZXh0XG5cdFx0XHRpZiAocGxhaW5UZXh0KSB7XG5cdFx0XHRcdC8vIENvdWxkIGJlIG11bHRpcGxlIGxpbmVzXG5cdFx0XHRcdGNvbnN0IGxpbmVzID0gcGxhaW5UZXh0LnNwbGl0KFwiXFxuXCIpO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcblx0XHRcdFx0XHRpZiAodHJ5QWRkUGF0aChsaW5lLnRyaW0oKSkpIHtcblx0XHRcdFx0XHRcdGFkZGVkID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGFkZGVkKSB7XG5cdFx0XHRcdGNvbnN0IHN0YXRlID0gdGhpcy5jaGF0U3RhdGVzLmdldChub2RlSWQpO1xuXHRcdFx0XHRpZiAoc3RhdGUpIHtcblx0XHRcdFx0XHR0aGlzLmNoYXRTdGF0ZXMuc2V0KG5vZGVJZCwgc3RhdGUpO1xuXHRcdFx0XHRcdHJlbmRlckNvbnRleHRGaWxlcygpO1xuXHRcdFx0XHRcdHRoaXMudHJpZ2dlclNhdmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgbWVzc2FnZXNDb250YWluZXIgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1jaGF0LW1lc3NhZ2VzXCIgfSk7XG5cblx0XHQvLyBPbmx5IHByZXZlbnQgd2hlZWwgZXZlbnRzIGlmIG5vZGUgaXMgc2VsZWN0ZWRcblx0XHRtZXNzYWdlc0NvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKFwid2hlZWxcIiwgKGUpID0+IHtcblx0XHRcdGlmICh0aGlzLnNlbGVjdGVkTm9kZXMuaGFzKG5vZGVJZCkpIHtcblx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vIENsaWNrIG9uIG1lc3NhZ2VzIGFyZWEgc2VsZWN0cyB0aGUgbm9kZVxuXHRcdG1lc3NhZ2VzQ29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgKGUpID0+IHtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRpZiAoIXRoaXMuc2VsZWN0ZWROb2Rlcy5oYXMobm9kZUlkKSkge1xuXHRcdFx0XHR0aGlzLmNsZWFyU2VsZWN0aW9uKCk7XG5cdFx0XHRcdHRoaXMuc2VsZWN0Tm9kZShub2RlSWQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgbWVzc2FnZXMgPSB0aGlzLmNoYXRNZXNzYWdlcy5nZXQobm9kZUlkKSB8fCBbXTtcblx0XHRtZXNzYWdlcy5mb3JFYWNoKChtc2csIGluZGV4KSA9PiB7XG5cdFx0XHR0aGlzLnJlbmRlckNoYXRNZXNzYWdlKG1lc3NhZ2VzQ29udGFpbmVyLCBtc2csIG5vZGVJZCwgaW5kZXgpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgaW5wdXRBcmVhID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtY2hhdC1pbnB1dC1hcmVhXCIgfSk7XG5cdFx0Y29uc3QgaW5wdXQgPSBpbnB1dEFyZWEuY3JlYXRlRWwoXCJ0ZXh0YXJlYVwiLCB7XG5cdFx0XHRjbHM6IFwicmFiYml0bWFwLWNoYXQtaW5wdXRcIixcblx0XHRcdGF0dHI6IHsgcGxhY2Vob2xkZXI6IFwiVHlwZSBhIG1lc3NhZ2UuLi5cIiB9LFxuXHRcdH0pO1xuXG5cdFx0Ly8gRm9jdXMgb24gaW5wdXQgc2VsZWN0cyB0aGUgbm9kZVxuXHRcdGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJmb2N1c1wiLCAoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuc2VsZWN0ZWROb2Rlcy5oYXMobm9kZUlkKSkge1xuXHRcdFx0XHR0aGlzLmNsZWFyU2VsZWN0aW9uKCk7XG5cdFx0XHRcdHRoaXMuc2VsZWN0Tm9kZShub2RlSWQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3Qgc2VuZEJ0biA9IGlucHV0QXJlYS5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHR0ZXh0OiBcIlNlbmRcIixcblx0XHRcdGNsczogXCJyYWJiaXRtYXAtc2VuZC1idG5cIixcblx0XHR9KTtcblxuXHRcdGNvbnN0IHNlbmRNZXNzYWdlID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGV4dCA9IGlucHV0LnZhbHVlLnRyaW0oKTtcblx0XHRcdGlmICghdGV4dCkgcmV0dXJuO1xuXG5cdFx0XHQvLyBHZXQgY2hhdCBzdGF0ZSB0byBjYXB0dXJlIGN1cnJlbnQgY29udGV4dFxuXHRcdFx0Y29uc3QgY2hhdFN0YXRlID0gdGhpcy5jaGF0U3RhdGVzLmdldChub2RlSWQpITtcblxuXHRcdFx0Y29uc3QgbXNnOiBDaGF0TWVzc2FnZSA9IHtcblx0XHRcdFx0cm9sZTogXCJ1c2VyXCIsXG5cdFx0XHRcdGNvbnRlbnQ6IHRleHQsXG5cdFx0XHRcdGNvbnRleHRGaWxlczogY2hhdFN0YXRlLmNvbnRleHRGaWxlcyA/IFsuLi5jaGF0U3RhdGUuY29udGV4dEZpbGVzXSA6IFtdXG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgbWVzc2FnZXMgPSB0aGlzLmNoYXRNZXNzYWdlcy5nZXQobm9kZUlkKSB8fCBbXTtcblx0XHRcdG1lc3NhZ2VzLnB1c2gobXNnKTtcblx0XHRcdHRoaXMuY2hhdE1lc3NhZ2VzLnNldChub2RlSWQsIG1lc3NhZ2VzKTtcblx0XHRcdHRoaXMucmVuZGVyQ2hhdE1lc3NhZ2UobWVzc2FnZXNDb250YWluZXIsIG1zZywgbm9kZUlkLCBtZXNzYWdlcy5sZW5ndGggLSAxKTtcblx0XHRcdGlucHV0LnZhbHVlID0gXCJcIjtcblx0XHRcdG1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbFRvcCA9IG1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbEhlaWdodDtcblx0XHRcdHRoaXMudHJpZ2dlclNhdmUoKTtcblx0XHRcdGNvbnN0IHByb3ZpZGVyID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MucHJvdmlkZXJzLmZpbmQocCA9PiBwLm5hbWUgPT09IGNoYXRTdGF0ZS5wcm92aWRlcik7XG5cdFx0XHRpZiAoIXByb3ZpZGVyKSByZXR1cm47XG5cblx0XHRcdC8vIEdldCBBUEkga2V5IGZyb20gcHJvdmlkZXIgY29uZmlnICh3aXRoIGZhbGxiYWNrIHRvIGxlZ2FjeSBmaWVsZHMgZm9yIG1pZ3JhdGlvbilcblx0XHRcdGxldCBhcGlLZXkgPSBwcm92aWRlci5hcGlLZXkgfHwgXCJcIjtcblx0XHRcdGlmICghYXBpS2V5KSB7XG5cdFx0XHRcdC8vIEZhbGxiYWNrIHRvIGxlZ2FjeSBBUEkga2V5IGZpZWxkcyBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eVxuXHRcdFx0XHRpZiAoY2hhdFN0YXRlLnByb3ZpZGVyID09PSBcIk9wZW5BSVwiICYmIHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haUFwaUtleSkge1xuXHRcdFx0XHRcdGFwaUtleSA9IHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5haUFwaUtleTtcblx0XHRcdFx0fSBlbHNlIGlmIChjaGF0U3RhdGUucHJvdmlkZXIgPT09IFwiT3BlblJvdXRlclwiICYmIHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5yb3V0ZXJBcGlLZXkpIHtcblx0XHRcdFx0XHRhcGlLZXkgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcGVucm91dGVyQXBpS2V5O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICghYXBpS2V5KSB7XG5cdFx0XHRcdGNvbnN0IGVycm9yTXNnOiBDaGF0TWVzc2FnZSA9IHtcblx0XHRcdFx0XHRyb2xlOiBcImFzc2lzdGFudFwiLFxuXHRcdFx0XHRcdGNvbnRlbnQ6IGBQbGVhc2Ugc2V0IHlvdXIgJHtjaGF0U3RhdGUucHJvdmlkZXJ9IEFQSSBrZXkgaW4gc2V0dGluZ3MuYCxcblx0XHRcdFx0fTtcblx0XHRcdFx0bWVzc2FnZXMucHVzaChlcnJvck1zZyk7XG5cdFx0XHRcdHRoaXMucmVuZGVyQ2hhdE1lc3NhZ2UobWVzc2FnZXNDb250YWluZXIsIGVycm9yTXNnLCBub2RlSWQsIG1lc3NhZ2VzLmxlbmd0aCAtIDEpO1xuXHRcdFx0XHRtZXNzYWdlc0NvbnRhaW5lci5zY3JvbGxUb3AgPSBtZXNzYWdlc0NvbnRhaW5lci5zY3JvbGxIZWlnaHQ7XG5cdFx0XHRcdHRoaXMudHJpZ2dlclNhdmUoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBTaG93IGxvYWRpbmcgaW5kaWNhdG9yXG5cdFx0XHRjb25zdCBsb2FkaW5nRWwgPSBtZXNzYWdlc0NvbnRhaW5lci5jcmVhdGVEaXYoe1xuXHRcdFx0XHRjbHM6IFwicmFiYml0bWFwLWNoYXQtbWVzc2FnZSByYWJiaXRtYXAtY2hhdC1hc3Npc3RhbnQgcmFiYml0bWFwLWNoYXQtbG9hZGluZ1wiLFxuXHRcdFx0fSk7XG5cdFx0XHRsb2FkaW5nRWwuY3JlYXRlU3Bhbih7IHRleHQ6IFwiLi4uXCIgfSk7XG5cdFx0XHRtZXNzYWdlc0NvbnRhaW5lci5zY3JvbGxUb3AgPSBtZXNzYWdlc0NvbnRhaW5lci5zY3JvbGxIZWlnaHQ7XG5cblx0XHRcdC8vIExvYWQgY29udGV4dCBmaWxlcyBjb250ZW50XG5cdFx0XHRsZXQgY29udGV4dENvbnRlbnQgPSBcIlwiO1xuXHRcdFx0aWYgKGNoYXRTdGF0ZS5jb250ZXh0RmlsZXMgJiYgY2hhdFN0YXRlLmNvbnRleHRGaWxlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGNvbnN0IHRlbXBsYXRlID0gY2hhdFN0YXRlLmNvbnRleHRUZW1wbGF0ZSB8fCBERUZBVUxUX0NPTlRFWFRfVEVNUExBVEU7XG5cdFx0XHRcdGNvbnN0IGNvbnRleHRQYXJ0czogc3RyaW5nW10gPSBbXTtcblx0XHRcdFx0Zm9yIChjb25zdCBmaWxlUGF0aCBvZiBjaGF0U3RhdGUuY29udGV4dEZpbGVzKSB7XG5cdFx0XHRcdFx0Y29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlUGF0aCk7XG5cdFx0XHRcdFx0aWYgKGZpbGUgJiYgZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcblx0XHRcdFx0XHRcdFx0Y29uc3QgZm9ybWF0dGVkID0gdGVtcGxhdGVcblx0XHRcdFx0XHRcdFx0XHQucmVwbGFjZSgvXFx7ZmlsZXBhdGhcXH0vZywgZmlsZVBhdGgpXG5cdFx0XHRcdFx0XHRcdFx0LnJlcGxhY2UoL1xce2ZpbGVuYW1lXFx9L2csIGZpbGUubmFtZSlcblx0XHRcdFx0XHRcdFx0XHQucmVwbGFjZSgvXFx7Y29udGVudFxcfS9nLCBjb250ZW50KTtcblx0XHRcdFx0XHRcdFx0Y29udGV4dFBhcnRzLnB1c2goZm9ybWF0dGVkKTtcblx0XHRcdFx0XHRcdH0gY2F0Y2gge31cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGNvbnRleHRQYXJ0cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0Y29udGV4dENvbnRlbnQgPSBcIkNvbnRleHQgZmlsZXM6XFxuXFxuXCIgKyBjb250ZXh0UGFydHMuam9pbihcIlxcblxcblwiKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuY2FsbExMTShwcm92aWRlciwgYXBpS2V5LCBjaGF0U3RhdGUubW9kZWwsIG1lc3NhZ2VzLCBjb250ZXh0Q29udGVudCwgY2hhdFN0YXRlLnN5c3RlbVByb21wdCB8fCBcIlwiKTtcblx0XHRcdFx0bG9hZGluZ0VsLnJlbW92ZSgpO1xuXG5cdFx0XHRcdGNvbnN0IGFzc2lzdGFudE1zZzogQ2hhdE1lc3NhZ2UgPSB7XG5cdFx0XHRcdFx0cm9sZTogXCJhc3Npc3RhbnRcIixcblx0XHRcdFx0XHRjb250ZW50OiByZXNwb25zZSxcblx0XHRcdFx0fTtcblx0XHRcdFx0bWVzc2FnZXMucHVzaChhc3Npc3RhbnRNc2cpO1xuXHRcdFx0XHR0aGlzLnJlbmRlckNoYXRNZXNzYWdlKG1lc3NhZ2VzQ29udGFpbmVyLCBhc3Npc3RhbnRNc2csIG5vZGVJZCwgbWVzc2FnZXMubGVuZ3RoIC0gMSk7XG5cdFx0XHRcdG1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbFRvcCA9IG1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbEhlaWdodDtcblx0XHRcdFx0dGhpcy50cmlnZ2VyU2F2ZSgpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0bG9hZGluZ0VsLnJlbW92ZSgpO1xuXHRcdFx0XHRjb25zdCBlcnJvck1zZzogQ2hhdE1lc3NhZ2UgPSB7XG5cdFx0XHRcdFx0cm9sZTogXCJhc3Npc3RhbnRcIixcblx0XHRcdFx0XHRjb250ZW50OiBgRXJyb3I6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIlVua25vd24gZXJyb3JcIn1gLFxuXHRcdFx0XHR9O1xuXHRcdFx0XHRtZXNzYWdlcy5wdXNoKGVycm9yTXNnKTtcblx0XHRcdFx0dGhpcy5yZW5kZXJDaGF0TWVzc2FnZShtZXNzYWdlc0NvbnRhaW5lciwgZXJyb3JNc2csIG5vZGVJZCwgbWVzc2FnZXMubGVuZ3RoIC0gMSk7XG5cdFx0XHRcdG1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbFRvcCA9IG1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbEhlaWdodDtcblx0XHRcdFx0dGhpcy50cmlnZ2VyU2F2ZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRzZW5kQnRuLm9uY2xpY2sgPSBzZW5kTWVzc2FnZTtcblx0XHRpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZSkgPT4ge1xuXHRcdFx0aWYgKGUua2V5ID09PSBcIkVudGVyXCIgJiYgIWUuc2hpZnRLZXkpIHtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRzZW5kTWVzc2FnZSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjYWxsTExNKHByb3ZpZGVyOiBQcm92aWRlckNvbmZpZywgYXBpS2V5OiBzdHJpbmcsIG1vZGVsOiBzdHJpbmcsIG1lc3NhZ2VzOiBDaGF0TWVzc2FnZVtdLCBjb250ZXh0OiBzdHJpbmcgPSBcIlwiLCBzeXN0ZW1Qcm9tcHQ6IHN0cmluZyA9IFwiXCIpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGNvbnN0IGFwaUZvcm1hdCA9IHByb3ZpZGVyLmFwaUZvcm1hdCB8fCBcIm9wZW5haVwiO1xuXG5cdFx0c3dpdGNoIChhcGlGb3JtYXQpIHtcblx0XHRcdGNhc2UgXCJhbnRocm9waWNcIjpcblx0XHRcdFx0cmV0dXJuIHRoaXMuY2FsbEFudGhyb3BpY0FQSShwcm92aWRlciwgYXBpS2V5LCBtb2RlbCwgbWVzc2FnZXMsIGNvbnRleHQsIHN5c3RlbVByb21wdCk7XG5cdFx0XHRjYXNlIFwiZ29vZ2xlXCI6XG5cdFx0XHRcdHJldHVybiB0aGlzLmNhbGxHb29nbGVBUEkocHJvdmlkZXIsIGFwaUtleSwgbW9kZWwsIG1lc3NhZ2VzLCBjb250ZXh0LCBzeXN0ZW1Qcm9tcHQpO1xuXHRcdFx0Y2FzZSBcIm9wZW5haVwiOlxuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIHRoaXMuY2FsbE9wZW5BSUFQSShwcm92aWRlciwgYXBpS2V5LCBtb2RlbCwgbWVzc2FnZXMsIGNvbnRleHQsIHN5c3RlbVByb21wdCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjYWxsT3BlbkFJQVBJKHByb3ZpZGVyOiBQcm92aWRlckNvbmZpZywgYXBpS2V5OiBzdHJpbmcsIG1vZGVsOiBzdHJpbmcsIG1lc3NhZ2VzOiBDaGF0TWVzc2FnZVtdLCBjb250ZXh0OiBzdHJpbmcsIHN5c3RlbVByb21wdDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRjb25zdCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuXHRcdFx0XCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG5cdFx0XHRcIkF1dGhvcml6YXRpb25cIjogYEJlYXJlciAke2FwaUtleX1gLFxuXHRcdH07XG5cblx0XHQvLyBPcGVuUm91dGVyIHJlcXVpcmVzIGFkZGl0aW9uYWwgaGVhZGVyc1xuXHRcdGlmIChwcm92aWRlci5uYW1lID09PSBcIk9wZW5Sb3V0ZXJcIikge1xuXHRcdFx0aGVhZGVyc1tcIkhUVFAtUmVmZXJlclwiXSA9IFwiaHR0cHM6Ly9vYnNpZGlhbi5tZFwiO1xuXHRcdFx0aGVhZGVyc1tcIlgtVGl0bGVcIl0gPSBcIlJhYmJpdE1hcFwiO1xuXHRcdH1cblxuXHRcdC8vIEJ1aWxkIG1lc3NhZ2VzIGFycmF5IHdpdGggc3lzdGVtIHByb21wdCBhbmQgY29udGV4dFxuXHRcdGNvbnN0IGFwaU1lc3NhZ2VzOiB7IHJvbGU6IHN0cmluZzsgY29udGVudDogc3RyaW5nIH1bXSA9IFtdO1xuXG5cdFx0Ly8gQ29tYmluZSBzeXN0ZW0gcHJvbXB0IGFuZCBjb250ZXh0XG5cdFx0Y29uc3Qgc3lzdGVtUGFydHM6IHN0cmluZ1tdID0gW107XG5cdFx0aWYgKHN5c3RlbVByb21wdCkge1xuXHRcdFx0c3lzdGVtUGFydHMucHVzaChzeXN0ZW1Qcm9tcHQpO1xuXHRcdH1cblx0XHRpZiAoY29udGV4dCkge1xuXHRcdFx0c3lzdGVtUGFydHMucHVzaChjb250ZXh0KTtcblx0XHR9XG5cdFx0aWYgKHN5c3RlbVBhcnRzLmxlbmd0aCA+IDApIHtcblx0XHRcdGFwaU1lc3NhZ2VzLnB1c2goeyByb2xlOiBcInN5c3RlbVwiLCBjb250ZW50OiBzeXN0ZW1QYXJ0cy5qb2luKFwiXFxuXFxuXCIpIH0pO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgbSBvZiBtZXNzYWdlcykge1xuXHRcdFx0YXBpTWVzc2FnZXMucHVzaCh7IHJvbGU6IG0ucm9sZSwgY29udGVudDogbS5jb250ZW50IH0pO1xuXHRcdH1cblxuXHRcdC8vIE5vcm1hbGl6ZSBiYXNlVXJsIC0gcmVtb3ZlIHRyYWlsaW5nIHNsYXNoXG5cdFx0Y29uc3QgYmFzZVVybCA9IHByb3ZpZGVyLmJhc2VVcmwucmVwbGFjZSgvXFwvKyQvLCBcIlwiKTtcblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke2Jhc2VVcmx9L2NoYXQvY29tcGxldGlvbnNgLCB7XG5cdFx0XHRtZXRob2Q6IFwiUE9TVFwiLFxuXHRcdFx0aGVhZGVycyxcblx0XHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0bW9kZWw6IG1vZGVsLFxuXHRcdFx0XHRtZXNzYWdlczogYXBpTWVzc2FnZXMsXG5cdFx0XHR9KSxcblx0XHR9KTtcblxuXHRcdGlmICghcmVzcG9uc2Uub2spIHtcblx0XHRcdGNvbnN0IGVycm9yID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBBUEkgZXJyb3I6ICR7cmVzcG9uc2Uuc3RhdHVzfSAtICR7ZXJyb3J9YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblx0XHRyZXR1cm4gZGF0YS5jaG9pY2VzWzBdPy5tZXNzYWdlPy5jb250ZW50IHx8IFwiTm8gcmVzcG9uc2VcIjtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY2FsbEFudGhyb3BpY0FQSShwcm92aWRlcjogUHJvdmlkZXJDb25maWcsIGFwaUtleTogc3RyaW5nLCBtb2RlbDogc3RyaW5nLCBtZXNzYWdlczogQ2hhdE1lc3NhZ2VbXSwgY29udGV4dDogc3RyaW5nLCBzeXN0ZW1Qcm9tcHQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0Y29uc3QgaGVhZGVyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcblx0XHRcdFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuXHRcdFx0XCJ4LWFwaS1rZXlcIjogYXBpS2V5LFxuXHRcdFx0XCJhbnRocm9waWMtdmVyc2lvblwiOiBcIjIwMjMtMDYtMDFcIixcblx0XHRcdFwiYW50aHJvcGljLWRhbmdlcm91cy1kaXJlY3QtYnJvd3Nlci1hY2Nlc3NcIjogXCJ0cnVlXCIsXG5cdFx0fTtcblxuXHRcdC8vIEJ1aWxkIHN5c3RlbSBwcm9tcHRcblx0XHRjb25zdCBzeXN0ZW1QYXJ0czogc3RyaW5nW10gPSBbXTtcblx0XHRpZiAoc3lzdGVtUHJvbXB0KSB7XG5cdFx0XHRzeXN0ZW1QYXJ0cy5wdXNoKHN5c3RlbVByb21wdCk7XG5cdFx0fVxuXHRcdGlmIChjb250ZXh0KSB7XG5cdFx0XHRzeXN0ZW1QYXJ0cy5wdXNoKGNvbnRleHQpO1xuXHRcdH1cblxuXHRcdC8vIEJ1aWxkIG1lc3NhZ2VzIGFycmF5IChBbnRocm9waWMgZm9ybWF0KVxuXHRcdGNvbnN0IGFwaU1lc3NhZ2VzOiB7IHJvbGU6IHN0cmluZzsgY29udGVudDogc3RyaW5nIH1bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgbSBvZiBtZXNzYWdlcykge1xuXHRcdFx0YXBpTWVzc2FnZXMucHVzaCh7IHJvbGU6IG0ucm9sZSwgY29udGVudDogbS5jb250ZW50IH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlcXVlc3RCb2R5OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcblx0XHRcdG1vZGVsOiBtb2RlbCxcblx0XHRcdG1heF90b2tlbnM6IDQwOTYsXG5cdFx0XHRtZXNzYWdlczogYXBpTWVzc2FnZXMsXG5cdFx0fTtcblxuXHRcdGlmIChzeXN0ZW1QYXJ0cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRyZXF1ZXN0Qm9keS5zeXN0ZW0gPSBzeXN0ZW1QYXJ0cy5qb2luKFwiXFxuXFxuXCIpO1xuXHRcdH1cblxuXHRcdC8vIE5vcm1hbGl6ZSBiYXNlVXJsIC0gcmVtb3ZlIHRyYWlsaW5nIHNsYXNoIGFuZCBlbnN1cmUgY29ycmVjdCBwYXRoXG5cdFx0Y29uc3QgYmFzZVVybCA9IHByb3ZpZGVyLmJhc2VVcmwucmVwbGFjZSgvXFwvKyQvLCBcIlwiKTtcblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke2Jhc2VVcmx9L3YxL21lc3NhZ2VzYCwge1xuXHRcdFx0bWV0aG9kOiBcIlBPU1RcIixcblx0XHRcdGhlYWRlcnMsXG5cdFx0XHRib2R5OiBKU09OLnN0cmluZ2lmeShyZXF1ZXN0Qm9keSksXG5cdFx0fSk7XG5cblx0XHRpZiAoIXJlc3BvbnNlLm9rKSB7XG5cdFx0XHRjb25zdCBlcnJvciA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgQW50aHJvcGljIEFQSSBlcnJvcjogJHtyZXNwb25zZS5zdGF0dXN9IC0gJHtlcnJvcn1gKTtcblx0XHR9XG5cblx0XHRjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuXHRcdC8vIEFudGhyb3BpYyByZXR1cm5zIGNvbnRlbnQgYXMgYW4gYXJyYXkgb2YgY29udGVudCBibG9ja3Ncblx0XHRpZiAoZGF0YS5jb250ZW50ICYmIEFycmF5LmlzQXJyYXkoZGF0YS5jb250ZW50KSkge1xuXHRcdFx0cmV0dXJuIGRhdGEuY29udGVudFxuXHRcdFx0XHQuZmlsdGVyKChibG9jazogeyB0eXBlOiBzdHJpbmcgfSkgPT4gYmxvY2sudHlwZSA9PT0gXCJ0ZXh0XCIpXG5cdFx0XHRcdC5tYXAoKGJsb2NrOiB7IHRleHQ6IHN0cmluZyB9KSA9PiBibG9jay50ZXh0KVxuXHRcdFx0XHQuam9pbihcIlwiKTtcblx0XHR9XG5cdFx0cmV0dXJuIFwiTm8gcmVzcG9uc2VcIjtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY2FsbEdvb2dsZUFQSShwcm92aWRlcjogUHJvdmlkZXJDb25maWcsIGFwaUtleTogc3RyaW5nLCBtb2RlbDogc3RyaW5nLCBtZXNzYWdlczogQ2hhdE1lc3NhZ2VbXSwgY29udGV4dDogc3RyaW5nLCBzeXN0ZW1Qcm9tcHQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0Ly8gQnVpbGQgc3lzdGVtIGluc3RydWN0aW9uXG5cdFx0Y29uc3Qgc3lzdGVtUGFydHM6IHN0cmluZ1tdID0gW107XG5cdFx0aWYgKHN5c3RlbVByb21wdCkge1xuXHRcdFx0c3lzdGVtUGFydHMucHVzaChzeXN0ZW1Qcm9tcHQpO1xuXHRcdH1cblx0XHRpZiAoY29udGV4dCkge1xuXHRcdFx0c3lzdGVtUGFydHMucHVzaChjb250ZXh0KTtcblx0XHR9XG5cblx0XHQvLyBCdWlsZCBjb250ZW50cyBhcnJheSAoR29vZ2xlIEdlbWluaSBmb3JtYXQpXG5cdFx0Y29uc3QgY29udGVudHM6IHsgcm9sZTogc3RyaW5nOyBwYXJ0czogeyB0ZXh0OiBzdHJpbmcgfVtdIH1bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgbSBvZiBtZXNzYWdlcykge1xuXHRcdFx0Y29udGVudHMucHVzaCh7XG5cdFx0XHRcdHJvbGU6IG0ucm9sZSA9PT0gXCJhc3Npc3RhbnRcIiA/IFwibW9kZWxcIiA6IFwidXNlclwiLFxuXHRcdFx0XHRwYXJ0czogW3sgdGV4dDogbS5jb250ZW50IH1dXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRjb25zdCByZXF1ZXN0Qm9keTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG5cdFx0XHRjb250ZW50czogY29udGVudHMsXG5cdFx0fTtcblxuXHRcdGlmIChzeXN0ZW1QYXJ0cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRyZXF1ZXN0Qm9keS5zeXN0ZW1JbnN0cnVjdGlvbiA9IHtcblx0XHRcdFx0cGFydHM6IFt7IHRleHQ6IHN5c3RlbVBhcnRzLmpvaW4oXCJcXG5cXG5cIikgfV1cblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gTm9ybWFsaXplIGJhc2VVcmwgLSByZW1vdmUgdHJhaWxpbmcgc2xhc2hcblx0XHRjb25zdCBiYXNlVXJsID0gcHJvdmlkZXIuYmFzZVVybC5yZXBsYWNlKC9cXC8rJC8sIFwiXCIpO1xuXHRcdC8vIEdvb2dsZSB1c2VzIEFQSSBrZXkgYXMgcXVlcnkgcGFyYW1ldGVyXG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHtiYXNlVXJsfS9tb2RlbHMvJHttb2RlbH06Z2VuZXJhdGVDb250ZW50P2tleT0ke2FwaUtleX1gLCB7XG5cdFx0XHRtZXRob2Q6IFwiUE9TVFwiLFxuXHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHRcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcblx0XHRcdH0sXG5cdFx0XHRib2R5OiBKU09OLnN0cmluZ2lmeShyZXF1ZXN0Qm9keSksXG5cdFx0fSk7XG5cblx0XHRpZiAoIXJlc3BvbnNlLm9rKSB7XG5cdFx0XHRjb25zdCBlcnJvciA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgR29vZ2xlIEFQSSBlcnJvcjogJHtyZXNwb25zZS5zdGF0dXN9IC0gJHtlcnJvcn1gKTtcblx0XHR9XG5cblx0XHRjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuXHRcdC8vIEdvb2dsZSByZXR1cm5zIGNhbmRpZGF0ZXMgYXJyYXkgd2l0aCBwYXJ0cyB0aGF0IGNhbiBiZSB0ZXh0IG9yIGlubGluZURhdGEgKGltYWdlcylcblx0XHRpZiAoZGF0YS5jYW5kaWRhdGVzICYmIGRhdGEuY2FuZGlkYXRlc1swXT8uY29udGVudD8ucGFydHMpIHtcblx0XHRcdGNvbnN0IHBhcnRzID0gZGF0YS5jYW5kaWRhdGVzWzBdLmNvbnRlbnQucGFydHM7XG5cdFx0XHRjb25zdCByZXN1bHRQYXJ0czogc3RyaW5nW10gPSBbXTtcblxuXHRcdFx0Zm9yIChjb25zdCBwYXJ0IG9mIHBhcnRzKSB7XG5cdFx0XHRcdGlmIChwYXJ0LnRleHQpIHtcblx0XHRcdFx0XHQvLyBUZXh0IGNvbnRlbnRcblx0XHRcdFx0XHRyZXN1bHRQYXJ0cy5wdXNoKHBhcnQudGV4dCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAocGFydC5pbmxpbmVEYXRhKSB7XG5cdFx0XHRcdFx0Ly8gSW1hZ2UgY29udGVudCAtIGNvbnZlcnQgdG8gTWFya2Rvd24gZGF0YSBVUkxcblx0XHRcdFx0XHRjb25zdCB7IG1pbWVUeXBlLCBkYXRhOiBiYXNlNjREYXRhIH0gPSBwYXJ0LmlubGluZURhdGE7XG5cdFx0XHRcdFx0Y29uc3QgZGF0YVVybCA9IGBkYXRhOiR7bWltZVR5cGV9O2Jhc2U2NCwke2Jhc2U2NERhdGF9YDtcblx0XHRcdFx0XHRyZXN1bHRQYXJ0cy5wdXNoKGBcXG5cXG4hW0dlbmVyYXRlZCBJbWFnZV0oJHtkYXRhVXJsfSlcXG5cXG5gKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVzdWx0UGFydHMuam9pbihcIlwiKSB8fCBcIk5vIHJlc3BvbnNlXCI7XG5cdFx0fVxuXHRcdHJldHVybiBcIk5vIHJlc3BvbnNlXCI7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckNoYXRNZXNzYWdlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIG1zZzogQ2hhdE1lc3NhZ2UsIG5vZGVJZDogc3RyaW5nLCBtc2dJbmRleDogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgbXNnRWwgPSBjb250YWluZXIuY3JlYXRlRGl2KHtcblx0XHRcdGNsczogYHJhYmJpdG1hcC1jaGF0LW1lc3NhZ2UgcmFiYml0bWFwLWNoYXQtJHttc2cucm9sZX1gLFxuXHRcdH0pO1xuXG5cdFx0Ly8gUmVuZGVyIG1hcmtkb3duIGZvciBhc3Npc3RhbnQgbWVzc2FnZXMsIHBsYWluIHRleHQgZm9yIHVzZXJcblx0XHRpZiAobXNnLnJvbGUgPT09IFwiYXNzaXN0YW50XCIpIHtcblx0XHRcdGNvbnN0IGNvbnRlbnRFbCA9IG1zZ0VsLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtbWVzc2FnZS1jb250ZW50XCIgfSk7XG5cdFx0XHRNYXJrZG93blJlbmRlcmVyLnJlbmRlcihcblx0XHRcdFx0dGhpcy5hcHAsXG5cdFx0XHRcdG1zZy5jb250ZW50LFxuXHRcdFx0XHRjb250ZW50RWwsXG5cdFx0XHRcdFwiXCIsXG5cdFx0XHRcdG5ldyBDb21wb25lbnQoKVxuXHRcdFx0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bXNnRWwuY3JlYXRlU3Bhbih7IHRleHQ6IG1zZy5jb250ZW50IH0pO1xuXHRcdH1cblxuXHRcdC8vIENvbnRleHQgbWVudSBvbiByaWdodCBjbGlja1xuXHRcdG1zZ0VsLmFkZEV2ZW50TGlzdGVuZXIoXCJjb250ZXh0bWVudVwiLCAoZSkgPT4ge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdHRoaXMuc2hvd01lc3NhZ2VDb250ZXh0TWVudShub2RlSWQsIG1zZ0luZGV4LCBlKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgc2hvd01lc3NhZ2VDb250ZXh0TWVudShub2RlSWQ6IHN0cmluZywgbXNnSW5kZXg6IG51bWJlciwgZTogTW91c2VFdmVudCk6IHZvaWQge1xuXHRcdGNvbnN0IG1lbnUgPSBuZXcgTWVudSgpO1xuXG5cdFx0bWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG5cdFx0XHRpdGVtLnNldFRpdGxlKFwiQnJhbmNoIGZyb20gaGVyZVwiKVxuXHRcdFx0XHQuc2V0SWNvbihcImdpdC1icmFuY2hcIilcblx0XHRcdFx0Lm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuYnJhbmNoQ2hhdChub2RlSWQsIG1zZ0luZGV4KTtcblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcblx0XHRcdGl0ZW0uc2V0VGl0bGUoXCJGb3JrXCIpXG5cdFx0XHRcdC5zZXRJY29uKFwiZ2l0LWZvcmtcIilcblx0XHRcdFx0Lm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuZm9ya0NoYXQobm9kZUlkKTtcblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRtZW51LmFkZFNlcGFyYXRvcigpO1xuXG5cdFx0bWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG5cdFx0XHRpdGVtLnNldFRpdGxlKFwiU2F2ZSB0aGlzIG1lc3NhZ2VcIilcblx0XHRcdFx0LnNldEljb24oXCJmaWxlLXRleHRcIilcblx0XHRcdFx0Lm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuZXhwb3J0TWVzc2FnZVRvTWQobm9kZUlkLCBtc2dJbmRleCwgZmFsc2UpO1xuXHRcdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuXHRcdFx0aXRlbS5zZXRUaXRsZShcIlNhdmUgY2hhdCB1cCB0byBoZXJlXCIpXG5cdFx0XHRcdC5zZXRJY29uKFwiZmlsZXNcIilcblx0XHRcdFx0Lm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuZXhwb3J0TWVzc2FnZVRvTWQobm9kZUlkLCBtc2dJbmRleCwgdHJ1ZSk7XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0bWVudS5zaG93QXRNb3VzZUV2ZW50KGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBleHBvcnRNZXNzYWdlVG9NZChub2RlSWQ6IHN0cmluZywgbXNnSW5kZXg6IG51bWJlciwgaW5jbHVkZUhpc3Rvcnk6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBtZXNzYWdlcyA9IHRoaXMuY2hhdE1lc3NhZ2VzLmdldChub2RlSWQpIHx8IFtdO1xuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLm5vZGVzLmdldChub2RlSWQpO1xuXHRcdGNvbnN0IGNoYXRTdGF0ZSA9IHRoaXMuY2hhdFN0YXRlcy5nZXQobm9kZUlkKTtcblxuXHRcdGlmICghbm9kZSB8fCBtc2dJbmRleCA+PSBtZXNzYWdlcy5sZW5ndGgpIHJldHVybjtcblxuXHRcdGNvbnN0IHRpdGxlID0gbm9kZS50aXRsZSB8fCBcIkNoYXRcIjtcblx0XHRsZXQgbWQgPSBgIyAke3RpdGxlfVxcblxcbmA7XG5cblx0XHRpZiAoY2hhdFN0YXRlKSB7XG5cdFx0XHRtZCArPSBgPiAqKk1vZGVsOioqICR7Y2hhdFN0YXRlLnByb3ZpZGVyfSAvICR7Y2hhdFN0YXRlLm1vZGVsfVxcblxcbmA7XG5cdFx0fVxuXG5cdFx0bWQgKz0gYC0tLVxcblxcbmA7XG5cblx0XHRpZiAoaW5jbHVkZUhpc3RvcnkpIHtcblx0XHRcdC8vIEV4cG9ydCBhbGwgbWVzc2FnZXMgdXAgdG8gYW5kIGluY2x1ZGluZyBtc2dJbmRleFxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPD0gbXNnSW5kZXg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBtc2cgPSBtZXNzYWdlc1tpXTtcblx0XHRcdFx0aWYgKG1zZy5yb2xlID09PSBcInVzZXJcIikge1xuXHRcdFx0XHRcdG1kICs9IGAjIyBVc2VyXFxuXFxuYDtcblx0XHRcdFx0XHRpZiAobXNnLmNvbnRleHRGaWxlcyAmJiBtc2cuY29udGV4dEZpbGVzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdG1kICs9IGA+ICoqQ29udGV4dDoqKiBgO1xuXHRcdFx0XHRcdFx0bWQgKz0gbXNnLmNvbnRleHRGaWxlcy5tYXAoZiA9PiBgW1ske2Z9XV1gKS5qb2luKFwiLCBcIik7XG5cdFx0XHRcdFx0XHRtZCArPSBgXFxuXFxuYDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bWQgKz0gYCR7bXNnLmNvbnRlbnR9XFxuXFxuYDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRtZCArPSBgIyMgQXNzaXN0YW50XFxuXFxuJHttc2cuY29udGVudH1cXG5cXG5gO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIEV4cG9ydCBvbmx5IHRoaXMgbWVzc2FnZVxuXHRcdFx0Y29uc3QgbXNnID0gbWVzc2FnZXNbbXNnSW5kZXhdO1xuXHRcdFx0aWYgKG1zZy5yb2xlID09PSBcInVzZXJcIikge1xuXHRcdFx0XHRtZCArPSBgIyMgVXNlclxcblxcbmA7XG5cdFx0XHRcdGlmIChtc2cuY29udGV4dEZpbGVzICYmIG1zZy5jb250ZXh0RmlsZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdG1kICs9IGA+ICoqQ29udGV4dDoqKiBgO1xuXHRcdFx0XHRcdG1kICs9IG1zZy5jb250ZXh0RmlsZXMubWFwKGYgPT4gYFtbJHtmfV1dYCkuam9pbihcIiwgXCIpO1xuXHRcdFx0XHRcdG1kICs9IGBcXG5cXG5gO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG1kICs9IGAke21zZy5jb250ZW50fVxcblxcbmA7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtZCArPSBgIyMgQXNzaXN0YW50XFxuXFxuJHttc2cuY29udGVudH1cXG5cXG5gO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEdldCBmb2xkZXIgcGF0aCBmcm9tIGN1cnJlbnQgZmlsZVxuXHRcdGNvbnN0IGZvbGRlciA9IHRoaXMuZmlsZT8ucGFyZW50Py5wYXRoIHx8IFwiXCI7XG5cdFx0Y29uc3Qgbm93ID0gbmV3IERhdGUoKTtcblx0XHRjb25zdCBtb250aHMgPSBbXCJKYW5cIiwgXCJGZWJcIiwgXCJNYXJcIiwgXCJBcHJcIiwgXCJNYXlcIiwgXCJKdW5cIiwgXCJKdWxcIiwgXCJBdWdcIiwgXCJTZXBcIiwgXCJPY3RcIiwgXCJOb3ZcIiwgXCJEZWNcIl07XG5cdFx0Y29uc3QgaG91cnMgPSBub3cuZ2V0SG91cnMoKTtcblx0XHRjb25zdCBhbXBtID0gaG91cnMgPj0gMTIgPyBcIlBNXCIgOiBcIkFNXCI7XG5cdFx0Y29uc3QgaG91cnMxMiA9IGhvdXJzICUgMTIgfHwgMTI7XG5cdFx0Y29uc3QgdGltZXN0YW1wID0gYCR7bm93LmdldEZ1bGxZZWFyKCl9ICR7bW9udGhzW25vdy5nZXRNb250aCgpXX0gJHtub3cuZ2V0RGF0ZSgpfSAke2hvdXJzMTJ9LSR7U3RyaW5nKG5vdy5nZXRNaW51dGVzKCkpLnBhZFN0YXJ0KDIsIFwiMFwiKX0gJHthbXBtfWA7XG5cdFx0Y29uc3Qgc3VmZml4ID0gaW5jbHVkZUhpc3RvcnkgPyBcIlwiIDogXCItbWVzc2FnZVwiO1xuXHRcdGNvbnN0IGZpbGVOYW1lID0gYCR7dGl0bGV9JHtzdWZmaXh9ICR7dGltZXN0YW1wfWAucmVwbGFjZSgvW1xcXFwvOio/XCI8PnxdL2csIFwiLVwiKTtcblx0XHRjb25zdCBmaWxlUGF0aCA9IGZvbGRlciA/IGAke2ZvbGRlcn0vJHtmaWxlTmFtZX0ubWRgIDogYCR7ZmlsZU5hbWV9Lm1kYDtcblxuXHRcdGNvbnN0IGZpbGUgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGUoZmlsZVBhdGgsIG1kKTtcblx0XHRuZXcgTm90aWNlKGBTYXZlZCB0byAke2ZpbGVQYXRofWApO1xuXG5cdFx0Ly8gT3BlbiB0aGUgZmlsZSBpbiBhIG5ldyB0YWJcblx0XHRjb25zdCBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYodHJ1ZSk7XG5cdFx0YXdhaXQgbGVhZi5vcGVuRmlsZShmaWxlKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlTm9kZVBvc2l0aW9uKG5vZGVJZDogc3RyaW5nLCB4OiBudW1iZXIsIHk6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLm5vZGVzLmdldChub2RlSWQpO1xuXHRcdGNvbnN0IGVsID0gdGhpcy5ub2RlRWxlbWVudHMuZ2V0KG5vZGVJZCk7XG5cdFx0aWYgKG5vZGUgJiYgZWwpIHtcblx0XHRcdG5vZGUueCA9IHg7XG5cdFx0XHRub2RlLnkgPSB5O1xuXHRcdFx0ZWwuc3R5bGUubGVmdCA9IGAke3h9cHhgO1xuXHRcdFx0ZWwuc3R5bGUudG9wID0gYCR7eX1weGA7XG5cdFx0XHR0aGlzLnVwZGF0ZUVkZ2VzKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVOb2RlU2l6ZShub2RlSWQ6IHN0cmluZywgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBub2RlID0gdGhpcy5ub2Rlcy5nZXQobm9kZUlkKTtcblx0XHRjb25zdCBlbCA9IHRoaXMubm9kZUVsZW1lbnRzLmdldChub2RlSWQpO1xuXHRcdGlmIChub2RlICYmIGVsKSB7XG5cdFx0XHRub2RlLndpZHRoID0gd2lkdGg7XG5cdFx0XHRub2RlLmhlaWdodCA9IGhlaWdodDtcblx0XHRcdGVsLnN0eWxlLndpZHRoID0gYCR7d2lkdGh9cHhgO1xuXHRcdFx0ZWwuc3R5bGUuaGVpZ2h0ID0gYCR7aGVpZ2h0fXB4YDtcblx0XHRcdHRoaXMudXBkYXRlTWluaW1hcCgpO1xuXHRcdFx0dGhpcy51cGRhdGVFZGdlcygpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZGVsZXRlTm9kZShub2RlSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMubm9kZXMuZGVsZXRlKG5vZGVJZCk7XG5cdFx0dGhpcy5jaGF0TWVzc2FnZXMuZGVsZXRlKG5vZGVJZCk7XG5cdFx0dGhpcy5jaGF0U3RhdGVzLmRlbGV0ZShub2RlSWQpO1xuXHRcdGNvbnN0IGVsID0gdGhpcy5ub2RlRWxlbWVudHMuZ2V0KG5vZGVJZCk7XG5cdFx0aWYgKGVsKSB7XG5cdFx0XHRlbC5yZW1vdmUoKTtcblx0XHRcdHRoaXMubm9kZUVsZW1lbnRzLmRlbGV0ZShub2RlSWQpO1xuXHRcdH1cblx0XHQvLyBSZW1vdmUgZWRnZXMgY29ubmVjdGVkIHRvIHRoaXMgbm9kZVxuXHRcdGZvciAoY29uc3QgW2VkZ2VJZCwgZWRnZV0gb2YgdGhpcy5lZGdlcykge1xuXHRcdFx0aWYgKGVkZ2UuZnJvbSA9PT0gbm9kZUlkIHx8IGVkZ2UudG8gPT09IG5vZGVJZCkge1xuXHRcdFx0XHR0aGlzLmVkZ2VzLmRlbGV0ZShlZGdlSWQpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLnVwZGF0ZUVkZ2VzKCk7XG5cdFx0dGhpcy51cGRhdGVNaW5pbWFwKCk7XG5cdFx0dGhpcy50cmlnZ2VyU2F2ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGRDYXJkQXRDZW50ZXIoKTogdm9pZCB7XG5cdFx0Y29uc3QgcmVjdCA9IHRoaXMuY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdGNvbnN0IGNlbnRlclggPSAocmVjdC53aWR0aCAvIDIgLSB0aGlzLnBhblgpIC8gdGhpcy5zY2FsZTtcblx0XHRjb25zdCBjZW50ZXJZID0gKHJlY3QuaGVpZ2h0IC8gMiAtIHRoaXMucGFuWSkgLyB0aGlzLnNjYWxlO1xuXG5cdFx0dGhpcy5hZGROb2RlKHtcblx0XHRcdGlkOiB0aGlzLmdlbmVyYXRlSWQoKSxcblx0XHRcdHg6IGNlbnRlclggLSAxNTAsXG5cdFx0XHR5OiBjZW50ZXJZIC0gMTAwLFxuXHRcdFx0d2lkdGg6IDMwMCxcblx0XHRcdGhlaWdodDogMjAwLFxuXHRcdFx0dHlwZTogXCJjYXJkXCIsXG5cdFx0XHRjb250ZW50OiBcIlwiLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGRDaGF0QXRDZW50ZXIoKTogdm9pZCB7XG5cdFx0Y29uc3QgcmVjdCA9IHRoaXMuY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdGNvbnN0IGNlbnRlclggPSAocmVjdC53aWR0aCAvIDIgLSB0aGlzLnBhblgpIC8gdGhpcy5zY2FsZTtcblx0XHRjb25zdCBjZW50ZXJZID0gKHJlY3QuaGVpZ2h0IC8gMiAtIHRoaXMucGFuWSkgLyB0aGlzLnNjYWxlO1xuXG5cdFx0dGhpcy5hZGROb2RlKHtcblx0XHRcdGlkOiB0aGlzLmdlbmVyYXRlSWQoKSxcblx0XHRcdHg6IGNlbnRlclggLSAyMDAsXG5cdFx0XHR5OiBjZW50ZXJZIC0gMjUwLFxuXHRcdFx0d2lkdGg6IDQwMCxcblx0XHRcdGhlaWdodDogNTAwLFxuXHRcdFx0dHlwZTogXCJjaGF0XCIsXG5cdFx0XHRjb250ZW50OiBcIlwiLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzaG93QWRkTGlua01vZGFsKCk6IHZvaWQge1xuXHRcdGNvbnN0IG1vZGFsID0gbmV3IE1vZGFsKHRoaXMuYXBwKTtcblx0XHRtb2RhbC50aXRsZUVsLnNldFRleHQoXCJBZGQgTGlua1wiKTtcblx0XHRjb25zdCBpbnB1dCA9IG1vZGFsLmNvbnRlbnRFbC5jcmVhdGVFbChcImlucHV0XCIsIHtcblx0XHRcdGNsczogXCJyYWJiaXRtYXAtbGluay1pbnB1dFwiLFxuXHRcdFx0YXR0cjogeyB0eXBlOiBcInRleHRcIiwgcGxhY2Vob2xkZXI6IFwiUGFzdGUgYSBVUkwgKGUuZy4gaHR0cHM6Ly8uLi4pXCIgfSxcblx0XHR9KTtcblx0XHRpbnB1dC5zdHlsZS53aWR0aCA9IFwiMTAwJVwiO1xuXHRcdGlucHV0LnN0eWxlLnBhZGRpbmcgPSBcIjhweFwiO1xuXHRcdGlucHV0LnN0eWxlLm1hcmdpbkJvdHRvbSA9IFwiMTJweFwiO1xuXG5cdFx0Y29uc3QgYnRuID0gbW9kYWwuY29udGVudEVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdHRleHQ6IFwiQWRkIHRvIENhbnZhc1wiLFxuXHRcdFx0Y2xzOiBcIm1vZC1jdGFcIixcblx0XHR9KTtcblx0XHRidG4ub25jbGljayA9ICgpID0+IHtcblx0XHRcdGNvbnN0IHVybCA9IGlucHV0LnZhbHVlLnRyaW0oKTtcblx0XHRcdGlmICh1cmwgJiYgL15odHRwcz86XFwvXFwvL2kudGVzdCh1cmwpKSB7XG5cdFx0XHRcdHRoaXMuYWRkTGlua0F0Q2VudGVyKHVybCk7XG5cdFx0XHRcdG1vZGFsLmNsb3NlKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuZXcgTm90aWNlKFwiUGxlYXNlIGVudGVyIGEgdmFsaWQgVVJMXCIpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZSkgPT4ge1xuXHRcdFx0aWYgKGUua2V5ID09PSBcIkVudGVyXCIpIHtcblx0XHRcdFx0YnRuLmNsaWNrKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRtb2RhbC5vcGVuKCk7XG5cdFx0aW5wdXQuZm9jdXMoKTtcblx0fVxuXG5cdHByaXZhdGUgYWRkTGlua0F0Q2VudGVyKHVybDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgcmVjdCA9IHRoaXMuY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdGNvbnN0IGNlbnRlclggPSAocmVjdC53aWR0aCAvIDIgLSB0aGlzLnBhblgpIC8gdGhpcy5zY2FsZTtcblx0XHRjb25zdCBjZW50ZXJZID0gKHJlY3QuaGVpZ2h0IC8gMiAtIHRoaXMucGFuWSkgLyB0aGlzLnNjYWxlO1xuXHRcdHRoaXMuYWRkTGlua05vZGUodXJsLCBjZW50ZXJYIC0gMTUwLCBjZW50ZXJZIC0gMTAwKTtcblx0fVxuXG5cdHByaXZhdGUgYWRkTGlua05vZGUodXJsOiBzdHJpbmcsIHg6IG51bWJlciwgeTogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3Qgbm9kZUlkID0gdGhpcy5nZW5lcmF0ZUlkKCk7XG5cdFx0Y29uc3Qgbm9kZTogQ2FudmFzTm9kZSA9IHtcblx0XHRcdGlkOiBub2RlSWQsXG5cdFx0XHR4LFxuXHRcdFx0eSxcblx0XHRcdHdpZHRoOiAzMDAsXG5cdFx0XHRoZWlnaHQ6IDIwMCxcblx0XHRcdHR5cGU6IFwibGlua1wiLFxuXHRcdFx0Y29udGVudDogXCJcIixcblx0XHRcdHVybCxcblx0XHRcdGxpbmtUaXRsZTogXCJMb2FkaW5nLi4uXCIsXG5cdFx0XHRsaW5rVHlwZTogXCJ3ZWJwYWdlXCIsXG5cdFx0fTtcblxuXHRcdC8vIERldGVjdCBZb3VUdWJlXG5cdFx0Y29uc3QgeXRNYXRjaCA9IHVybC5tYXRjaCgvKD86eW91dHViZVxcLmNvbVxcL3dhdGNoXFw/dj18eW91dHVcXC5iZVxcLykoW1xcdy1dKykvKTtcblx0XHRpZiAoeXRNYXRjaCkge1xuXHRcdFx0bm9kZS5saW5rVHlwZSA9IFwieW91dHViZVwiO1xuXHRcdFx0bm9kZS5saW5rSW1hZ2UgPSBgaHR0cHM6Ly9pbWcueW91dHViZS5jb20vdmkvJHt5dE1hdGNoWzFdfS9ocWRlZmF1bHQuanBnYDtcblx0XHR9XG5cblx0XHQvLyBEZXRlY3QgVHdpdHRlci9YXG5cdFx0Y29uc3QgdHdpdHRlck1hdGNoID0gdXJsLm1hdGNoKC8oPzp0d2l0dGVyXFwuY29tfHhcXC5jb20pXFwvXFx3K1xcL3N0YXR1c1xcLyhcXGQrKS8pO1xuXHRcdGlmICh0d2l0dGVyTWF0Y2gpIHtcblx0XHRcdG5vZGUubGlua1R5cGUgPSBcInR3aXR0ZXJcIjtcblx0XHR9XG5cblx0XHR0aGlzLmFkZE5vZGUobm9kZSk7XG5cdFx0dGhpcy5mZXRjaExpbmtNZXRhZGF0YSh1cmwsIG5vZGVJZCk7XG5cdH1cblxuXHRwcml2YXRlIHBhcnNlUGF0aChpbnB1dDogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRpbnB1dCA9IGlucHV0LnRyaW0oKTtcblxuXHRcdC8vIEhhbmRsZSBvYnNpZGlhbjovLyBVUkwgZm9ybWF0XG5cdFx0aWYgKGlucHV0LnN0YXJ0c1dpdGgoXCJvYnNpZGlhbjovL1wiKSkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgdXJsID0gbmV3IFVSTChpbnB1dCk7XG5cdFx0XHRcdGNvbnN0IGZpbGVQYXRoID0gdXJsLnNlYXJjaFBhcmFtcy5nZXQoXCJmaWxlXCIpO1xuXHRcdFx0XHRpZiAoZmlsZVBhdGgpIHtcblx0XHRcdFx0XHRyZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KGZpbGVQYXRoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCB7fVxuXHRcdH1cblxuXHRcdC8vIEhhbmRsZSBVUkwgZW5jb2Rpbmdcblx0XHR0cnkge1xuXHRcdFx0aW5wdXQgPSBkZWNvZGVVUklDb21wb25lbnQoaW5wdXQpO1xuXHRcdH0gY2F0Y2gge31cblxuXHRcdC8vIEhhbmRsZSBbW3dpa2lsaW5rXV0gZm9ybWF0XG5cdFx0Y29uc3Qgd2lraU1hdGNoID0gaW5wdXQubWF0Y2goL15cXFtcXFsoLis/KVxcXVxcXSQvKTtcblx0XHRpZiAod2lraU1hdGNoKSB7XG5cdFx0XHRyZXR1cm4gd2lraU1hdGNoWzFdO1xuXHRcdH1cblxuXHRcdC8vIEhhbmRsZSBbbmFtZV0ocGF0aCkgZm9ybWF0XG5cdFx0Y29uc3QgbWRNYXRjaCA9IGlucHV0Lm1hdGNoKC9eXFxbLis/XFxdXFwoKC4rPylcXCkkLyk7XG5cdFx0aWYgKG1kTWF0Y2gpIHtcblx0XHRcdHJldHVybiBtZE1hdGNoWzFdO1xuXHRcdH1cblxuXHRcdC8vIFJlbW92ZSBsZWFkaW5nIHNsYXNoIGlmIHByZXNlbnRcblx0XHRpZiAoaW5wdXQuc3RhcnRzV2l0aChcIi9cIikpIHtcblx0XHRcdGlucHV0ID0gaW5wdXQuc2xpY2UoMSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGlucHV0O1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvbHZlVmF1bHRJdGVtKHBhdGg6IHN0cmluZyk6IFRGaWxlIHwgVEZvbGRlciB8IG51bGwge1xuXHRcdGxldCBpdGVtID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpO1xuXG5cdFx0Ly8gVHJ5IGFkZGluZyAubWQgZXh0ZW5zaW9uXG5cdFx0aWYgKCFpdGVtICYmICFwYXRoLmluY2x1ZGVzKFwiLlwiKSkge1xuXHRcdFx0aXRlbSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoICsgXCIubWRcIik7XG5cdFx0fVxuXG5cdFx0Ly8gVHJ5IHRvIGZpbmQgYnkgbmFtZSBpbiBhbGwgZmlsZXNcblx0XHRpZiAoIWl0ZW0pIHtcblx0XHRcdGNvbnN0IGFsbEZpbGVzID0gdGhpcy5hcHAudmF1bHQuZ2V0RmlsZXMoKTtcblx0XHRcdGNvbnN0IGZpbGVOYW1lID0gcGF0aC5zcGxpdChcIi9cIikucG9wKCkgfHwgcGF0aDtcblx0XHRcdGNvbnN0IGZvdW5kID0gYWxsRmlsZXMuZmluZChmID0+XG5cdFx0XHRcdGYucGF0aCA9PT0gcGF0aCB8fFxuXHRcdFx0XHRmLm5hbWUgPT09IGZpbGVOYW1lIHx8XG5cdFx0XHRcdGYuYmFzZW5hbWUgPT09IGZpbGVOYW1lIHx8XG5cdFx0XHRcdGYucGF0aC5lbmRzV2l0aChcIi9cIiArIHBhdGgpXG5cdFx0XHQpO1xuXHRcdFx0aWYgKGZvdW5kKSByZXR1cm4gZm91bmQ7XG5cdFx0fVxuXG5cdFx0Ly8gVHJ5IHRvIGZpbmQgZm9sZGVyIGJ5IG5hbWVcblx0XHRpZiAoIWl0ZW0gJiYgIXBhdGguaW5jbHVkZXMoXCIuXCIpKSB7XG5cdFx0XHRjb25zdCByb290Rm9sZGVyID0gdGhpcy5hcHAudmF1bHQuZ2V0Um9vdCgpO1xuXHRcdFx0Y29uc3QgYWxsRm9sZGVycyA9IHRoaXMuZ2V0QWxsRm9sZGVycyhyb290Rm9sZGVyKTtcblx0XHRcdGNvbnN0IGZvbGRlck5hbWUgPSBwYXRoLnNwbGl0KFwiL1wiKS5wb3AoKSB8fCBwYXRoO1xuXHRcdFx0Y29uc3QgZm91bmQgPSBhbGxGb2xkZXJzLmZpbmQoZiA9PlxuXHRcdFx0XHRmLnBhdGggPT09IHBhdGggfHxcblx0XHRcdFx0Zi5uYW1lID09PSBmb2xkZXJOYW1lIHx8XG5cdFx0XHRcdGYucGF0aC5lbmRzV2l0aChcIi9cIiArIHBhdGgpXG5cdFx0XHQpO1xuXHRcdFx0aWYgKGZvdW5kKSByZXR1cm4gZm91bmQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGl0ZW0gYXMgVEZpbGUgfCBURm9sZGVyIHwgbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0QWxsRm9sZGVycyhmb2xkZXI6IFRGb2xkZXIpOiBURm9sZGVyW10ge1xuXHRcdGNvbnN0IGZvbGRlcnM6IFRGb2xkZXJbXSA9IFtmb2xkZXJdO1xuXHRcdGZvciAoY29uc3QgY2hpbGQgb2YgZm9sZGVyLmNoaWxkcmVuKSB7XG5cdFx0XHRpZiAoY2hpbGQgaW5zdGFuY2VvZiBURm9sZGVyKSB7XG5cdFx0XHRcdGZvbGRlcnMucHVzaCguLi50aGlzLmdldEFsbEZvbGRlcnMoY2hpbGQpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZvbGRlcnM7XG5cdH1cblxuXHRwcml2YXRlIGdldE1kRmlsZXNGcm9tRm9sZGVyKGZvbGRlcjogVEZvbGRlcik6IFRGaWxlW10ge1xuXHRcdGNvbnN0IGZpbGVzOiBURmlsZVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBjaGlsZCBvZiBmb2xkZXIuY2hpbGRyZW4pIHtcblx0XHRcdGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGaWxlICYmIGNoaWxkLmV4dGVuc2lvbiA9PT0gXCJtZFwiKSB7XG5cdFx0XHRcdGZpbGVzLnB1c2goY2hpbGQpO1xuXHRcdFx0fSBlbHNlIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcblx0XHRcdFx0ZmlsZXMucHVzaCguLi50aGlzLmdldE1kRmlsZXNGcm9tRm9sZGVyKGNoaWxkKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmaWxlcztcblx0fVxuXG5cdHByaXZhdGUgYWRkTm90ZU5vZGUoZmlsZVBhdGg6IHN0cmluZywgY29udGVudDogc3RyaW5nLCB4OiBudW1iZXIsIHk6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IG5vZGU6IENhbnZhc05vZGUgPSB7XG5cdFx0XHRpZDogdGhpcy5nZW5lcmF0ZUlkKCksXG5cdFx0XHR4LFxuXHRcdFx0eSxcblx0XHRcdHdpZHRoOiAzNTAsXG5cdFx0XHRoZWlnaHQ6IDMwMCxcblx0XHRcdHR5cGU6IFwibm90ZVwiLFxuXHRcdFx0Y29udGVudCxcblx0XHRcdHRpdGxlOiBmaWxlUGF0aC5zcGxpdChcIi9cIikucG9wKCk/LnJlcGxhY2UoXCIubWRcIiwgXCJcIikgfHwgXCJOb3RlXCIsXG5cdFx0XHRmaWxlUGF0aCxcblx0XHR9O1xuXHRcdHRoaXMuYWRkTm9kZShub2RlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZmV0Y2hMaW5rTWV0YWRhdGEodXJsOiBzdHJpbmcsIG5vZGVJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMubm9kZXMuZ2V0KG5vZGVJZCk7XG5cdFx0aWYgKCFub2RlKSByZXR1cm47XG5cblx0XHR0cnkge1xuXHRcdFx0aWYgKG5vZGUubGlua1R5cGUgPT09IFwieW91dHViZVwiKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuZmV0Y2hZb3VUdWJlTWV0YWRhdGEodXJsLCBub2RlKTtcblx0XHRcdH0gZWxzZSBpZiAobm9kZS5saW5rVHlwZSA9PT0gXCJ0d2l0dGVyXCIpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5mZXRjaFR3aXR0ZXJNZXRhZGF0YSh1cmwsIG5vZGUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5mZXRjaFdlYlBhZ2VNZXRhZGF0YSh1cmwsIG5vZGUpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdC8vIEZhbGxiYWNrOiBzaG93IFVSTCBvbmx5XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRub2RlLmxpbmtUaXRsZSA9IG5ldyBVUkwodXJsKS5ob3N0bmFtZTtcblx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHRub2RlLmxpbmtUaXRsZSA9IHVybDtcblx0XHRcdH1cblx0XHRcdG5vZGUubGlua0Rlc2NyaXB0aW9uID0gXCJDb3VsZCBub3QgZmV0Y2ggY29udGVudFwiO1xuXHRcdH1cblxuXHRcdHRoaXMucmVyZW5kZXJOb2RlKG5vZGVJZCk7XG5cdFx0dGhpcy50cmlnZ2VyU2F2ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBmZXRjaFlvdVR1YmVNZXRhZGF0YSh1cmw6IHN0cmluZywgbm9kZTogQ2FudmFzTm9kZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCByZXNwID0gYXdhaXQgcmVxdWVzdFVybCh7XG5cdFx0XHRcdHVybDogYGh0dHBzOi8vbm9lbWJlZC5jb20vZW1iZWQ/dXJsPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHVybCl9YCxcblx0XHRcdH0pO1xuXHRcdFx0Y29uc3QgZGF0YSA9IHJlc3AuanNvbjtcblx0XHRcdG5vZGUubGlua1RpdGxlID0gZGF0YS50aXRsZSB8fCBcIllvdVR1YmUgVmlkZW9cIjtcblx0XHRcdG5vZGUubGlua0Rlc2NyaXB0aW9uID0gZGF0YS5hdXRob3JfbmFtZSA/IGBieSAke2RhdGEuYXV0aG9yX25hbWV9YCA6IFwiXCI7XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHRub2RlLmxpbmtUaXRsZSA9IFwiWW91VHViZSBWaWRlb1wiO1xuXHRcdH1cblxuXHRcdC8vIEZldGNoIHBhZ2UgSFRNTCB0byBleHRyYWN0IHZpZGVvIGRlc2NyaXB0aW9uIGZvciBMTE0gY29udGV4dFxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBwYWdlUmVzcCA9IGF3YWl0IHJlcXVlc3RVcmwoeyB1cmwgfSk7XG5cdFx0XHRjb25zdCBwYXJzZXIgPSBuZXcgRE9NUGFyc2VyKCk7XG5cdFx0XHRjb25zdCBkb2MgPSBwYXJzZXIucGFyc2VGcm9tU3RyaW5nKHBhZ2VSZXNwLnRleHQsIFwidGV4dC9odG1sXCIpO1xuXG5cdFx0XHQvLyBZb3VUdWJlIHB1dHMgdGhlIGRlc2NyaXB0aW9uIGluIG9nOmRlc2NyaXB0aW9uIGFuZCBhbHNvIGluIEpTT04tTERcblx0XHRcdGNvbnN0IHBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuXG5cdFx0XHQvLyBUaXRsZSBjb250ZXh0XG5cdFx0XHRpZiAobm9kZS5saW5rVGl0bGUgJiYgbm9kZS5saW5rVGl0bGUgIT09IFwiWW91VHViZSBWaWRlb1wiKSB7XG5cdFx0XHRcdHBhcnRzLnB1c2goYFRpdGxlOiAke25vZGUubGlua1RpdGxlfWApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG5vZGUubGlua0Rlc2NyaXB0aW9uKSB7XG5cdFx0XHRcdHBhcnRzLnB1c2goYENoYW5uZWw6ICR7bm9kZS5saW5rRGVzY3JpcHRpb24ucmVwbGFjZSgvXmJ5IC8sIFwiXCIpfWApO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBvZzpkZXNjcmlwdGlvbiBvZnRlbiBoYXMgYSB0cnVuY2F0ZWQgdmlkZW8gZGVzY3JpcHRpb25cblx0XHRcdGNvbnN0IG9nRGVzYyA9IGRvYy5xdWVyeVNlbGVjdG9yKCdtZXRhW3Byb3BlcnR5PVwib2c6ZGVzY3JpcHRpb25cIl0nKTtcblx0XHRcdGNvbnN0IGRlc2NUZXh0ID0gb2dEZXNjPy5nZXRBdHRyaWJ1dGUoXCJjb250ZW50XCIpPy50cmltKCk7XG5cdFx0XHRpZiAoZGVzY1RleHQpIHtcblx0XHRcdFx0cGFydHMucHVzaChgRGVzY3JpcHRpb246ICR7ZGVzY1RleHR9YCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEpTT04tTEQgY2FuIGhhdmUgcmljaGVyIGRhdGFcblx0XHRcdGNvbnN0IGpzb25MZENvbnRlbnQgPSB0aGlzLmV4dHJhY3RKc29uTGRDb250ZW50KGRvYyk7XG5cdFx0XHRpZiAoanNvbkxkQ29udGVudCkge1xuXHRcdFx0XHRwYXJ0cy5wdXNoKGpzb25MZENvbnRlbnQpO1xuXHRcdFx0fVxuXG5cdFx0XHRub2RlLmxpbmtDb250ZW50ID0gcGFydHMuam9pbihcIlxcblxcblwiKS5zbGljZSgwLCAxMDAwMCk7XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHQvLyBQYWdlIGZldGNoIGZhaWxlZDsgbGlua0NvbnRlbnQgc3RheXMgZW1wdHksIHdoaWNoIGlzIGZpbmVcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGZldGNoVHdpdHRlck1ldGFkYXRhKHVybDogc3RyaW5nLCBub2RlOiBDYW52YXNOb2RlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gVXNlIGZ4dHdpdHRlciBBUEkgd2hpY2ggcmV0dXJucyByaWNoIHR3ZWV0IGRhdGEgYXMgSlNPTlxuXHRcdGNvbnN0IG1hdGNoID0gdXJsLm1hdGNoKC8oPzp0d2l0dGVyXFwuY29tfHhcXC5jb20pXFwvKFxcdyspXFwvc3RhdHVzXFwvKFxcZCspLyk7XG5cdFx0aWYgKCFtYXRjaCkge1xuXHRcdFx0bm9kZS5saW5rVGl0bGUgPSBcIlR3ZWV0XCI7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgWywgdXNlcm5hbWUsIHN0YXR1c0lkXSA9IG1hdGNoO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHJlc3AgPSBhd2FpdCByZXF1ZXN0VXJsKHtcblx0XHRcdFx0dXJsOiBgaHR0cHM6Ly9hcGkuZnh0d2l0dGVyLmNvbS8ke3VzZXJuYW1lfS9zdGF0dXMvJHtzdGF0dXNJZH1gLFxuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBkYXRhID0gcmVzcC5qc29uO1xuXHRcdFx0Y29uc3QgdHdlZXQgPSBkYXRhLnR3ZWV0O1xuXG5cdFx0XHRpZiAodHdlZXQpIHtcblx0XHRcdFx0Ly8gVGl0bGU6IGF1dGhvciBuYW1lIGFuZCBoYW5kbGVcblx0XHRcdFx0bm9kZS5saW5rVGl0bGUgPSB0d2VldC5hdXRob3I/Lm5hbWVcblx0XHRcdFx0XHQ/IGAke3R3ZWV0LmF1dGhvci5uYW1lfSAoQCR7dHdlZXQuYXV0aG9yLnNjcmVlbl9uYW1lfSlgXG5cdFx0XHRcdFx0OiBgQCR7dXNlcm5hbWV9YDtcblxuXHRcdFx0XHQvLyBEZXNjcmlwdGlvbjogdHdlZXQgdGV4dCAodHJ1bmNhdGVkIGZvciBkaXNwbGF5KVxuXHRcdFx0XHRub2RlLmxpbmtEZXNjcmlwdGlvbiA9IHR3ZWV0LnRleHRcblx0XHRcdFx0XHQ/ICh0d2VldC50ZXh0Lmxlbmd0aCA+IDIwMCA/IHR3ZWV0LnRleHQuc2xpY2UoMCwgMjAwKSArIFwiXHUyMDI2XCIgOiB0d2VldC50ZXh0KVxuXHRcdFx0XHRcdDogXCJcIjtcblxuXHRcdFx0XHQvLyBJbWFnZTogYXV0aG9yIGF2YXRhciBvciBtZWRpYVxuXHRcdFx0XHRpZiAodHdlZXQubWVkaWE/LnBob3Rvcz8uWzBdPy51cmwpIHtcblx0XHRcdFx0XHRub2RlLmxpbmtJbWFnZSA9IHR3ZWV0Lm1lZGlhLnBob3Rvc1swXS51cmw7XG5cdFx0XHRcdH0gZWxzZSBpZiAodHdlZXQuYXV0aG9yPy5hdmF0YXJfdXJsKSB7XG5cdFx0XHRcdFx0bm9kZS5saW5rSW1hZ2UgPSB0d2VldC5hdXRob3IuYXZhdGFyX3VybDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEZ1bGwgY29udGVudCBmb3IgTExNIGNvbnRleHRcblx0XHRcdFx0Y29uc3QgY29udGVudFBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0XHRjb250ZW50UGFydHMucHVzaChgVHdlZXQgYnkgJHt0d2VldC5hdXRob3I/Lm5hbWUgfHwgdXNlcm5hbWV9IChAJHt0d2VldC5hdXRob3I/LnNjcmVlbl9uYW1lIHx8IHVzZXJuYW1lfSlgKTtcblx0XHRcdFx0aWYgKHR3ZWV0LmNyZWF0ZWRfYXQpIHtcblx0XHRcdFx0XHRjb250ZW50UGFydHMucHVzaChgUG9zdGVkOiAke3R3ZWV0LmNyZWF0ZWRfYXR9YCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHR3ZWV0LnRleHQpIHtcblx0XHRcdFx0XHRjb250ZW50UGFydHMucHVzaChgXFxuJHt0d2VldC50ZXh0fWApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh0d2VldC5yZXBsaWVzICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRjb250ZW50UGFydHMucHVzaChgXFxuUmVwbGllczogJHt0d2VldC5yZXBsaWVzfSB8IFJldHdlZXRzOiAke3R3ZWV0LnJldHdlZXRzfSB8IExpa2VzOiAke3R3ZWV0Lmxpa2VzfWApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh0d2VldC5yZXBseWluZ190bykge1xuXHRcdFx0XHRcdGNvbnRlbnRQYXJ0cy5wdXNoKGBSZXBseWluZyB0bzogQCR7dHdlZXQucmVwbHlpbmdfdG99YCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRub2RlLmxpbmtDb250ZW50ID0gY29udGVudFBhcnRzLmpvaW4oXCJcXG5cIikuc2xpY2UoMCwgMTAwMDApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bm9kZS5saW5rVGl0bGUgPSBgQCR7dXNlcm5hbWV9YDtcblx0XHRcdFx0bm9kZS5saW5rRGVzY3JpcHRpb24gPSBcIkNvdWxkIG5vdCBsb2FkIHR3ZWV0XCI7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHQvLyBGYWxsYmFjazogdHJ5IGdlbmVyaWMgd2ViIGZldGNoXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmZldGNoV2ViUGFnZU1ldGFkYXRhKHVybCwgbm9kZSk7XG5cdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0bm9kZS5saW5rVGl0bGUgPSBgQCR7dXNlcm5hbWV9YDtcblx0XHRcdFx0bm9kZS5saW5rRGVzY3JpcHRpb24gPSBcIkNvdWxkIG5vdCBsb2FkIHR3ZWV0XCI7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBmZXRjaFdlYlBhZ2VNZXRhZGF0YSh1cmw6IHN0cmluZywgbm9kZTogQ2FudmFzTm9kZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHJlc3AgPSBhd2FpdCByZXF1ZXN0VXJsKHsgdXJsIH0pO1xuXHRcdGNvbnN0IGh0bWwgPSByZXNwLnRleHQ7XG5cblx0XHQvLyBQYXJzZSB3aXRoIERPTVBhcnNlclxuXHRcdGNvbnN0IHBhcnNlciA9IG5ldyBET01QYXJzZXIoKTtcblx0XHRjb25zdCBkb2MgPSBwYXJzZXIucGFyc2VGcm9tU3RyaW5nKGh0bWwsIFwidGV4dC9odG1sXCIpO1xuXG5cdFx0Ly8gVGl0bGUgXHUyMDE0IHByZWZlciBvZzp0aXRsZSwgZmFsbCBiYWNrIHRvIDx0aXRsZT5cblx0XHRjb25zdCBvZ1RpdGxlID0gZG9jLnF1ZXJ5U2VsZWN0b3IoJ21ldGFbcHJvcGVydHk9XCJvZzp0aXRsZVwiXScpO1xuXHRcdGNvbnN0IHRpdGxlRWwgPSBkb2MucXVlcnlTZWxlY3RvcihcInRpdGxlXCIpO1xuXHRcdG5vZGUubGlua1RpdGxlID0gb2dUaXRsZT8uZ2V0QXR0cmlidXRlKFwiY29udGVudFwiKT8udHJpbSgpXG5cdFx0XHR8fCB0aXRsZUVsPy50ZXh0Q29udGVudD8udHJpbSgpXG5cdFx0XHR8fCBuZXcgVVJMKHVybCkuaG9zdG5hbWU7XG5cblx0XHQvLyBNZXRhIGRlc2NyaXB0aW9uIFx1MjAxNCBjaGVjayBtdWx0aXBsZSBzb3VyY2VzXG5cdFx0Y29uc3QgZGVzY1NvdXJjZXMgPSBbXG5cdFx0XHRkb2MucXVlcnlTZWxlY3RvcignbWV0YVtwcm9wZXJ0eT1cIm9nOmRlc2NyaXB0aW9uXCJdJyksXG5cdFx0XHRkb2MucXVlcnlTZWxlY3RvcignbWV0YVtuYW1lPVwiZGVzY3JpcHRpb25cIl0nKSxcblx0XHRcdGRvYy5xdWVyeVNlbGVjdG9yKCdtZXRhW25hbWU9XCJ0d2l0dGVyOmRlc2NyaXB0aW9uXCJdJyksXG5cdFx0XTtcblx0XHRub2RlLmxpbmtEZXNjcmlwdGlvbiA9IGRlc2NTb3VyY2VzXG5cdFx0XHQubWFwKGVsID0+IGVsPy5nZXRBdHRyaWJ1dGUoXCJjb250ZW50XCIpPy50cmltKCkpXG5cdFx0XHQuZmluZChkID0+IGQgJiYgZC5sZW5ndGggPiAwKSB8fCBcIlwiO1xuXG5cdFx0Ly8gT0cgaW1hZ2Vcblx0XHRjb25zdCBvZ0ltYWdlID0gZG9jLnF1ZXJ5U2VsZWN0b3IoJ21ldGFbcHJvcGVydHk9XCJvZzppbWFnZVwiXScpO1xuXHRcdGNvbnN0IGltZ0NvbnRlbnQgPSBvZ0ltYWdlPy5nZXRBdHRyaWJ1dGUoXCJjb250ZW50XCIpO1xuXHRcdGlmIChpbWdDb250ZW50KSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRub2RlLmxpbmtJbWFnZSA9IG5ldyBVUkwoaW1nQ29udGVudCwgdXJsKS5ocmVmO1xuXHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdG5vZGUubGlua0ltYWdlID0gaW1nQ29udGVudDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyAtLS0gRXh0cmFjdCByaWNoIGNvbnRlbnQgdmlhIG11bHRpcGxlIHN0cmF0ZWdpZXMgLS0tXG5cdFx0bm9kZS5saW5rQ29udGVudCA9IHRoaXMuZXh0cmFjdFBhZ2VDb250ZW50KGRvYywgdXJsKTtcblx0fVxuXG5cdHByaXZhdGUgZXh0cmFjdFBhZ2VDb250ZW50KGRvYzogRG9jdW1lbnQsIHVybDogc3RyaW5nKTogc3RyaW5nIHtcblx0XHQvLyBTdHJhdGVneSAxOiBKU09OLUxEIHN0cnVjdHVyZWQgZGF0YSAoYmVzdCBmb3IgVHdpdHRlci9YLCBuZXdzLCBibG9ncylcblx0XHRjb25zdCBqc29uTGRDb250ZW50ID0gdGhpcy5leHRyYWN0SnNvbkxkQ29udGVudChkb2MpO1xuXHRcdGlmIChqc29uTGRDb250ZW50ICYmIGpzb25MZENvbnRlbnQubGVuZ3RoID4gMjAwKSB7XG5cdFx0XHRyZXR1cm4ganNvbkxkQ29udGVudC5zbGljZSgwLCAxMDAwMCk7XG5cdFx0fVxuXG5cdFx0Ly8gU3RyYXRlZ3kgMjogRW5oYW5jZWQgSFRNTCBleHRyYWN0aW9uXG5cdFx0Y29uc3QgaHRtbENvbnRlbnQgPSB0aGlzLmV4dHJhY3RIdG1sQ29udGVudChkb2MpO1xuXG5cdFx0Ly8gSWYgSlNPTi1MRCBoYWQgc29tZXRoaW5nIHNob3J0LCBwcmVwZW5kIGl0IHRvIEhUTUwgY29udGVudFxuXHRcdGlmIChqc29uTGRDb250ZW50ICYmIGpzb25MZENvbnRlbnQubGVuZ3RoID4gMCkge1xuXHRcdFx0Y29uc3QgY29tYmluZWQgPSBqc29uTGRDb250ZW50ICsgXCJcXG5cXG5cIiArIGh0bWxDb250ZW50O1xuXHRcdFx0cmV0dXJuIGNvbWJpbmVkLnNsaWNlKDAsIDEwMDAwKTtcblx0XHR9XG5cblx0XHQvLyBTdHJhdGVneSAzOiBGYWxsIGJhY2sgdG8gbWV0YSBkZXNjcmlwdGlvbiBpZiBIVE1MIGV4dHJhY3Rpb24gaXMgdG9vIHRoaW5cblx0XHRpZiAoaHRtbENvbnRlbnQubGVuZ3RoIDwgMTAwKSB7XG5cdFx0XHRjb25zdCBtZXRhRmFsbGJhY2sgPSB0aGlzLmV4dHJhY3RNZXRhQ29udGVudChkb2MpO1xuXHRcdFx0aWYgKG1ldGFGYWxsYmFjay5sZW5ndGggPiBodG1sQ29udGVudC5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuIG1ldGFGYWxsYmFjay5zbGljZSgwLCAxMDAwMCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGh0bWxDb250ZW50LnNsaWNlKDAsIDEwMDAwKTtcblx0fVxuXG5cdHByaXZhdGUgZXh0cmFjdEpzb25MZENvbnRlbnQoZG9jOiBEb2N1bWVudCk6IHN0cmluZyB7XG5cdFx0Y29uc3Qgc2NyaXB0cyA9IGRvYy5xdWVyeVNlbGVjdG9yQWxsKCdzY3JpcHRbdHlwZT1cImFwcGxpY2F0aW9uL2xkK2pzb25cIl0nKTtcblx0XHRjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcblxuXHRcdHNjcmlwdHMuZm9yRWFjaChzY3JpcHQgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgZGF0YSA9IEpTT04ucGFyc2Uoc2NyaXB0LnRleHRDb250ZW50IHx8IFwiXCIpO1xuXHRcdFx0XHRjb25zdCBpdGVtcyA9IEFycmF5LmlzQXJyYXkoZGF0YSkgPyBkYXRhIDogW2RhdGFdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcblx0XHRcdFx0XHQvLyBFeHRyYWN0IGFydGljbGUvcG9zdCBib2R5IHRleHRcblx0XHRcdFx0XHRpZiAoaXRlbS5hcnRpY2xlQm9keSkge1xuXHRcdFx0XHRcdFx0cGFydHMucHVzaChpdGVtLmFydGljbGVCb2R5KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGl0ZW0udGV4dCkge1xuXHRcdFx0XHRcdFx0cGFydHMucHVzaChpdGVtLnRleHQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoaXRlbS5kZXNjcmlwdGlvbiAmJiAhcGFydHMuaW5jbHVkZXMoaXRlbS5kZXNjcmlwdGlvbikpIHtcblx0XHRcdFx0XHRcdHBhcnRzLnB1c2goaXRlbS5kZXNjcmlwdGlvbik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC8vIEhhbmRsZSBuZXN0ZWQgQGdyYXBoIHN0cnVjdHVyZSAoY29tbW9uIGluIFdvcmRQcmVzcywgbmV3cyBzaXRlcylcblx0XHRcdFx0XHRpZiAoaXRlbVtcIkBncmFwaFwiXSAmJiBBcnJheS5pc0FycmF5KGl0ZW1bXCJAZ3JhcGhcIl0pKSB7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IGdyYXBoSXRlbSBvZiBpdGVtW1wiQGdyYXBoXCJdKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChncmFwaEl0ZW0uYXJ0aWNsZUJvZHkpIHBhcnRzLnB1c2goZ3JhcGhJdGVtLmFydGljbGVCb2R5KTtcblx0XHRcdFx0XHRcdFx0aWYgKGdyYXBoSXRlbS50ZXh0KSBwYXJ0cy5wdXNoKGdyYXBoSXRlbS50ZXh0KTtcblx0XHRcdFx0XHRcdFx0aWYgKGdyYXBoSXRlbS5kZXNjcmlwdGlvbiAmJiAhcGFydHMuaW5jbHVkZXMoZ3JhcGhJdGVtLmRlc2NyaXB0aW9uKSkge1xuXHRcdFx0XHRcdFx0XHRcdHBhcnRzLnB1c2goZ3JhcGhJdGVtLmRlc2NyaXB0aW9uKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRpZiAoZ3JhcGhJdGVtLmFic3RyYWN0KSBwYXJ0cy5wdXNoKGdyYXBoSXRlbS5hYnN0cmFjdCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC8vIEFjYWRlbWljIHBhcGVyc1xuXHRcdFx0XHRcdGlmIChpdGVtLmFic3RyYWN0KSB7XG5cdFx0XHRcdFx0XHRwYXJ0cy5wdXNoKGl0ZW0uYWJzdHJhY3QpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdC8vIEludmFsaWQgSlNPTi1MRCwgc2tpcFxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHBhcnRzLmpvaW4oXCJcXG5cXG5cIikudHJpbSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBleHRyYWN0SHRtbENvbnRlbnQoZG9jOiBEb2N1bWVudCk6IHN0cmluZyB7XG5cdFx0Ly8gUmVtb3ZlIG5vbi1jb250ZW50IGVsZW1lbnRzXG5cdFx0Y29uc3QgcmVtb3ZlU2VsZWN0b3JzID0gW1xuXHRcdFx0XCJzY3JpcHRcIiwgXCJzdHlsZVwiLCBcIm5hdlwiLCBcImZvb3RlclwiLCBcImhlYWRlclwiLCBcImFzaWRlXCIsIFwiaWZyYW1lXCIsIFwibm9zY3JpcHRcIixcblx0XHRcdFwiW3JvbGU9J25hdmlnYXRpb24nXVwiLCBcIltyb2xlPSdiYW5uZXInXVwiLCBcIltyb2xlPSdjb250ZW50aW5mbyddXCIsXG5cdFx0XHRcIi5zaWRlYmFyXCIsIFwiLmNvbW1lbnRzXCIsIFwiLmNvbW1lbnRcIiwgXCIucmVsYXRlZFwiLCBcIi5hZHZlcnRpc2VtZW50XCIsIFwiLmFkXCIsXG5cdFx0XHRcImZvcm1cIiwgXCJbYXJpYS1oaWRkZW49J3RydWUnXVwiLCBcIi5zb2NpYWwtc2hhcmVcIiwgXCIuc2hhcmUtYnV0dG9uc1wiLFxuXHRcdFx0XCIuY29va2llLWJhbm5lclwiLCBcIi5wb3B1cFwiLCBcIi5tb2RhbFwiLFxuXHRcdF07XG5cdFx0Zm9yIChjb25zdCBzZWwgb2YgcmVtb3ZlU2VsZWN0b3JzKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRkb2MucXVlcnlTZWxlY3RvckFsbChzZWwpLmZvckVhY2goZWwgPT4gZWwucmVtb3ZlKCkpO1xuXHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdC8vIEludmFsaWQgc2VsZWN0b3IgaW4gdGhpcyBjb250ZXh0LCBza2lwXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gVHJ5IHByb2dyZXNzaXZlbHkgYnJvYWRlciBjb250ZW50IHNlbGVjdG9yc1xuXHRcdGNvbnN0IGNvbnRlbnRTZWxlY3RvcnMgPSBbXG5cdFx0XHRcImFydGljbGVcIixcblx0XHRcdFwiW3JvbGU9J21haW4nXVwiLFxuXHRcdFx0XCJtYWluXCIsXG5cdFx0XHRcIi5wb3N0LWNvbnRlbnRcIixcblx0XHRcdFwiLmVudHJ5LWNvbnRlbnRcIixcblx0XHRcdFwiLmFydGljbGUtYm9keVwiLFxuXHRcdFx0XCIuYXJ0aWNsZS1jb250ZW50XCIsXG5cdFx0XHRcIi5zdG9yeS1ib2R5XCIsXG5cdFx0XHRcIiNjb250ZW50XCIsXG5cdFx0XHRcIi5jb250ZW50XCIsXG5cdFx0XHRcImJvZHlcIixcblx0XHRdO1xuXG5cdFx0bGV0IGNvbnRlbnRFbDogRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXHRcdGZvciAoY29uc3Qgc2VsIG9mIGNvbnRlbnRTZWxlY3RvcnMpIHtcblx0XHRcdGNvbnRlbnRFbCA9IGRvYy5xdWVyeVNlbGVjdG9yKHNlbCk7XG5cdFx0XHRpZiAoY29udGVudEVsKSBicmVhaztcblx0XHR9XG5cblx0XHRpZiAoIWNvbnRlbnRFbCkgcmV0dXJuIFwiXCI7XG5cblx0XHQvLyBFeHRyYWN0IHRleHQgcHJlc2VydmluZyBwYXJhZ3JhcGggc3RydWN0dXJlXG5cdFx0Y29uc3QgcGFyYWdyYXBoczogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBwRWxlbWVudHMgPSBjb250ZW50RWwucXVlcnlTZWxlY3RvckFsbChcInAsIGgxLCBoMiwgaDMsIGg0LCBoNSwgaDYsIGxpLCBibG9ja3F1b3RlLCBwcmUsIHRkXCIpO1xuXG5cdFx0aWYgKHBFbGVtZW50cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRwRWxlbWVudHMuZm9yRWFjaChlbCA9PiB7XG5cdFx0XHRcdGNvbnN0IHRleHQgPSAoZWwudGV4dENvbnRlbnQgfHwgXCJcIikucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpO1xuXHRcdFx0XHRpZiAodGV4dC5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0cGFyYWdyYXBocy5wdXNoKHRleHQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiBwYXJhZ3JhcGhzLmpvaW4oXCJcXG5cXG5cIikudHJpbSgpO1xuXHRcdH1cblxuXHRcdC8vIEZhbGxiYWNrOiByYXcgdGV4dENvbnRlbnQgaWYgbm8gcGFyYWdyYXBoIGVsZW1lbnRzIGZvdW5kXG5cdFx0cmV0dXJuIChjb250ZW50RWwudGV4dENvbnRlbnQgfHwgXCJcIikucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBleHRyYWN0TWV0YUNvbnRlbnQoZG9jOiBEb2N1bWVudCk6IHN0cmluZyB7XG5cdFx0Y29uc3QgbWV0YVNlbGVjdG9ycyA9IFtcblx0XHRcdCdtZXRhW3Byb3BlcnR5PVwib2c6ZGVzY3JpcHRpb25cIl0nLFxuXHRcdFx0J21ldGFbbmFtZT1cImRlc2NyaXB0aW9uXCJdJyxcblx0XHRcdCdtZXRhW25hbWU9XCJ0d2l0dGVyOmRlc2NyaXB0aW9uXCJdJyxcblx0XHRcdCdtZXRhW25hbWU9XCJhYnN0cmFjdFwiXScsIC8vIEFjYWRlbWljIHBhcGVyc1xuXHRcdFx0J21ldGFbbmFtZT1cImNpdGF0aW9uX2Fic3RyYWN0XCJdJywgLy8gU2Nob2xhci9hY2FkZW1pY1xuXHRcdF07XG5cblx0XHRjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHNlbCBvZiBtZXRhU2VsZWN0b3JzKSB7XG5cdFx0XHRjb25zdCBlbCA9IGRvYy5xdWVyeVNlbGVjdG9yKHNlbCk7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gZWw/LmdldEF0dHJpYnV0ZShcImNvbnRlbnRcIik/LnRyaW0oKTtcblx0XHRcdGlmIChjb250ZW50ICYmICFwYXJ0cy5pbmNsdWRlcyhjb250ZW50KSkge1xuXHRcdFx0XHRwYXJ0cy5wdXNoKGNvbnRlbnQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBwYXJ0cy5qb2luKFwiXFxuXFxuXCIpLnRyaW0oKTtcblx0fVxuXG5cdHByaXZhdGUgcmVyZW5kZXJOb2RlKG5vZGVJZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgZWwgPSB0aGlzLm5vZGVFbGVtZW50cy5nZXQobm9kZUlkKTtcblx0XHRjb25zdCBub2RlID0gdGhpcy5ub2Rlcy5nZXQobm9kZUlkKTtcblx0XHRpZiAoIWVsIHx8ICFub2RlKSByZXR1cm47XG5cblx0XHRlbC5yZW1vdmUoKTtcblx0XHR0aGlzLm5vZGVFbGVtZW50cy5kZWxldGUobm9kZUlkKTtcblx0XHR0aGlzLnJlbmRlck5vZGUobm9kZSk7XG5cdH1cblxuXHRhc3luYyBvbkNsb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIEZpbmFsIHNhdmUgYmVmb3JlIGNsb3Npbmdcblx0XHR0aGlzLnRyaWdnZXJTYXZlKCk7XG5cdH1cbn1cblxuY2xhc3MgUHJvbXB0RWRpdG9yTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG5cdHByaXZhdGUgcHJvbXB0OiBzdHJpbmc7XG5cdHByaXZhdGUgY29udGV4dFRlbXBsYXRlOiBzdHJpbmc7XG5cdHByaXZhdGUgb25TYXZlOiAocHJvbXB0OiBzdHJpbmcsIHRlbXBsYXRlOiBzdHJpbmcpID0+IHZvaWQ7XG5cblx0Y29uc3RydWN0b3IoYXBwOiBhbnksIHByb21wdDogc3RyaW5nLCBjb250ZXh0VGVtcGxhdGU6IHN0cmluZywgb25TYXZlOiAocHJvbXB0OiBzdHJpbmcsIHRlbXBsYXRlOiBzdHJpbmcpID0+IHZvaWQpIHtcblx0XHRzdXBlcihhcHApO1xuXHRcdHRoaXMucHJvbXB0ID0gcHJvbXB0O1xuXHRcdHRoaXMuY29udGV4dFRlbXBsYXRlID0gY29udGV4dFRlbXBsYXRlO1xuXHRcdHRoaXMub25TYXZlID0gb25TYXZlO1xuXHR9XG5cblx0b25PcGVuKCkge1xuXHRcdGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuXHRcdGNvbnRlbnRFbC5lbXB0eSgpO1xuXHRcdGNvbnRlbnRFbC5hZGRDbGFzcyhcInJhYmJpdG1hcC1wcm9tcHQtbW9kYWxcIik7XG5cblx0XHQvLyBTeXN0ZW0gUHJvbXB0IHNlY3Rpb25cblx0XHRjb250ZW50RWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IFwiU3lzdGVtIFByb21wdFwiIH0pO1xuXHRcdGNvbnN0IHByb21wdFRleHRhcmVhID0gY29udGVudEVsLmNyZWF0ZUVsKFwidGV4dGFyZWFcIiwge1xuXHRcdFx0Y2xzOiBcInJhYmJpdG1hcC1wcm9tcHQtdGV4dGFyZWFcIixcblx0XHRcdGF0dHI6IHsgcGxhY2Vob2xkZXI6IFwiRW50ZXIgc3lzdGVtIHByb21wdCBmb3IgdGhpcyBjaGF0Li4uXCIgfVxuXHRcdH0pO1xuXHRcdHByb21wdFRleHRhcmVhLnZhbHVlID0gdGhpcy5wcm9tcHQ7XG5cblx0XHQvLyBDb250ZXh0IFRlbXBsYXRlIHNlY3Rpb25cblx0XHRjb250ZW50RWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IFwiQ29udGV4dCBUZW1wbGF0ZVwiLCBjbHM6IFwicmFiYml0bWFwLXByb21wdC1zZWN0aW9uLXRpdGxlXCIgfSk7XG5cdFx0Y29udGVudEVsLmNyZWF0ZUVsKFwicFwiLCB7XG5cdFx0XHR0ZXh0OiBcIlZhcmlhYmxlczoge2ZpbGVwYXRofSwge2ZpbGVuYW1lfSwge2NvbnRlbnR9XCIsXG5cdFx0XHRjbHM6IFwicmFiYml0bWFwLXByb21wdC1oaW50XCJcblx0XHR9KTtcblx0XHRjb25zdCB0ZW1wbGF0ZVRleHRhcmVhID0gY29udGVudEVsLmNyZWF0ZUVsKFwidGV4dGFyZWFcIiwge1xuXHRcdFx0Y2xzOiBcInJhYmJpdG1hcC1wcm9tcHQtdGV4dGFyZWEgcmFiYml0bWFwLXRlbXBsYXRlLXRleHRhcmVhXCIsXG5cdFx0XHRhdHRyOiB7IHBsYWNlaG9sZGVyOiBcIlRlbXBsYXRlIGZvciBlYWNoIGNvbnRleHQgZmlsZS4uLlwiIH1cblx0XHR9KTtcblx0XHR0ZW1wbGF0ZVRleHRhcmVhLnZhbHVlID0gdGhpcy5jb250ZXh0VGVtcGxhdGU7XG5cblx0XHQvLyBQcmV2aWV3XG5cdFx0Y29udGVudEVsLmNyZWF0ZUVsKFwiaDRcIiwgeyB0ZXh0OiBcIlByZXZpZXdcIiwgY2xzOiBcInJhYmJpdG1hcC1wcm9tcHQtc2VjdGlvbi10aXRsZVwiIH0pO1xuXHRcdGNvbnN0IHByZXZpZXcgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1wcm9tcHQtcHJldmlld1wiIH0pO1xuXG5cdFx0Y29uc3QgdXBkYXRlUHJldmlldyA9ICgpID0+IHtcblx0XHRcdGNvbnN0IHRlbXBsYXRlID0gdGVtcGxhdGVUZXh0YXJlYS52YWx1ZTtcblx0XHRcdGNvbnN0IGV4YW1wbGUgPSB0ZW1wbGF0ZVxuXHRcdFx0XHQucmVwbGFjZSgvXFx7ZmlsZXBhdGhcXH0vZywgXCJmb2xkZXIvZXhhbXBsZS5tZFwiKVxuXHRcdFx0XHQucmVwbGFjZSgvXFx7ZmlsZW5hbWVcXH0vZywgXCJleGFtcGxlLm1kXCIpXG5cdFx0XHRcdC5yZXBsYWNlKC9cXHtjb250ZW50XFx9L2csIFwiRmlsZSBjb250ZW50IGhlcmUuLi5cIik7XG5cdFx0XHRwcmV2aWV3LnNldFRleHQoZXhhbXBsZSk7XG5cdFx0fTtcblx0XHR1cGRhdGVQcmV2aWV3KCk7XG5cdFx0dGVtcGxhdGVUZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKFwiaW5wdXRcIiwgdXBkYXRlUHJldmlldyk7XG5cblx0XHRjb25zdCBidXR0b25Db250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1wcm9tcHQtYnV0dG9uc1wiIH0pO1xuXG5cdFx0Y29uc3QgY2FuY2VsQnRuID0gYnV0dG9uQ29udGFpbmVyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJDYW5jZWxcIiB9KTtcblx0XHRjYW5jZWxCdG4ub25jbGljayA9ICgpID0+IHRoaXMuY2xvc2UoKTtcblxuXHRcdGNvbnN0IHNhdmVCdG4gPSBidXR0b25Db250YWluZXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlNhdmVcIiwgY2xzOiBcIm1vZC1jdGFcIiB9KTtcblx0XHRzYXZlQnRuLm9uY2xpY2sgPSAoKSA9PiB7XG5cdFx0XHR0aGlzLm9uU2F2ZShwcm9tcHRUZXh0YXJlYS52YWx1ZSwgdGVtcGxhdGVUZXh0YXJlYS52YWx1ZSk7XG5cdFx0XHR0aGlzLmNsb3NlKCk7XG5cdFx0fTtcblx0fVxuXG5cdG9uQ2xvc2UoKSB7XG5cdFx0Y29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG5cdFx0Y29udGVudEVsLmVtcHR5KCk7XG5cdH1cbn1cblxuY2xhc3MgRXhwYW5kZWRDaGF0TW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG5cdHByaXZhdGUgdmlldzogUmFiYml0TWFwVmlldztcblx0cHJpdmF0ZSBub2RlSWQ6IHN0cmluZztcblx0cHJpdmF0ZSBtZXNzYWdlc0NvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgaW5wdXQ6IEhUTUxUZXh0QXJlYUVsZW1lbnQ7XG5cdHByaXZhdGUgdXBkYXRlSW50ZXJ2YWw6IG51bWJlcjtcblxuXHRjb25zdHJ1Y3RvcihhcHA6IGFueSwgdmlldzogUmFiYml0TWFwVmlldywgbm9kZUlkOiBzdHJpbmcpIHtcblx0XHRzdXBlcihhcHApO1xuXHRcdHRoaXMudmlldyA9IHZpZXc7XG5cdFx0dGhpcy5ub2RlSWQgPSBub2RlSWQ7XG5cdH1cblxuXHRvbk9wZW4oKSB7XG5cdFx0Y29uc3QgeyBjb250ZW50RWwsIG1vZGFsRWwgfSA9IHRoaXM7XG5cdFx0bW9kYWxFbC5hZGRDbGFzcyhcInJhYmJpdG1hcC1leHBhbmRlZC1jaGF0LW1vZGFsXCIpO1xuXHRcdGNvbnRlbnRFbC5lbXB0eSgpO1xuXG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMudmlldy5nZXROb2RlKHRoaXMubm9kZUlkKTtcblx0XHRjb25zdCBjaGF0U3RhdGUgPSB0aGlzLnZpZXcuZ2V0Q2hhdFN0YXRlKHRoaXMubm9kZUlkKTtcblxuXHRcdC8vIEhlYWRlclxuXHRcdGNvbnN0IGhlYWRlciA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLWV4cGFuZGVkLWhlYWRlclwiIH0pO1xuXHRcdGhlYWRlci5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogbm9kZT8udGl0bGUgfHwgXCJDaGF0XCIgfSk7XG5cblx0XHRpZiAoY2hhdFN0YXRlKSB7XG5cdFx0XHRoZWFkZXIuY3JlYXRlRWwoXCJzcGFuXCIsIHtcblx0XHRcdFx0dGV4dDogYCR7Y2hhdFN0YXRlLnByb3ZpZGVyfSAvICR7Y2hhdFN0YXRlLm1vZGVsfWAsXG5cdFx0XHRcdGNsczogXCJyYWJiaXRtYXAtZXhwYW5kZWQtbW9kZWxcIlxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gTWVzc2FnZXNcblx0XHR0aGlzLm1lc3NhZ2VzQ29udGFpbmVyID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtZXhwYW5kZWQtbWVzc2FnZXNcIiB9KTtcblx0XHR0aGlzLnJlbmRlck1lc3NhZ2VzKCk7XG5cblx0XHQvLyBJbnB1dCBhcmVhXG5cdFx0Y29uc3QgaW5wdXRBcmVhID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtZXhwYW5kZWQtaW5wdXQtYXJlYVwiIH0pO1xuXHRcdHRoaXMuaW5wdXQgPSBpbnB1dEFyZWEuY3JlYXRlRWwoXCJ0ZXh0YXJlYVwiLCB7XG5cdFx0XHRjbHM6IFwicmFiYml0bWFwLWV4cGFuZGVkLWlucHV0XCIsXG5cdFx0XHRhdHRyOiB7IHBsYWNlaG9sZGVyOiBcIlR5cGUgYSBtZXNzYWdlLi4uXCIsIHJvd3M6IFwiM1wiIH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IHNlbmRCdG4gPSBpbnB1dEFyZWEuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuXHRcdFx0dGV4dDogXCJTZW5kXCIsXG5cdFx0XHRjbHM6IFwicmFiYml0bWFwLWV4cGFuZGVkLXNlbmQtYnRuXCJcblx0XHR9KTtcblxuXHRcdHNlbmRCdG4ub25jbGljayA9ICgpID0+IHRoaXMuc2VuZE1lc3NhZ2UoKTtcblx0XHR0aGlzLmlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChlKSA9PiB7XG5cdFx0XHRpZiAoZS5rZXkgPT09IFwiRW50ZXJcIiAmJiAhZS5zaGlmdEtleSkge1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHRoaXMuc2VuZE1lc3NhZ2UoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vIEZvY3VzIGlucHV0IGFuZCBzY3JvbGwgdG8gYm90dG9tXG5cdFx0dGhpcy5pbnB1dC5mb2N1cygpO1xuXHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5tZXNzYWdlc0NvbnRhaW5lci5zY3JvbGxUb3AgPSB0aGlzLm1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbEhlaWdodDtcblx0XHR9LCA1MCk7XG5cblx0XHQvLyBTeW5jIG1lc3NhZ2VzIHBlcmlvZGljYWxseVxuXHRcdHRoaXMudXBkYXRlSW50ZXJ2YWwgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXHRcdFx0dGhpcy5yZW5kZXJNZXNzYWdlcygpO1xuXHRcdH0sIDUwMCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlck1lc3NhZ2VzKHNob3dMb2FkaW5nOiBib29sZWFuID0gZmFsc2UpIHtcblx0XHRjb25zdCBtZXNzYWdlcyA9IHRoaXMudmlldy5nZXRDaGF0TWVzc2FnZXModGhpcy5ub2RlSWQpIHx8IFtdO1xuXHRcdGNvbnN0IHNjcm9sbGVkVG9Cb3R0b20gPSB0aGlzLm1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbFRvcCArIHRoaXMubWVzc2FnZXNDb250YWluZXIuY2xpZW50SGVpZ2h0ID49IHRoaXMubWVzc2FnZXNDb250YWluZXIuc2Nyb2xsSGVpZ2h0IC0gMTA7XG5cblx0XHR0aGlzLm1lc3NhZ2VzQ29udGFpbmVyLmVtcHR5KCk7XG5cblx0XHRmb3IgKGNvbnN0IG1zZyBvZiBtZXNzYWdlcykge1xuXHRcdFx0Y29uc3QgbXNnRWwgPSB0aGlzLm1lc3NhZ2VzQ29udGFpbmVyLmNyZWF0ZURpdih7XG5cdFx0XHRcdGNsczogYHJhYmJpdG1hcC1leHBhbmRlZC1tZXNzYWdlIHJhYmJpdG1hcC1leHBhbmRlZC0ke21zZy5yb2xlfWBcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAobXNnLnJvbGUgPT09IFwidXNlclwiICYmIG1zZy5jb250ZXh0RmlsZXMgJiYgbXNnLmNvbnRleHRGaWxlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGNvbnN0IGNvbnRleHRFbCA9IG1zZ0VsLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtZXhwYW5kZWQtY29udGV4dFwiIH0pO1xuXHRcdFx0XHRjb250ZXh0RWwuY3JlYXRlU3Bhbih7IHRleHQ6IFwiQ29udGV4dDogXCIgfSk7XG5cdFx0XHRcdGNvbnRleHRFbC5jcmVhdGVTcGFuKHsgdGV4dDogbXNnLmNvbnRleHRGaWxlcy5tYXAoZiA9PiBmLnNwbGl0KFwiL1wiKS5wb3AoKSkuam9pbihcIiwgXCIpIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRtc2dFbC5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLWV4cGFuZGVkLWNvbnRlbnRcIiwgdGV4dDogbXNnLmNvbnRlbnQgfSk7XG5cdFx0fVxuXG5cdFx0Ly8gU2hvdyBsb2FkaW5nIGluZGljYXRvclxuXHRcdGlmIChzaG93TG9hZGluZykge1xuXHRcdFx0Y29uc3QgbG9hZGluZ0VsID0gdGhpcy5tZXNzYWdlc0NvbnRhaW5lci5jcmVhdGVEaXYoe1xuXHRcdFx0XHRjbHM6IFwicmFiYml0bWFwLWV4cGFuZGVkLW1lc3NhZ2UgcmFiYml0bWFwLWV4cGFuZGVkLWFzc2lzdGFudCByYWJiaXRtYXAtZXhwYW5kZWQtbG9hZGluZ1wiXG5cdFx0XHR9KTtcblx0XHRcdGxvYWRpbmdFbC5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLWV4cGFuZGVkLWNvbnRlbnRcIiwgdGV4dDogXCIuLi5cIiB9KTtcblx0XHR9XG5cblx0XHRpZiAoc2Nyb2xsZWRUb0JvdHRvbSB8fCBzaG93TG9hZGluZykge1xuXHRcdFx0dGhpcy5tZXNzYWdlc0NvbnRhaW5lci5zY3JvbGxUb3AgPSB0aGlzLm1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbEhlaWdodDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNlbmRNZXNzYWdlKCkge1xuXHRcdGNvbnN0IHRleHQgPSB0aGlzLmlucHV0LnZhbHVlLnRyaW0oKTtcblx0XHRpZiAoIXRleHQpIHJldHVybjtcblxuXHRcdHRoaXMuaW5wdXQudmFsdWUgPSBcIlwiO1xuXHRcdHRoaXMuaW5wdXQuZGlzYWJsZWQgPSB0cnVlO1xuXG5cdFx0Ly8gU2hvdyB1c2VyIG1lc3NhZ2UgKyBsb2FkaW5nXG5cdFx0dGhpcy5yZW5kZXJNZXNzYWdlcyh0cnVlKTtcblxuXHRcdGF3YWl0IHRoaXMudmlldy5zZW5kQ2hhdE1lc3NhZ2UodGhpcy5ub2RlSWQsIHRleHQpO1xuXG5cdFx0dGhpcy5pbnB1dC5kaXNhYmxlZCA9IGZhbHNlO1xuXHRcdHRoaXMuaW5wdXQuZm9jdXMoKTtcblx0XHR0aGlzLnJlbmRlck1lc3NhZ2VzKCk7XG5cdFx0dGhpcy5tZXNzYWdlc0NvbnRhaW5lci5zY3JvbGxUb3AgPSB0aGlzLm1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbEhlaWdodDtcblx0fVxuXG5cdG9uQ2xvc2UoKSB7XG5cdFx0aWYgKHRoaXMudXBkYXRlSW50ZXJ2YWwpIHtcblx0XHRcdHdpbmRvdy5jbGVhckludGVydmFsKHRoaXMudXBkYXRlSW50ZXJ2YWwpO1xuXHRcdH1cblx0XHRjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcblx0XHRjb250ZW50RWwuZW1wdHkoKTtcblx0fVxufVxuXG5jbGFzcyBTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuXHRwbHVnaW46IFJhYmJpdE1hcFBsdWdpbjtcblxuXHRjb25zdHJ1Y3RvcihhcHA6IGFueSwgcGx1Z2luOiBSYWJiaXRNYXBQbHVnaW4pIHtcblx0XHRzdXBlcihhcHApO1xuXHRcdHRoaXMucGx1Z2luID0gcGx1Z2luO1xuXHR9XG5cblx0b25PcGVuKCkge1xuXHRcdGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuXHRcdGNvbnRlbnRFbC5lbXB0eSgpO1xuXHRcdGNvbnRlbnRFbC5hZGRDbGFzcyhcInJhYmJpdG1hcC1zZXR0aW5ncy1tb2RhbFwiKTtcblxuXHRcdGNvbnRlbnRFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJQcm92aWRlciBTZXR0aW5nc1wiIH0pO1xuXG5cdFx0Ly8gQWJvdXQgc2VjdGlvblxuXHRcdGNvbnN0IGFib3V0U2VjdGlvbiA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLWFib3V0LXNlY3Rpb25cIiB9KTtcblx0XHRhYm91dFNlY3Rpb24uY3JlYXRlRWwoXCJwXCIsIHtcblx0XHRcdHRleHQ6IFwiVGhpcyBSYWJiaXRNYXAgcGx1Z2luIGlzIHBhcnQgb2YgXCIsXG5cdFx0fSkuY3JlYXRlRWwoXCJhXCIsIHtcblx0XHRcdHRleHQ6IFwicmFiYml0bWFwLmNvbVwiLFxuXHRcdFx0aHJlZjogXCJodHRwczovL3JhYmJpdG1hcC5jb21cIixcblx0XHR9KTtcblx0XHRhYm91dFNlY3Rpb24ucXVlcnlTZWxlY3RvcihcInBcIik/LmFwcGVuZFRleHQoXCIgXHUyMDE0IGEgY2xvdWQgcmVzZWFyY2ggT1MgZm9yIHNhdmluZyBhbmQgb3JnYW5pemluZyB3ZWIgY29udGVudCBvbiBjYW52YXMuXCIpO1xuXG5cdFx0Y29uc3QgYWJvdXRUZXh0ID0gYWJvdXRTZWN0aW9uLmNyZWF0ZUVsKFwicFwiKTtcblx0XHRhYm91dFRleHQuYXBwZW5kVGV4dChcIldlJ3JlIGJ1aWxkaW5nIGRlZXAgaW50ZWdyYXRpb24gYmV0d2VlbiB3ZWIgcmVzZWFyY2ggYW5kIExMTSBjb250ZXh0IFx1MjAxNCBtYWtpbmcgY29udGV4dCBtYW5hZ2VtZW50IGVhc3kgYW5kIGRlbGlnaHRmdWwuIEJ1aWx0IGJ5IFwiKTtcblx0XHRhYm91dFRleHQuY3JlYXRlRWwoXCJhXCIsIHtcblx0XHRcdHRleHQ6IFwiQGJheXJhZGlvblwiLFxuXHRcdFx0aHJlZjogXCJodHRwczovL3guY29tL2JheXJhZGlvblwiLFxuXHRcdH0pO1xuXHRcdGFib3V0VGV4dC5hcHBlbmRUZXh0KFwiLiBKb2luIG91ciBcIik7XG5cdFx0YWJvdXRUZXh0LmNyZWF0ZUVsKFwiYVwiLCB7XG5cdFx0XHR0ZXh0OiBcIkRpc2NvcmQgY29tbXVuaXR5XCIsXG5cdFx0XHRocmVmOiBcImh0dHBzOi8vZGlzY29yZC5nZy9VZVVCa214RWNWXCIsXG5cdFx0fSk7XG5cdFx0YWJvdXRUZXh0LmFwcGVuZFRleHQoXCIhXCIpO1xuXG5cdFx0Ly8gUHJvdmlkZXJzIHNlY3Rpb25cblx0XHRjb25zdCBwcm92aWRlcnNDb250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1wcm92aWRlcnMtY29udGFpbmVyXCIgfSk7XG5cblx0XHRjb25zdCByZW5kZXJQcm92aWRlcnMgPSAoKSA9PiB7XG5cdFx0XHRwcm92aWRlcnNDb250YWluZXIuZW1wdHkoKTtcblxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnBsdWdpbi5zZXR0aW5ncy5wcm92aWRlcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5wcm92aWRlcnNbaV07XG5cdFx0XHRcdGNvbnN0IHByb3ZpZGVyU2VjdGlvbiA9IHByb3ZpZGVyc0NvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLXByb3ZpZGVyLXNlY3Rpb25cIiB9KTtcblxuXHRcdFx0XHQvLyBQcm92aWRlciBoZWFkZXIgd2l0aCBuYW1lIGFuZCB0b2dnbGVcblx0XHRcdFx0Y29uc3QgaGVhZGVyUm93ID0gcHJvdmlkZXJTZWN0aW9uLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtcHJvdmlkZXItaGVhZGVyXCIgfSk7XG5cdFx0XHRcdGhlYWRlclJvdy5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogcHJvdmlkZXIubmFtZSB9KTtcblxuXHRcdFx0XHQvLyBFbmFibGVkIHRvZ2dsZVxuXHRcdFx0XHRjb25zdCB0b2dnbGVDb250YWluZXIgPSBoZWFkZXJSb3cuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1wcm92aWRlci10b2dnbGVcIiB9KTtcblx0XHRcdFx0Y29uc3QgdG9nZ2xlTGFiZWwgPSB0b2dnbGVDb250YWluZXIuY3JlYXRlRWwoXCJsYWJlbFwiLCB7IGNsczogXCJyYWJiaXRtYXAtdG9nZ2xlLWxhYmVsXCIgfSk7XG5cdFx0XHRcdGNvbnN0IHRvZ2dsZUlucHV0ID0gdG9nZ2xlTGFiZWwuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IHR5cGU6IFwiY2hlY2tib3hcIiB9KTtcblx0XHRcdFx0dG9nZ2xlSW5wdXQuY2hlY2tlZCA9IHByb3ZpZGVyLmVuYWJsZWQ7XG5cdFx0XHRcdHRvZ2dsZUxhYmVsLmNyZWF0ZVNwYW4oeyB0ZXh0OiBwcm92aWRlci5lbmFibGVkID8gXCJFbmFibGVkXCIgOiBcIkRpc2FibGVkXCIgfSk7XG5cdFx0XHRcdHRvZ2dsZUlucHV0Lm9uY2hhbmdlID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHByb3ZpZGVyLmVuYWJsZWQgPSB0b2dnbGVJbnB1dC5jaGVja2VkO1xuXHRcdFx0XHRcdHRvZ2dsZUxhYmVsLnF1ZXJ5U2VsZWN0b3IoXCJzcGFuXCIpIS50ZXh0Q29udGVudCA9IHByb3ZpZGVyLmVuYWJsZWQgPyBcIkVuYWJsZWRcIiA6IFwiRGlzYWJsZWRcIjtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0fTtcblxuXHRcdFx0XHQvLyBCYXNlIFVSTCBzZXR0aW5nXG5cdFx0XHRcdG5ldyBTZXR0aW5nKHByb3ZpZGVyU2VjdGlvbilcblx0XHRcdFx0XHQuc2V0TmFtZShcIkJhc2UgVVJMXCIpXG5cdFx0XHRcdFx0LnNldERlc2MoXCJBUEkgZW5kcG9pbnQgVVJMIChjaGFuZ2UgZm9yIGN1c3RvbS9wcm94eSBkZXBsb3ltZW50cylcIilcblx0XHRcdFx0XHQuYWRkVGV4dCgodGV4dCkgPT5cblx0XHRcdFx0XHRcdHRleHRcblx0XHRcdFx0XHRcdFx0LnNldFBsYWNlaG9sZGVyKFwiaHR0cHM6Ly9hcGkuZXhhbXBsZS5jb20vdjFcIilcblx0XHRcdFx0XHRcdFx0LnNldFZhbHVlKHByb3ZpZGVyLmJhc2VVcmwpXG5cdFx0XHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRwcm92aWRlci5iYXNlVXJsID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0KTtcblxuXHRcdFx0XHQvLyBBUEkgS2V5IHNldHRpbmdcblx0XHRcdFx0bmV3IFNldHRpbmcocHJvdmlkZXJTZWN0aW9uKVxuXHRcdFx0XHRcdC5zZXROYW1lKFwiQVBJIEtleVwiKVxuXHRcdFx0XHRcdC5zZXREZXNjKGBFbnRlciB5b3VyICR7cHJvdmlkZXIubmFtZX0gQVBJIGtleWApXG5cdFx0XHRcdFx0LmFkZFRleHQoKHRleHQpID0+XG5cdFx0XHRcdFx0XHR0ZXh0XG5cdFx0XHRcdFx0XHRcdC5zZXRQbGFjZWhvbGRlcihcInNrLS4uLlwiKVxuXHRcdFx0XHRcdFx0XHQuc2V0VmFsdWUocHJvdmlkZXIuYXBpS2V5KVxuXHRcdFx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0cHJvdmlkZXIuYXBpS2V5ID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0KTtcblxuXHRcdFx0XHQvLyBBUEkgRm9ybWF0IHNldHRpbmdcblx0XHRcdFx0bmV3IFNldHRpbmcocHJvdmlkZXJTZWN0aW9uKVxuXHRcdFx0XHRcdC5zZXROYW1lKFwiQVBJIEZvcm1hdFwiKVxuXHRcdFx0XHRcdC5zZXREZXNjKFwiU2VsZWN0IHRoZSBBUEkgZm9ybWF0IGZvciB0aGlzIHByb3ZpZGVyXCIpXG5cdFx0XHRcdFx0LmFkZERyb3Bkb3duKChkcm9wZG93bikgPT5cblx0XHRcdFx0XHRcdGRyb3Bkb3duXG5cdFx0XHRcdFx0XHRcdC5hZGRPcHRpb24oXCJvcGVuYWlcIiwgXCJPcGVuQUkgQ29tcGF0aWJsZVwiKVxuXHRcdFx0XHRcdFx0XHQuYWRkT3B0aW9uKFwiYW50aHJvcGljXCIsIFwiQW50aHJvcGljIChDbGF1ZGUpXCIpXG5cdFx0XHRcdFx0XHRcdC5hZGRPcHRpb24oXCJnb29nbGVcIiwgXCJHb29nbGUgKEdlbWluaSlcIilcblx0XHRcdFx0XHRcdFx0LnNldFZhbHVlKHByb3ZpZGVyLmFwaUZvcm1hdCB8fCBcIm9wZW5haVwiKVxuXHRcdFx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0cHJvdmlkZXIuYXBpRm9ybWF0ID0gdmFsdWUgYXMgXCJvcGVuYWlcIiB8IFwiYW50aHJvcGljXCIgfCBcImdvb2dsZVwiO1xuXHRcdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0Ly8gTW9kZWxzIHNlY3Rpb25cblx0XHRcdFx0Y29uc3QgbW9kZWxzSGVhZGVyID0gcHJvdmlkZXJTZWN0aW9uLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtbW9kZWxzLWhlYWRlclwiIH0pO1xuXHRcdFx0XHRtb2RlbHNIZWFkZXIuY3JlYXRlRWwoXCJoNFwiLCB7IHRleHQ6IFwiTW9kZWxzXCIgfSk7XG5cblx0XHRcdFx0Ly8gTW9kZWxzIGlucHV0IHJvd1xuXHRcdFx0XHRjb25zdCBpbnB1dFJvdyA9IHByb3ZpZGVyU2VjdGlvbi5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLW1vZGVscy1pbnB1dC1yb3dcIiB9KTtcblx0XHRcdFx0Y29uc3QgbW9kZWxJbnB1dCA9IGlucHV0Um93LmNyZWF0ZUVsKFwiaW5wdXRcIiwge1xuXHRcdFx0XHRcdHR5cGU6IFwidGV4dFwiLFxuXHRcdFx0XHRcdHBsYWNlaG9sZGVyOiBcImUuZy4gZ3B0LTRvIG9yIGFudGhyb3BpYy9jbGF1ZGUtMy41LXNvbm5ldFwiLFxuXHRcdFx0XHRcdGNsczogXCJyYWJiaXRtYXAtbW9kZWxzLWlucHV0XCJcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGNvbnN0IGFkZEJ1dHRvbiA9IGlucHV0Um93LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdFx0XHR0ZXh0OiBcIkFkZFwiLFxuXHRcdFx0XHRcdGNsczogXCJyYWJiaXRtYXAtbW9kZWxzLWFkZC1idG5cIlxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHQvLyBNb2RlbHMgbGlzdFxuXHRcdFx0XHRjb25zdCBtb2RlbHNMaXN0ID0gcHJvdmlkZXJTZWN0aW9uLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtbW9kZWxzLWxpc3RcIiB9KTtcblxuXHRcdFx0XHRjb25zdCByZW5kZXJNb2RlbHNMaXN0ID0gKCkgPT4ge1xuXHRcdFx0XHRcdG1vZGVsc0xpc3QuZW1wdHkoKTtcblx0XHRcdFx0XHRpZiAocHJvdmlkZXIubW9kZWxzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0bW9kZWxzTGlzdC5jcmVhdGVFbChcImRpdlwiLCB7XG5cdFx0XHRcdFx0XHRcdHRleHQ6IFwiTm8gbW9kZWxzIGNvbmZpZ3VyZWQuXCIsXG5cdFx0XHRcdFx0XHRcdGNsczogXCJyYWJiaXRtYXAtbW9kZWxzLWVtcHR5XCJcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGZvciAoY29uc3QgbW9kZWwgb2YgcHJvdmlkZXIubW9kZWxzKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBpdGVtID0gbW9kZWxzTGlzdC5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLW1vZGVscy1pdGVtXCIgfSk7XG5cdFx0XHRcdFx0XHRpdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBtb2RlbCwgY2xzOiBcInJhYmJpdG1hcC1tb2RlbHMtbmFtZVwiIH0pO1xuXHRcdFx0XHRcdFx0Y29uc3QgcmVtb3ZlQnRuID0gaXRlbS5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHRcdFx0XHRcdHRleHQ6IFwiXHUwMEQ3XCIsXG5cdFx0XHRcdFx0XHRcdGNsczogXCJyYWJiaXRtYXAtbW9kZWxzLXJlbW92ZS1idG5cIlxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRyZW1vdmVCdG4ub25jbGljayA9IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdFx0cHJvdmlkZXIubW9kZWxzID0gcHJvdmlkZXIubW9kZWxzLmZpbHRlcihtID0+IG0gIT09IG1vZGVsKTtcblx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHRcdHJlbmRlck1vZGVsc0xpc3QoKTtcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdGFkZEJ1dHRvbi5vbmNsaWNrID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IG5ld01vZGVsID0gbW9kZWxJbnB1dC52YWx1ZS50cmltKCk7XG5cdFx0XHRcdFx0aWYgKCFuZXdNb2RlbCkgcmV0dXJuO1xuXHRcdFx0XHRcdGlmICghcHJvdmlkZXIubW9kZWxzLmluY2x1ZGVzKG5ld01vZGVsKSkge1xuXHRcdFx0XHRcdFx0cHJvdmlkZXIubW9kZWxzLnB1c2gobmV3TW9kZWwpO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG1vZGVsSW5wdXQudmFsdWUgPSBcIlwiO1xuXHRcdFx0XHRcdHJlbmRlck1vZGVsc0xpc3QoKTtcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRtb2RlbElucHV0Lm9ua2V5ZG93biA9IChlKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGUua2V5ID09PSBcIkVudGVyXCIpIHtcblx0XHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHRcdGFkZEJ1dHRvbi5jbGljaygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblxuXHRcdFx0XHRyZW5kZXJNb2RlbHNMaXN0KCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEFkZCBuZXcgcHJvdmlkZXIgYnV0dG9uXG5cdFx0XHRjb25zdCBhZGRQcm92aWRlclJvdyA9IHByb3ZpZGVyc0NvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLWFkZC1wcm92aWRlci1yb3dcIiB9KTtcblx0XHRcdGNvbnN0IG5ld1Byb3ZpZGVySW5wdXQgPSBhZGRQcm92aWRlclJvdy5jcmVhdGVFbChcImlucHV0XCIsIHtcblx0XHRcdFx0dHlwZTogXCJ0ZXh0XCIsXG5cdFx0XHRcdHBsYWNlaG9sZGVyOiBcIk5ldyBwcm92aWRlciBuYW1lIChlLmcuIE9sbGFtYSlcIixcblx0XHRcdFx0Y2xzOiBcInJhYmJpdG1hcC1uZXctcHJvdmlkZXItaW5wdXRcIlxuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBhZGRQcm92aWRlckJ0biA9IGFkZFByb3ZpZGVyUm93LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdFx0dGV4dDogXCJBZGQgUHJvdmlkZXJcIixcblx0XHRcdFx0Y2xzOiBcInJhYmJpdG1hcC1hZGQtcHJvdmlkZXItYnRuXCJcblx0XHRcdH0pO1xuXG5cdFx0XHRhZGRQcm92aWRlckJ0bi5vbmNsaWNrID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBuYW1lID0gbmV3UHJvdmlkZXJJbnB1dC52YWx1ZS50cmltKCk7XG5cdFx0XHRcdGlmICghbmFtZSkgcmV0dXJuO1xuXHRcdFx0XHRpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3MucHJvdmlkZXJzLnNvbWUocCA9PiBwLm5hbWUgPT09IG5hbWUpKSB7XG5cdFx0XHRcdFx0bmV3IE5vdGljZShgUHJvdmlkZXIgXCIke25hbWV9XCIgYWxyZWFkeSBleGlzdHMuYCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLnByb3ZpZGVycy5wdXNoKHtcblx0XHRcdFx0XHRuYW1lLFxuXHRcdFx0XHRcdGJhc2VVcmw6IFwiaHR0cHM6Ly9hcGkuZXhhbXBsZS5jb20vdjFcIixcblx0XHRcdFx0XHRhcGlLZXk6IFwiXCIsXG5cdFx0XHRcdFx0bW9kZWxzOiBbXSxcblx0XHRcdFx0XHRlbmFibGVkOiB0cnVlXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0bmV3UHJvdmlkZXJJbnB1dC52YWx1ZSA9IFwiXCI7XG5cdFx0XHRcdHJlbmRlclByb3ZpZGVycygpO1xuXHRcdFx0fTtcblx0XHR9O1xuXG5cdFx0cmVuZGVyUHJvdmlkZXJzKCk7XG5cblx0XHQvLyBIZWxwIGxpbmtzXG5cdFx0Y29udGVudEVsLmNyZWF0ZUVsKFwicFwiLCB7XG5cdFx0XHR0ZXh0OiBcIkdldCB5b3VyIEFQSSBrZXlzIGZyb206XCIsXG5cdFx0XHRjbHM6IFwicmFiYml0bWFwLXNldHRpbmdzLWluZm9cIixcblx0XHR9KTtcblxuXHRcdGNvbnN0IGxpbmtDb250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1zZXR0aW5ncy1saW5rc1wiIH0pO1xuXHRcdGxpbmtDb250YWluZXIuY3JlYXRlRWwoXCJhXCIsIHtcblx0XHRcdHRleHQ6IFwiT3BlbkFJIFBsYXRmb3JtXCIsXG5cdFx0XHRocmVmOiBcImh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9hcGkta2V5c1wiLFxuXHRcdH0pO1xuXHRcdGxpbmtDb250YWluZXIuY3JlYXRlRWwoXCJzcGFuXCIsIHsgdGV4dDogXCIgfCBcIiB9KTtcblx0XHRsaW5rQ29udGFpbmVyLmNyZWF0ZUVsKFwiYVwiLCB7XG5cdFx0XHR0ZXh0OiBcIk9wZW5Sb3V0ZXJcIixcblx0XHRcdGhyZWY6IFwiaHR0cHM6Ly9vcGVucm91dGVyLmFpL2tleXNcIixcblx0XHR9KTtcblx0XHRsaW5rQ29udGFpbmVyLmNyZWF0ZUVsKFwic3BhblwiLCB7IHRleHQ6IFwiIHwgXCIgfSk7XG5cdFx0bGlua0NvbnRhaW5lci5jcmVhdGVFbChcImFcIiwge1xuXHRcdFx0dGV4dDogXCJHb29nbGUgQUkgU3R1ZGlvXCIsXG5cdFx0XHRocmVmOiBcImh0dHBzOi8vYWlzdHVkaW8uZ29vZ2xlLmNvbS9hcGlrZXlcIixcblx0XHR9KTtcblx0XHRsaW5rQ29udGFpbmVyLmNyZWF0ZUVsKFwic3BhblwiLCB7IHRleHQ6IFwiIHwgXCIgfSk7XG5cdFx0bGlua0NvbnRhaW5lci5jcmVhdGVFbChcImFcIiwge1xuXHRcdFx0dGV4dDogXCJBbnRocm9waWMgQ29uc29sZVwiLFxuXHRcdFx0aHJlZjogXCJodHRwczovL2NvbnNvbGUuYW50aHJvcGljLmNvbS9zZXR0aW5ncy9rZXlzXCIsXG5cdFx0fSk7XG5cdH1cblxuXHRvbkNsb3NlKCkge1xuXHRcdGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuXHRcdGNvbnRlbnRFbC5lbXB0eSgpO1xuXHR9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFJhYmJpdE1hcFBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG5cdHNldHRpbmdzOiBQbHVnaW5TZXR0aW5ncztcblxuXHRhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcblxuXHRcdC8vIFJlZ2lzdGVyIHRoZSB2aWV3XG5cdFx0dGhpcy5yZWdpc3RlclZpZXcoVklFV19UWVBFX1JBQkJJVE1BUCwgKGxlYWYpID0+IG5ldyBSYWJiaXRNYXBWaWV3KGxlYWYsIHRoaXMpKTtcblxuXHRcdC8vIFJlZ2lzdGVyIGZpbGUgZXh0ZW5zaW9uXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbnMoW0ZJTEVfRVhURU5TSU9OXSwgVklFV19UWVBFX1JBQkJJVE1BUCk7XG5cblx0XHQvLyBBZGQgcmliYm9uIGljb25cblx0XHR0aGlzLmFkZFJpYmJvbkljb24oXCJsYXlvdXQtZGFzaGJvYXJkXCIsIFwiQ3JlYXRlIG5ldyBSYWJiaXRNYXBcIiwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgdGhpcy5jcmVhdGVOZXdDYW52YXMoKTtcblx0XHR9KTtcblxuXHRcdC8vIEFkZCBjb21tYW5kIHRvIGNyZWF0ZSBuZXcgY2FudmFzXG5cdFx0dGhpcy5hZGRDb21tYW5kKHtcblx0XHRcdGlkOiBcImNyZWF0ZS1uZXctcmFiYml0bWFwXCIsXG5cdFx0XHRuYW1lOiBcIkNyZWF0ZSBuZXcgUmFiYml0TWFwIGNhbnZhc1wiLFxuXHRcdFx0Y2FsbGJhY2s6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5jcmVhdGVOZXdDYW52YXMoKTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHQvLyBBZGQgY29udGV4dCBtZW51IGZvciBmb2xkZXJzXG5cdFx0dGhpcy5yZWdpc3RlckV2ZW50KFxuXHRcdFx0dGhpcy5hcHAud29ya3NwYWNlLm9uKFwiZmlsZS1tZW51XCIsIChtZW51OiBNZW51LCBmaWxlKSA9PiB7XG5cdFx0XHRcdGlmIChmaWxlIGluc3RhbmNlb2YgVEZvbGRlcikge1xuXHRcdFx0XHRcdG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuXHRcdFx0XHRcdFx0aXRlbS5zZXRUaXRsZShcIk5ldyBSYWJiaXRNYXBcIilcblx0XHRcdFx0XHRcdFx0LnNldEljb24oXCJsYXlvdXQtZGFzaGJvYXJkXCIpXG5cdFx0XHRcdFx0XHRcdC5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmNyZWF0ZU5ld0NhbnZhcyhmaWxlLnBhdGgpO1xuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHQpO1xuXHR9XG5cblx0YXN5bmMgY3JlYXRlTmV3Q2FudmFzKGZvbGRlclBhdGg/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBmb2xkZXIgPSBmb2xkZXJQYXRoIHx8IFwiXCI7XG5cdFx0bGV0IGZpbGVOYW1lID0gXCJVbnRpdGxlZFwiO1xuXHRcdGxldCBjb3VudGVyID0gMTtcblx0XHRsZXQgZmlsZVBhdGggPSBmb2xkZXIgPyBgJHtmb2xkZXJ9LyR7ZmlsZU5hbWV9LiR7RklMRV9FWFRFTlNJT059YCA6IGAke2ZpbGVOYW1lfS4ke0ZJTEVfRVhURU5TSU9OfWA7XG5cblx0XHQvLyBGaW5kIHVuaXF1ZSBuYW1lXG5cdFx0d2hpbGUgKHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlUGF0aCkpIHtcblx0XHRcdGZpbGVOYW1lID0gYFVudGl0bGVkICR7Y291bnRlcn1gO1xuXHRcdFx0ZmlsZVBhdGggPSBmb2xkZXIgPyBgJHtmb2xkZXJ9LyR7ZmlsZU5hbWV9LiR7RklMRV9FWFRFTlNJT059YCA6IGAke2ZpbGVOYW1lfS4ke0ZJTEVfRVhURU5TSU9OfWA7XG5cdFx0XHRjb3VudGVyKys7XG5cdFx0fVxuXG5cdFx0Ly8gQ3JlYXRlIGZpbGUgd2l0aCBlbXB0eSBkYXRhIHN0cnVjdHVyZVxuXHRcdGNvbnN0IGluaXRpYWxEYXRhOiBSYWJiaXRNYXBEYXRhID0ge1xuXHRcdFx0bm9kZXM6IFtdLFxuXHRcdFx0ZWRnZXM6IFtdLFxuXHRcdFx0Y2hhdE1lc3NhZ2VzOiB7fSxcblx0XHRcdGNoYXRTdGF0ZXM6IHt9LFxuXHRcdFx0dmlldzogeyBzY2FsZTogMSwgcGFuWDogMCwgcGFuWTogMCB9XG5cdFx0fTtcblx0XHRjb25zdCBmaWxlID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY3JlYXRlKGZpbGVQYXRoLCBKU09OLnN0cmluZ2lmeShpbml0aWFsRGF0YSwgbnVsbCwgMikpO1xuXG5cdFx0Ly8gT3BlbiBpdFxuXHRcdGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZih0cnVlKTtcblx0XHRhd2FpdCBsZWFmLm9wZW5GaWxlKGZpbGUpO1xuXG5cdFx0bmV3IE5vdGljZShgQ3JlYXRlZCAke2ZpbGVOYW1lfS4ke0ZJTEVfRVhURU5TSU9OfWApO1xuXHR9XG5cblx0YXN5bmMgbG9hZFNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuXHR9XG5cblx0YXN5bmMgc2F2ZVNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG5cdH1cblxuXHRvbnVubG9hZCgpOiB2b2lkIHt9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQWFPO0FBRVAsSUFBTSxzQkFBc0I7QUFDNUIsSUFBTSxpQkFBaUI7QUFnRHZCLElBQU0sbUJBQW1DO0FBQUEsRUFDeEMsY0FBYztBQUFBLEVBQ2Qsa0JBQWtCO0FBQUEsRUFDbEIsd0JBQXdCO0FBQUEsRUFDeEIsV0FBVztBQUFBLElBQ1Y7QUFBQSxNQUNDLE1B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QztBQUdELFNBQUs7QUFBQSxNQUNKLEtBQUssSUFBSSxVQUFVLEdBQUcsYUFBYSxDQUFDLE1BQVksU0FBUztBQUN4RCxZQUFJLGdCQUFnQix5QkFBUztBQUM1QixlQUFLLFFBQVEsQ0FBQyxTQUFTO0FBQ3RCLGlCQUFLLFNBQVMsZUFBZSxFQUMzQixRQUFRLGtCQUFrQixFQUMxQixRQUFRLFlBQVk7QUFDcEIsb0JBQU0sS0FBSyxnQkFBZ0IsS0FBSyxJQUFJO0FBQUEsWUFDckMsQ0FBQztBQUFBLFVBQ0gsQ0FBQztBQUFBLFFBQ0Y7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBTSxnQkFBZ0IsWUFBb0M7QUFDekQsVUFBTSxTQUFTLGNBQWM7QUFDN0IsUUFBSSxXQUFXO0FBQ2YsUUFBSSxVQUFVO0FBQ2QsUUFBSSxXQUFXLFNBQVMsR0FBRyxNQUFNLElBQUksUUFBUSxJQUFJLGNBQWMsS0FBSyxHQUFHLFFBQVEsSUFBSSxjQUFjO0FBR2pHLFdBQU8sS0FBSyxJQUFJLE1BQU0sc0JBQXNCLFFBQVEsR0FBRztBQUN0RCxpQkFBVyxZQUFZLE9BQU87QUFDOUIsaUJBQVcsU0FBUyxHQUFHLE1BQU0sSUFBSSxRQUFRLElBQUksY0FBYyxLQUFLLEdBQUcsUUFBUSxJQUFJLGNBQWM7QUFDN0Y7QUFBQSxJQUNEO0FBR0EsVUFBTSxjQUE2QjtBQUFBLE1BQ2xDLE9BQU8sQ0FBQztBQUFBLE1BQ1IsT0FBTyxDQUFDO0FBQUEsTUFDUixjQUFjLENBQUM7QUFBQSxNQUNmLFlBQVksQ0FBQztBQUFBLE1BQ2IsTUFBTSxFQUFFLE9BQU8sR0FBRyxNQUFNLEdBQUcsTUFBTSxFQUFFO0FBQUEsSUFDcEM7QUFDQSxVQUFNLE9BQU8sTUFBTSxLQUFLLElBQUksTUFBTSxPQUFPLFVBQVUsS0FBSyxVQUFVLGFBQWEsTUFBTSxDQUFDLENBQUM7QUFHdkYsVUFBTSxPQUFPLEtBQUssSUFBSSxVQUFVLFFBQVEsSUFBSTtBQUM1QyxVQUFNLEtBQUssU0FBUyxJQUFJO0FBRXhCLFFBQUksdUJBQU8sV0FBVyxRQUFRLElBQUksY0FBYyxFQUFFO0FBQUEsRUFDbkQ7QUFBQSxFQUVBLE1BQU0sZUFBOEI7QUFDbkMsU0FBSyxXQUFXLE9BQU8sT0FBTyxDQUFDLEdBQUcsa0JBQWtCLE1BQU0sS0FBSyxTQUFTLENBQUM7QUFBQSxFQUMxRTtBQUFBLEVBRUEsTUFBTSxlQUE4QjtBQUNuQyxVQUFNLEtBQUssU0FBUyxLQUFLLFFBQVE7QUFBQSxFQUNsQztBQUFBLEVBRUEsV0FBaUI7QUFBQSxFQUFDO0FBQ25COyIsCiAgIm5hbWVzIjogWyJlIiwgInN0YXRlIiwgImlucHV0IiwgIm1lc3NhZ2VzIiwgIl9hIl0KfQo=
