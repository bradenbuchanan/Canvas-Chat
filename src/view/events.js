var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Notice, TFile, TFolder } from "obsidian";
import { renderChatContent } from "./rendering";
export function setupEventListeners(view) {
    view.canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
            const delta = -e.deltaY * 0.01;
            view.zoomAtPoint(delta, e.clientX, e.clientY);
        }
        else {
            const newPanX = view.panX - e.deltaX;
            const newPanY = view.panY - e.deltaY;
            const clamped = view.clampPan(newPanX, newPanY);
            view.panX = clamped.x;
            view.panY = clamped.y;
            view.updateTransform();
            view.triggerSave();
        }
    });
    view.canvas.addEventListener("mousedown", (e) => {
        if (e.button === 1 || (e.button === 0 && view.spacePressed)) {
            e.preventDefault();
            view.isPanning = true;
            view.panStartX = e.clientX - view.panX;
            view.panStartY = e.clientY - view.panY;
            view.canvas.addClass("panning");
        }
        else if (e.button === 0 && e.target === view.canvas) {
            e.preventDefault();
            view.isSelecting = true;
            const rect = view.canvas.getBoundingClientRect();
            view.selectionStartX = e.clientX - rect.left;
            view.selectionStartY = e.clientY - rect.top;
            if (view.selectionBox) {
                view.selectionBox.setCssStyles({
                    left: `${view.selectionStartX}px`,
                    top: `${view.selectionStartY}px`,
                    width: "0px",
                    height: "0px",
                });
                view.selectionBox.addClass("is-active");
            }
            if (!e.shiftKey) {
                view.clearSelection();
            }
        }
    });
    document.addEventListener("mousemove", (e) => {
        if (view.isPanning) {
            const newPanX = e.clientX - view.panStartX;
            const newPanY = e.clientY - view.panStartY;
            const clamped = view.clampPan(newPanX, newPanY);
            view.panX = clamped.x;
            view.panY = clamped.y;
            view.updateTransform();
        }
        else if (view.isSelecting && view.selectionBox) {
            const rect = view.canvas.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;
            const left = Math.min(view.selectionStartX, currentX);
            const top = Math.min(view.selectionStartY, currentY);
            const width = Math.abs(currentX - view.selectionStartX);
            const height = Math.abs(currentY - view.selectionStartY);
            view.selectionBox.setCssStyles({
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`,
            });
            view.updateSelectionFromBox(left, top, width, height);
        }
        else if (view.isDrawingEdge && view.edgeDrawTempLine) {
            const rect = view.canvas.getBoundingClientRect();
            const canvasX = (e.clientX - rect.left - view.panX) / view.scale;
            const canvasY = (e.clientY - rect.top - view.panY) / view.scale;
            view.edgeDrawTempLine.setAttribute("x2", String(canvasX));
            view.edgeDrawTempLine.setAttribute("y2", String(canvasY));
        }
        else if (view.draggedNode) {
            const rect = view.canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - view.panX) / view.scale;
            const mouseY = (e.clientY - rect.top - view.panY) / view.scale;
            if (view.selectedNodes.has(view.draggedNode) && view.selectedNodes.size > 0) {
                const deltaX = mouseX - view.dragStartMouseX;
                const deltaY = mouseY - view.dragStartMouseY;
                for (const nodeId of view.selectedNodes) {
                    const startPos = view.dragStartPositions.get(nodeId);
                    if (startPos) {
                        view.updateNodePosition(nodeId, startPos.x + deltaX, startPos.y + deltaY);
                    }
                }
            }
            else {
                const x = mouseX - view.dragOffsetX;
                const y = mouseY - view.dragOffsetY;
                view.updateNodePosition(view.draggedNode, x, y);
            }
            const draggedNodeData = view.nodes.get(view.draggedNode);
            if (draggedNodeData && draggedNodeData.type !== "chat") {
                const dragCenterX = draggedNodeData.x + draggedNodeData.width / 2;
                const dragCenterY = draggedNodeData.y + draggedNodeData.height / 2;
                for (const [id, n] of view.nodes) {
                    const el = view.nodeElements.get(id);
                    if (!el || n.type !== "chat" || id === view.draggedNode)
                        continue;
                    const inside = dragCenterX >= n.x && dragCenterX <= n.x + n.width &&
                        dragCenterY >= n.y && dragCenterY <= n.y + n.height;
                    el.toggleClass("rabbitmap-drop-target", inside);
                }
            }
        }
        else if (view.resizingNode) {
            const deltaX = (e.clientX - view.resizeStartX) / view.scale;
            const deltaY = (e.clientY - view.resizeStartY) / view.scale;
            const newWidth = Math.max(200, view.resizeStartWidth + deltaX);
            const newHeight = Math.max(150, view.resizeStartHeight + deltaY);
            view.updateNodeSize(view.resizingNode, newWidth, newHeight);
        }
    });
    document.addEventListener("mouseup", (e) => {
        if (view.isDrawingEdge) {
            const targetInfo = view.findTargetHandle(e);
            if (targetInfo && targetInfo.nodeId !== view.edgeDrawFromNode) {
                const duplicate = Array.from(view.edges.values()).some((edge) => (edge.from === view.edgeDrawFromNode && edge.to === targetInfo.nodeId) ||
                    (edge.from === targetInfo.nodeId && edge.to === view.edgeDrawFromNode));
                if (!duplicate) {
                    view.addEdge(view.edgeDrawFromNode, targetInfo.nodeId);
                    view.triggerSave();
                }
            }
            if (view.edgeDrawTempLine) {
                view.edgeDrawTempLine.remove();
                view.edgeDrawTempLine = null;
            }
            view.isDrawingEdge = false;
            view.edgeDrawFromNode = null;
            view.edgeDrawFromSide = null;
            view.canvas.removeClass("drawing-edge");
            return;
        }
        if (view.isPanning || view.draggedNode || view.resizingNode) {
            view.triggerSave();
        }
        if (view.draggedNode) {
            const draggedNodeData = view.nodes.get(view.draggedNode);
            if (draggedNodeData && draggedNodeData.type !== "chat") {
                const dragCenterX = draggedNodeData.x + draggedNodeData.width / 2;
                const dragCenterY = draggedNodeData.y + draggedNodeData.height / 2;
                for (const [id, n] of view.nodes) {
                    if (n.type !== "chat" || id === view.draggedNode)
                        continue;
                    const inside = dragCenterX >= n.x && dragCenterX <= n.x + n.width &&
                        dragCenterY >= n.y && dragCenterY <= n.y + n.height;
                    if (inside) {
                        const chatState = view.chatStates.get(id);
                        if (chatState) {
                            if (!chatState.contextNodes)
                                chatState.contextNodes = [];
                            if (!chatState.contextNodes.includes(view.draggedNode)) {
                                chatState.contextNodes.push(view.draggedNode);
                                view.chatStates.set(id, chatState);
                                const hasEdge = Array.from(view.edges.values()).some(edge => (edge.from === id && edge.to === view.draggedNode) ||
                                    (edge.from === view.draggedNode && edge.to === id));
                                if (!hasEdge) {
                                    view.addEdge(id, view.draggedNode);
                                }
                                const nodeEl = view.nodeElements.get(id);
                                if (nodeEl) {
                                    const content = nodeEl.querySelector(".rabbitmap-node-content");
                                    if (content) {
                                        content.empty();
                                        renderChatContent(view, id, content);
                                    }
                                }
                                new Notice("Added to chat context");
                                view.triggerSave();
                            }
                        }
                        break;
                    }
                }
            }
            for (const el of view.nodeElements.values()) {
                el.removeClass("rabbitmap-drop-target");
            }
        }
        view.isPanning = false;
        view.draggedNode = null;
        view.dragStartPositions.clear();
        view.resizingNode = null;
        view.canvas.removeClass("panning");
        if (view.isSelecting && view.selectionBox) {
            view.isSelecting = false;
            view.selectionBox.removeClass("is-active");
        }
    });
    document.addEventListener("keydown", (e) => {
        if (e.code === "Space" && !view.isInputFocused()) {
            e.preventDefault();
            view.spacePressed = true;
            view.canvas.addClass("pan-mode");
        }
        if ((e.code === "Delete" || e.code === "Backspace") && !view.isInputFocused() && view.selectedNodes.size > 0) {
            e.preventDefault();
            view.deleteSelectedNodes();
        }
        if (e.code === "Escape" && view.selectedNodes.size > 0) {
            view.clearSelection();
        }
    });
    document.addEventListener("keyup", (e) => {
        if (e.code === "Space") {
            view.spacePressed = false;
            view.canvas.removeClass("pan-mode");
        }
    });
    view.canvas.addEventListener("paste", (e) => {
        var _a, _b;
        if (view.isInputFocused())
            return;
        const text = (_b = (_a = e.clipboardData) === null || _a === void 0 ? void 0 : _a.getData("text/plain")) === null || _b === void 0 ? void 0 : _b.trim();
        if (text && /^https?:\/\//i.test(text)) {
            e.preventDefault();
            view.addLinkAtCenter(text);
        }
    });
    view.canvas.addEventListener("dragover", (e) => {
        e.preventDefault();
        view.canvas.addClass("rabbitmap-canvas-drag-over");
    });
    view.canvas.addEventListener("dragleave", (e) => {
        e.preventDefault();
        view.canvas.removeClass("rabbitmap-canvas-drag-over");
    });
    view.canvas.addEventListener("drop", (e) => {
        e.preventDefault();
        view.canvas.removeClass("rabbitmap-canvas-drag-over");
        void (() => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const plainText = ((_a = e.dataTransfer) === null || _a === void 0 ? void 0 : _a.getData("text/plain")) || "";
            if (!plainText)
                return;
            const canvasRect = view.canvas.getBoundingClientRect();
            const dropX = (e.clientX - canvasRect.left - view.panX) / view.scale;
            const dropY = (e.clientY - canvasRect.top - view.panY) / view.scale;
            const lines = plainText.split("\n").map(l => l.trim()).filter(l => l);
            let offsetIndex = 0;
            for (const line of lines) {
                const path = view.parsePath(line);
                if (!path)
                    continue;
                if (path.startsWith("http")) {
                    view.addLinkNode(path, dropX - 150 + offsetIndex * 30, dropY - 100 + offsetIndex * 30);
                    offsetIndex++;
                    continue;
                }
                const item = view.resolveVaultItem(path);
                if (item instanceof TFolder) {
                    const mdFiles = view.getMdFilesFromFolder(item);
                    for (const file of mdFiles) {
                        try {
                            const content = yield view.app.vault.read(file);
                            view.addNoteNode(file.path, content, dropX + offsetIndex * 30, dropY + offsetIndex * 30);
                            offsetIndex++;
                        }
                        catch ( /* noop */_b) { /* noop */ }
                    }
                }
                else if (item instanceof TFile && item.extension === "md") {
                    try {
                        const content = yield view.app.vault.read(item);
                        view.addNoteNode(item.path, content, dropX + offsetIndex * 30, dropY + offsetIndex * 30);
                        offsetIndex++;
                    }
                    catch ( /* noop */_c) { /* noop */ }
                }
            }
        }))();
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZXZlbnRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLE9BQU8sRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUVsRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFFaEQsTUFBTSxVQUFVLG1CQUFtQixDQUFDLElBQW9CO0lBQ3ZELElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUU7UUFDM0MsQ0FBQyxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBRW5CLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDNUIsTUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztZQUMvQixJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUMvQyxDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQztZQUNyQyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUM7WUFFckMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDaEQsSUFBSSxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ3RCLElBQUksQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUN0QixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDdkIsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ3BC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RSxLQUFLLEdBQUcsV0FBVyxHQUFHLEVBQUUsRUFBRSxLQUFLLEdBQUcsV0FBVyxHQUFHLEVBQUUsQ0FBQyxDQUFDOzRCQUN6RixXQUFXLEVBQUUsQ0FBQzt3QkFDZixDQUFDO3dCQUFDLFFBQVEsVUFBVSxJQUFaLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDdkIsQ0FBQztnQkFDRixDQUFDO3FCQUFNLElBQUksSUFBSSxZQUFZLEtBQUssSUFBSSxJQUFJLENBQUMsU0FBUyxLQUFLLElBQUksRUFBRSxDQUFDO29CQUM3RCxJQUFJLENBQUM7d0JBQ0osTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7d0JBQ2hELElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxHQUFHLFdBQVcsR0FBRyxFQUFFLEVBQUUsS0FBSyxHQUFHLFdBQVcsR0FBRyxFQUFFLENBQUMsQ0FBQzt3QkFDekYsV0FBVyxFQUFFLENBQUM7b0JBQ2YsQ0FBQztvQkFBQyxRQUFRLFVBQVUsSUFBWixDQUFDLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQ3ZCLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQyxDQUFBLENBQUMsRUFBRSxDQUFDO0lBQ04sQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTm90aWNlLCBURmlsZSwgVEZvbGRlciB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgeyBDYW52YXNDaGF0VmlldyB9IGZyb20gXCIuLi9tYWluXCI7XG5pbXBvcnQgeyByZW5kZXJDaGF0Q29udGVudCB9IGZyb20gXCIuL3JlbmRlcmluZ1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBFdmVudExpc3RlbmVycyh2aWV3OiBDYW52YXNDaGF0Vmlldyk6IHZvaWQge1xuXHR2aWV3LmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKFwid2hlZWxcIiwgKGUpID0+IHtcblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRpZiAoZS5jdHJsS2V5IHx8IGUubWV0YUtleSkge1xuXHRcdFx0Y29uc3QgZGVsdGEgPSAtZS5kZWx0YVkgKiAwLjAxO1xuXHRcdFx0dmlldy56b29tQXRQb2ludChkZWx0YSwgZS5jbGllbnRYLCBlLmNsaWVudFkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBuZXdQYW5YID0gdmlldy5wYW5YIC0gZS5kZWx0YVg7XG5cdFx0XHRjb25zdCBuZXdQYW5ZID0gdmlldy5wYW5ZIC0gZS5kZWx0YVk7XG5cblx0XHRcdGNvbnN0IGNsYW1wZWQgPSB2aWV3LmNsYW1wUGFuKG5ld1BhblgsIG5ld1BhblkpO1xuXHRcdFx0dmlldy5wYW5YID0gY2xhbXBlZC54O1xuXHRcdFx0dmlldy5wYW5ZID0gY2xhbXBlZC55O1xuXHRcdFx0dmlldy51cGRhdGVUcmFuc2Zvcm0oKTtcblx0XHRcdHZpZXcudHJpZ2dlclNhdmUoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHZpZXcuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgKGUpID0+IHtcblx0XHRpZiAoZS5idXR0b24gPT09IDEgfHwgKGUuYnV0dG9uID09PSAwICYmIHZpZXcuc3BhY2VQcmVzc2VkKSkge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dmlldy5pc1Bhbm5pbmcgPSB0cnVlO1xuXHRcdFx0dmlldy5wYW5TdGFydFggPSBlLmNsaWVudFggLSB2aWV3LnBhblg7XG5cdFx0XHR2aWV3LnBhblN0YXJ0WSA9IGUuY2xpZW50WSAtIHZpZXcucGFuWTtcblx0XHRcdHZpZXcuY2FudmFzLmFkZENsYXNzKFwicGFubmluZ1wiKTtcblx0XHR9IGVsc2UgaWYgKGUuYnV0dG9uID09PSAwICYmIGUudGFyZ2V0ID09PSB2aWV3LmNhbnZhcykge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dmlldy5pc1NlbGVjdGluZyA9IHRydWU7XG5cdFx0XHRjb25zdCByZWN0ID0gdmlldy5jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHR2aWV3LnNlbGVjdGlvblN0YXJ0WCA9IGUuY2xpZW50WCAtIHJlY3QubGVmdDtcblx0XHRcdHZpZXcuc2VsZWN0aW9uU3RhcnRZID0gZS5jbGllbnRZIC0gcmVjdC50b3A7XG5cblx0XHRcdGlmICh2aWV3LnNlbGVjdGlvbkJveCkge1xuXHRcdFx0XHR2aWV3LnNlbGVjdGlvbkJveC5zZXRDc3NTdHlsZXMoe1xuXHRcdFx0XHRcdGxlZnQ6IGAke3ZpZXcuc2VsZWN0aW9uU3RhcnRYfXB4YCxcblx0XHRcdFx0XHR0b3A6IGAke3ZpZXcuc2VsZWN0aW9uU3RhcnRZfXB4YCxcblx0XHRcdFx0XHR3aWR0aDogXCIwcHhcIixcblx0XHRcdFx0XHRoZWlnaHQ6IFwiMHB4XCIsXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR2aWV3LnNlbGVjdGlvbkJveC5hZGRDbGFzcyhcImlzLWFjdGl2ZVwiKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFlLnNoaWZ0S2V5KSB7XG5cdFx0XHRcdHZpZXcuY2xlYXJTZWxlY3Rpb24oKTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIiwgKGUpID0+IHtcblx0XHRpZiAodmlldy5pc1Bhbm5pbmcpIHtcblx0XHRcdGNvbnN0IG5ld1BhblggPSBlLmNsaWVudFggLSB2aWV3LnBhblN0YXJ0WDtcblx0XHRcdGNvbnN0IG5ld1BhblkgPSBlLmNsaWVudFkgLSB2aWV3LnBhblN0YXJ0WTtcblxuXHRcdFx0Y29uc3QgY2xhbXBlZCA9IHZpZXcuY2xhbXBQYW4obmV3UGFuWCwgbmV3UGFuWSk7XG5cdFx0XHR2aWV3LnBhblggPSBjbGFtcGVkLng7XG5cdFx0XHR2aWV3LnBhblkgPSBjbGFtcGVkLnk7XG5cdFx0XHR2aWV3LnVwZGF0ZVRyYW5zZm9ybSgpO1xuXHRcdH0gZWxzZSBpZiAodmlldy5pc1NlbGVjdGluZyAmJiB2aWV3LnNlbGVjdGlvbkJveCkge1xuXHRcdFx0Y29uc3QgcmVjdCA9IHZpZXcuY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0Y29uc3QgY3VycmVudFggPSBlLmNsaWVudFggLSByZWN0LmxlZnQ7XG5cdFx0XHRjb25zdCBjdXJyZW50WSA9IGUuY2xpZW50WSAtIHJlY3QudG9wO1xuXG5cdFx0XHRjb25zdCBsZWZ0ID0gTWF0aC5taW4odmlldy5zZWxlY3Rpb25TdGFydFgsIGN1cnJlbnRYKTtcblx0XHRcdGNvbnN0IHRvcCA9IE1hdGgubWluKHZpZXcuc2VsZWN0aW9uU3RhcnRZLCBjdXJyZW50WSk7XG5cdFx0XHRjb25zdCB3aWR0aCA9IE1hdGguYWJzKGN1cnJlbnRYIC0gdmlldy5zZWxlY3Rpb25TdGFydFgpO1xuXHRcdFx0Y29uc3QgaGVpZ2h0ID0gTWF0aC5hYnMoY3VycmVudFkgLSB2aWV3LnNlbGVjdGlvblN0YXJ0WSk7XG5cblx0XHRcdHZpZXcuc2VsZWN0aW9uQm94LnNldENzc1N0eWxlcyh7XG5cdFx0XHRcdGxlZnQ6IGAke2xlZnR9cHhgLFxuXHRcdFx0XHR0b3A6IGAke3RvcH1weGAsXG5cdFx0XHRcdHdpZHRoOiBgJHt3aWR0aH1weGAsXG5cdFx0XHRcdGhlaWdodDogYCR7aGVpZ2h0fXB4YCxcblx0XHRcdH0pO1xuXG5cdFx0XHR2aWV3LnVwZGF0ZVNlbGVjdGlvbkZyb21Cb3gobGVmdCwgdG9wLCB3aWR0aCwgaGVpZ2h0KTtcblx0XHR9IGVsc2UgaWYgKHZpZXcuaXNEcmF3aW5nRWRnZSAmJiB2aWV3LmVkZ2VEcmF3VGVtcExpbmUpIHtcblx0XHRcdGNvbnN0IHJlY3QgPSB2aWV3LmNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdGNvbnN0IGNhbnZhc1ggPSAoZS5jbGllbnRYIC0gcmVjdC5sZWZ0IC0gdmlldy5wYW5YKSAvIHZpZXcuc2NhbGU7XG5cdFx0XHRjb25zdCBjYW52YXNZID0gKGUuY2xpZW50WSAtIHJlY3QudG9wIC0gdmlldy5wYW5ZKSAvIHZpZXcuc2NhbGU7XG5cdFx0XHR2aWV3LmVkZ2VEcmF3VGVtcExpbmUuc2V0QXR0cmlidXRlKFwieDJcIiwgU3RyaW5nKGNhbnZhc1gpKTtcblx0XHRcdHZpZXcuZWRnZURyYXdUZW1wTGluZS5zZXRBdHRyaWJ1dGUoXCJ5MlwiLCBTdHJpbmcoY2FudmFzWSkpO1xuXHRcdH0gZWxzZSBpZiAodmlldy5kcmFnZ2VkTm9kZSkge1xuXHRcdFx0Y29uc3QgcmVjdCA9IHZpZXcuY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0Y29uc3QgbW91c2VYID0gKGUuY2xpZW50WCAtIHJlY3QubGVmdCAtIHZpZXcucGFuWCkgLyB2aWV3LnNjYWxlO1xuXHRcdFx0Y29uc3QgbW91c2VZID0gKGUuY2xpZW50WSAtIHJlY3QudG9wIC0gdmlldy5wYW5ZKSAvIHZpZXcuc2NhbGU7XG5cblx0XHRcdGlmICh2aWV3LnNlbGVjdGVkTm9kZXMuaGFzKHZpZXcuZHJhZ2dlZE5vZGUpICYmIHZpZXcuc2VsZWN0ZWROb2Rlcy5zaXplID4gMCkge1xuXHRcdFx0XHRjb25zdCBkZWx0YVggPSBtb3VzZVggLSB2aWV3LmRyYWdTdGFydE1vdXNlWDtcblx0XHRcdFx0Y29uc3QgZGVsdGFZID0gbW91c2VZIC0gdmlldy5kcmFnU3RhcnRNb3VzZVk7XG5cblx0XHRcdFx0Zm9yIChjb25zdCBub2RlSWQgb2Ygdmlldy5zZWxlY3RlZE5vZGVzKSB7XG5cdFx0XHRcdFx0Y29uc3Qgc3RhcnRQb3MgPSB2aWV3LmRyYWdTdGFydFBvc2l0aW9ucy5nZXQobm9kZUlkKTtcblx0XHRcdFx0XHRpZiAoc3RhcnRQb3MpIHtcblx0XHRcdFx0XHRcdHZpZXcudXBkYXRlTm9kZVBvc2l0aW9uKG5vZGVJZCwgc3RhcnRQb3MueCArIGRlbHRhWCwgc3RhcnRQb3MueSArIGRlbHRhWSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCB4ID0gbW91c2VYIC0gdmlldy5kcmFnT2Zmc2V0WDtcblx0XHRcdFx0Y29uc3QgeSA9IG1vdXNlWSAtIHZpZXcuZHJhZ09mZnNldFk7XG5cdFx0XHRcdHZpZXcudXBkYXRlTm9kZVBvc2l0aW9uKHZpZXcuZHJhZ2dlZE5vZGUsIHgsIHkpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBkcmFnZ2VkTm9kZURhdGEgPSB2aWV3Lm5vZGVzLmdldCh2aWV3LmRyYWdnZWROb2RlKTtcblx0XHRcdGlmIChkcmFnZ2VkTm9kZURhdGEgJiYgZHJhZ2dlZE5vZGVEYXRhLnR5cGUgIT09IFwiY2hhdFwiKSB7XG5cdFx0XHRcdGNvbnN0IGRyYWdDZW50ZXJYID0gZHJhZ2dlZE5vZGVEYXRhLnggKyBkcmFnZ2VkTm9kZURhdGEud2lkdGggLyAyO1xuXHRcdFx0XHRjb25zdCBkcmFnQ2VudGVyWSA9IGRyYWdnZWROb2RlRGF0YS55ICsgZHJhZ2dlZE5vZGVEYXRhLmhlaWdodCAvIDI7XG5cdFx0XHRcdGZvciAoY29uc3QgW2lkLCBuXSBvZiB2aWV3Lm5vZGVzKSB7XG5cdFx0XHRcdFx0Y29uc3QgZWwgPSB2aWV3Lm5vZGVFbGVtZW50cy5nZXQoaWQpO1xuXHRcdFx0XHRcdGlmICghZWwgfHwgbi50eXBlICE9PSBcImNoYXRcIiB8fCBpZCA9PT0gdmlldy5kcmFnZ2VkTm9kZSkgY29udGludWU7XG5cdFx0XHRcdFx0Y29uc3QgaW5zaWRlID0gZHJhZ0NlbnRlclggPj0gbi54ICYmIGRyYWdDZW50ZXJYIDw9IG4ueCArIG4ud2lkdGggJiZcblx0XHRcdFx0XHRcdGRyYWdDZW50ZXJZID49IG4ueSAmJiBkcmFnQ2VudGVyWSA8PSBuLnkgKyBuLmhlaWdodDtcblx0XHRcdFx0XHRlbC50b2dnbGVDbGFzcyhcInJhYmJpdG1hcC1kcm9wLXRhcmdldFwiLCBpbnNpZGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICh2aWV3LnJlc2l6aW5nTm9kZSkge1xuXHRcdFx0Y29uc3QgZGVsdGFYID0gKGUuY2xpZW50WCAtIHZpZXcucmVzaXplU3RhcnRYKSAvIHZpZXcuc2NhbGU7XG5cdFx0XHRjb25zdCBkZWx0YVkgPSAoZS5jbGllbnRZIC0gdmlldy5yZXNpemVTdGFydFkpIC8gdmlldy5zY2FsZTtcblx0XHRcdGNvbnN0IG5ld1dpZHRoID0gTWF0aC5tYXgoMjAwLCB2aWV3LnJlc2l6ZVN0YXJ0V2lkdGggKyBkZWx0YVgpO1xuXHRcdFx0Y29uc3QgbmV3SGVpZ2h0ID0gTWF0aC5tYXgoMTUwLCB2aWV3LnJlc2l6ZVN0YXJ0SGVpZ2h0ICsgZGVsdGFZKTtcblx0XHRcdHZpZXcudXBkYXRlTm9kZVNpemUodmlldy5yZXNpemluZ05vZGUsIG5ld1dpZHRoLCBuZXdIZWlnaHQpO1xuXHRcdH1cblx0fSk7XG5cblx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNldXBcIiwgKGUpID0+IHtcblx0XHRpZiAodmlldy5pc0RyYXdpbmdFZGdlKSB7XG5cdFx0XHRjb25zdCB0YXJnZXRJbmZvID0gdmlldy5maW5kVGFyZ2V0SGFuZGxlKGUpO1xuXHRcdFx0aWYgKHRhcmdldEluZm8gJiYgdGFyZ2V0SW5mby5ub2RlSWQgIT09IHZpZXcuZWRnZURyYXdGcm9tTm9kZSkge1xuXHRcdFx0XHRjb25zdCBkdXBsaWNhdGUgPSBBcnJheS5mcm9tKHZpZXcuZWRnZXMudmFsdWVzKCkpLnNvbWUoXG5cdFx0XHRcdFx0KGVkZ2UpID0+XG5cdFx0XHRcdFx0XHQoZWRnZS5mcm9tID09PSB2aWV3LmVkZ2VEcmF3RnJvbU5vZGUgJiYgZWRnZS50byA9PT0gdGFyZ2V0SW5mby5ub2RlSWQpIHx8XG5cdFx0XHRcdFx0XHQoZWRnZS5mcm9tID09PSB0YXJnZXRJbmZvLm5vZGVJZCAmJiBlZGdlLnRvID09PSB2aWV3LmVkZ2VEcmF3RnJvbU5vZGUpXG5cdFx0XHRcdCk7XG5cdFx0XHRcdGlmICghZHVwbGljYXRlKSB7XG5cdFx0XHRcdFx0dmlldy5hZGRFZGdlKHZpZXcuZWRnZURyYXdGcm9tTm9kZSEsIHRhcmdldEluZm8ubm9kZUlkKTtcblx0XHRcdFx0XHR2aWV3LnRyaWdnZXJTYXZlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICh2aWV3LmVkZ2VEcmF3VGVtcExpbmUpIHtcblx0XHRcdFx0dmlldy5lZGdlRHJhd1RlbXBMaW5lLnJlbW92ZSgpO1xuXHRcdFx0XHR2aWV3LmVkZ2VEcmF3VGVtcExpbmUgPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0dmlldy5pc0RyYXdpbmdFZGdlID0gZmFsc2U7XG5cdFx0XHR2aWV3LmVkZ2VEcmF3RnJvbU5vZGUgPSBudWxsO1xuXHRcdFx0dmlldy5lZGdlRHJhd0Zyb21TaWRlID0gbnVsbDtcblx0XHRcdHZpZXcuY2FudmFzLnJlbW92ZUNsYXNzKFwiZHJhd2luZy1lZGdlXCIpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh2aWV3LmlzUGFubmluZyB8fCB2aWV3LmRyYWdnZWROb2RlIHx8IHZpZXcucmVzaXppbmdOb2RlKSB7XG5cdFx0XHR2aWV3LnRyaWdnZXJTYXZlKCk7XG5cdFx0fVxuXG5cdFx0aWYgKHZpZXcuZHJhZ2dlZE5vZGUpIHtcblx0XHRcdGNvbnN0IGRyYWdnZWROb2RlRGF0YSA9IHZpZXcubm9kZXMuZ2V0KHZpZXcuZHJhZ2dlZE5vZGUpO1xuXHRcdFx0aWYgKGRyYWdnZWROb2RlRGF0YSAmJiBkcmFnZ2VkTm9kZURhdGEudHlwZSAhPT0gXCJjaGF0XCIpIHtcblx0XHRcdFx0Y29uc3QgZHJhZ0NlbnRlclggPSBkcmFnZ2VkTm9kZURhdGEueCArIGRyYWdnZWROb2RlRGF0YS53aWR0aCAvIDI7XG5cdFx0XHRcdGNvbnN0IGRyYWdDZW50ZXJZID0gZHJhZ2dlZE5vZGVEYXRhLnkgKyBkcmFnZ2VkTm9kZURhdGEuaGVpZ2h0IC8gMjtcblx0XHRcdFx0Zm9yIChjb25zdCBbaWQsIG5dIG9mIHZpZXcubm9kZXMpIHtcblx0XHRcdFx0XHRpZiAobi50eXBlICE9PSBcImNoYXRcIiB8fCBpZCA9PT0gdmlldy5kcmFnZ2VkTm9kZSkgY29udGludWU7XG5cdFx0XHRcdFx0Y29uc3QgaW5zaWRlID0gZHJhZ0NlbnRlclggPj0gbi54ICYmIGRyYWdDZW50ZXJYIDw9IG4ueCArIG4ud2lkdGggJiZcblx0XHRcdFx0XHRcdGRyYWdDZW50ZXJZID49IG4ueSAmJiBkcmFnQ2VudGVyWSA8PSBuLnkgKyBuLmhlaWdodDtcblx0XHRcdFx0XHRpZiAoaW5zaWRlKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBjaGF0U3RhdGUgPSB2aWV3LmNoYXRTdGF0ZXMuZ2V0KGlkKTtcblx0XHRcdFx0XHRcdGlmIChjaGF0U3RhdGUpIHtcblx0XHRcdFx0XHRcdFx0aWYgKCFjaGF0U3RhdGUuY29udGV4dE5vZGVzKSBjaGF0U3RhdGUuY29udGV4dE5vZGVzID0gW107XG5cdFx0XHRcdFx0XHRcdGlmICghY2hhdFN0YXRlLmNvbnRleHROb2Rlcy5pbmNsdWRlcyh2aWV3LmRyYWdnZWROb2RlKSkge1xuXHRcdFx0XHRcdFx0XHRcdGNoYXRTdGF0ZS5jb250ZXh0Tm9kZXMucHVzaCh2aWV3LmRyYWdnZWROb2RlKTtcblx0XHRcdFx0XHRcdFx0XHR2aWV3LmNoYXRTdGF0ZXMuc2V0KGlkLCBjaGF0U3RhdGUpO1xuXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgaGFzRWRnZSA9IEFycmF5LmZyb20odmlldy5lZGdlcy52YWx1ZXMoKSkuc29tZShcblx0XHRcdFx0XHRcdFx0XHRcdGVkZ2UgPT4gKGVkZ2UuZnJvbSA9PT0gaWQgJiYgZWRnZS50byA9PT0gdmlldy5kcmFnZ2VkTm9kZSkgfHxcblx0XHRcdFx0XHRcdFx0XHRcdFx0KGVkZ2UuZnJvbSA9PT0gdmlldy5kcmFnZ2VkTm9kZSAmJiBlZGdlLnRvID09PSBpZClcblx0XHRcdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdFx0XHRcdGlmICghaGFzRWRnZSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dmlldy5hZGRFZGdlKGlkLCB2aWV3LmRyYWdnZWROb2RlKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0XHRjb25zdCBub2RlRWwgPSB2aWV3Lm5vZGVFbGVtZW50cy5nZXQoaWQpO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChub2RlRWwpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IGNvbnRlbnQgPSBub2RlRWwucXVlcnlTZWxlY3RvcihcIi5yYWJiaXRtYXAtbm9kZS1jb250ZW50XCIpO1xuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKGNvbnRlbnQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudC5lbXB0eSgpO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZW5kZXJDaGF0Q29udGVudCh2aWV3LCBpZCwgY29udGVudCBhcyBIVE1MRWxlbWVudCk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdFx0bmV3IE5vdGljZShcIkFkZGVkIHRvIGNoYXQgY29udGV4dFwiKTtcblx0XHRcdFx0XHRcdFx0XHR2aWV3LnRyaWdnZXJTYXZlKCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGNvbnN0IGVsIG9mIHZpZXcubm9kZUVsZW1lbnRzLnZhbHVlcygpKSB7XG5cdFx0XHRcdGVsLnJlbW92ZUNsYXNzKFwicmFiYml0bWFwLWRyb3AtdGFyZ2V0XCIpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHZpZXcuaXNQYW5uaW5nID0gZmFsc2U7XG5cdFx0dmlldy5kcmFnZ2VkTm9kZSA9IG51bGw7XG5cdFx0dmlldy5kcmFnU3RhcnRQb3NpdGlvbnMuY2xlYXIoKTtcblx0XHR2aWV3LnJlc2l6aW5nTm9kZSA9IG51bGw7XG5cdFx0dmlldy5jYW52YXMucmVtb3ZlQ2xhc3MoXCJwYW5uaW5nXCIpO1xuXG5cdFx0aWYgKHZpZXcuaXNTZWxlY3RpbmcgJiYgdmlldy5zZWxlY3Rpb25Cb3gpIHtcblx0XHRcdHZpZXcuaXNTZWxlY3RpbmcgPSBmYWxzZTtcblx0XHRcdHZpZXcuc2VsZWN0aW9uQm94LnJlbW92ZUNsYXNzKFwiaXMtYWN0aXZlXCIpO1xuXHRcdH1cblx0fSk7XG5cblx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGUpID0+IHtcblx0XHRpZiAoZS5jb2RlID09PSBcIlNwYWNlXCIgJiYgIXZpZXcuaXNJbnB1dEZvY3VzZWQoKSkge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dmlldy5zcGFjZVByZXNzZWQgPSB0cnVlO1xuXHRcdFx0dmlldy5jYW52YXMuYWRkQ2xhc3MoXCJwYW4tbW9kZVwiKTtcblx0XHR9XG5cdFx0aWYgKChlLmNvZGUgPT09IFwiRGVsZXRlXCIgfHwgZS5jb2RlID09PSBcIkJhY2tzcGFjZVwiKSAmJiAhdmlldy5pc0lucHV0Rm9jdXNlZCgpICYmIHZpZXcuc2VsZWN0ZWROb2Rlcy5zaXplID4gMCkge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dmlldy5kZWxldGVTZWxlY3RlZE5vZGVzKCk7XG5cdFx0fVxuXHRcdGlmIChlLmNvZGUgPT09IFwiRXNjYXBlXCIgJiYgdmlldy5zZWxlY3RlZE5vZGVzLnNpemUgPiAwKSB7XG5cdFx0XHR2aWV3LmNsZWFyU2VsZWN0aW9uKCk7XG5cdFx0fVxuXHR9KTtcblxuXHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwia2V5dXBcIiwgKGUpID0+IHtcblx0XHRpZiAoZS5jb2RlID09PSBcIlNwYWNlXCIpIHtcblx0XHRcdHZpZXcuc3BhY2VQcmVzc2VkID0gZmFsc2U7XG5cdFx0XHR2aWV3LmNhbnZhcy5yZW1vdmVDbGFzcyhcInBhbi1tb2RlXCIpO1xuXHRcdH1cblx0fSk7XG5cblx0dmlldy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcihcInBhc3RlXCIsIChlKSA9PiB7XG5cdFx0aWYgKHZpZXcuaXNJbnB1dEZvY3VzZWQoKSkgcmV0dXJuO1xuXHRcdGNvbnN0IHRleHQgPSBlLmNsaXBib2FyZERhdGE/LmdldERhdGEoXCJ0ZXh0L3BsYWluXCIpPy50cmltKCk7XG5cdFx0aWYgKHRleHQgJiYgL15odHRwcz86XFwvXFwvL2kudGVzdCh0ZXh0KSkge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dmlldy5hZGRMaW5rQXRDZW50ZXIodGV4dCk7XG5cdFx0fVxuXHR9KTtcblxuXHR2aWV3LmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ292ZXJcIiwgKGUpID0+IHtcblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0dmlldy5jYW52YXMuYWRkQ2xhc3MoXCJyYWJiaXRtYXAtY2FudmFzLWRyYWctb3ZlclwiKTtcblx0fSk7XG5cblx0dmlldy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdsZWF2ZVwiLCAoZSkgPT4ge1xuXHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHR2aWV3LmNhbnZhcy5yZW1vdmVDbGFzcyhcInJhYmJpdG1hcC1jYW52YXMtZHJhZy1vdmVyXCIpO1xuXHR9KTtcblxuXHR2aWV3LmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKFwiZHJvcFwiLCAoZSkgPT4ge1xuXHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHR2aWV3LmNhbnZhcy5yZW1vdmVDbGFzcyhcInJhYmJpdG1hcC1jYW52YXMtZHJhZy1vdmVyXCIpO1xuXG5cdFx0dm9pZCAoYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcGxhaW5UZXh0ID0gZS5kYXRhVHJhbnNmZXI/LmdldERhdGEoXCJ0ZXh0L3BsYWluXCIpIHx8IFwiXCI7XG5cdFx0XHRpZiAoIXBsYWluVGV4dCkgcmV0dXJuO1xuXG5cdFx0XHRjb25zdCBjYW52YXNSZWN0ID0gdmlldy5jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRjb25zdCBkcm9wWCA9IChlLmNsaWVudFggLSBjYW52YXNSZWN0LmxlZnQgLSB2aWV3LnBhblgpIC8gdmlldy5zY2FsZTtcblx0XHRcdGNvbnN0IGRyb3BZID0gKGUuY2xpZW50WSAtIGNhbnZhc1JlY3QudG9wIC0gdmlldy5wYW5ZKSAvIHZpZXcuc2NhbGU7XG5cblx0XHRcdGNvbnN0IGxpbmVzID0gcGxhaW5UZXh0LnNwbGl0KFwiXFxuXCIpLm1hcChsID0+IGwudHJpbSgpKS5maWx0ZXIobCA9PiBsKTtcblx0XHRcdGxldCBvZmZzZXRJbmRleCA9IDA7XG5cblx0XHRcdGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuXHRcdFx0XHRjb25zdCBwYXRoID0gdmlldy5wYXJzZVBhdGgobGluZSk7XG5cdFx0XHRcdGlmICghcGF0aCkgY29udGludWU7XG5cblx0XHRcdFx0aWYgKHBhdGguc3RhcnRzV2l0aChcImh0dHBcIikpIHtcblx0XHRcdFx0XHR2aWV3LmFkZExpbmtOb2RlKHBhdGgsIGRyb3BYIC0gMTUwICsgb2Zmc2V0SW5kZXggKiAzMCwgZHJvcFkgLSAxMDAgKyBvZmZzZXRJbmRleCAqIDMwKTtcblx0XHRcdFx0XHRvZmZzZXRJbmRleCsrO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgaXRlbSA9IHZpZXcucmVzb2x2ZVZhdWx0SXRlbShwYXRoKTtcblxuXHRcdFx0XHRpZiAoaXRlbSBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcblx0XHRcdFx0XHRjb25zdCBtZEZpbGVzID0gdmlldy5nZXRNZEZpbGVzRnJvbUZvbGRlcihpdGVtKTtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGZpbGUgb2YgbWRGaWxlcykge1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHZpZXcuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG5cdFx0XHRcdFx0XHRcdHZpZXcuYWRkTm90ZU5vZGUoZmlsZS5wYXRoLCBjb250ZW50LCBkcm9wWCArIG9mZnNldEluZGV4ICogMzAsIGRyb3BZICsgb2Zmc2V0SW5kZXggKiAzMCk7XG5cdFx0XHRcdFx0XHRcdG9mZnNldEluZGV4Kys7XG5cdFx0XHRcdFx0XHR9IGNhdGNoIHsgLyogbm9vcCAqLyB9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKGl0ZW0gaW5zdGFuY2VvZiBURmlsZSAmJiBpdGVtLmV4dGVuc2lvbiA9PT0gXCJtZFwiKSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB2aWV3LmFwcC52YXVsdC5yZWFkKGl0ZW0pO1xuXHRcdFx0XHRcdFx0dmlldy5hZGROb3RlTm9kZShpdGVtLnBhdGgsIGNvbnRlbnQsIGRyb3BYICsgb2Zmc2V0SW5kZXggKiAzMCwgZHJvcFkgKyBvZmZzZXRJbmRleCAqIDMwKTtcblx0XHRcdFx0XHRcdG9mZnNldEluZGV4Kys7XG5cdFx0XHRcdFx0fSBjYXRjaCB7IC8qIG5vb3AgKi8gfVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkoKTtcblx0fSk7XG59XG4iXX0=