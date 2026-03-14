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
    // Active context menu (prevent overlapping menus)
    this.activeMenu = null;
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
  showMenu(menu, e) {
    var _a;
    (_a = this.activeMenu) == null ? void 0 : _a.close();
    this.activeMenu = menu;
    menu.showAtMouseEvent(e);
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
    this.showMenu(menu, e);
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
    this.showMenu(menu, e);
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
    this.showMenu(menu, e);
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
    this.showMenu(menu, e);
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
    this.showMenu(menu, e);
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
