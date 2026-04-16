import { Notice, TFile, TFolder } from "obsidian";
import type { CanvasChatView } from "../../main";
import { renderChatContent } from "./rendering";

export function setupEventListeners(view: CanvasChatView): void {
	view.canvas.addEventListener("wheel", (e) => {
		e.preventDefault();

		if (e.ctrlKey || e.metaKey) {
			const delta = -e.deltaY * 0.01;
			view.zoomAtPoint(delta, e.clientX, e.clientY);
		} else {
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
		} else if (e.button === 0 && e.target === view.canvas) {
			e.preventDefault();
			view.isSelecting = true;
			const rect = view.canvas.getBoundingClientRect();
			view.selectionStartX = e.clientX - rect.left;
			view.selectionStartY = e.clientY - rect.top;

			if (view.selectionBox) {
				view.selectionBox.style.left = `${view.selectionStartX}px`;
				view.selectionBox.style.top = `${view.selectionStartY}px`;
				view.selectionBox.style.width = "0px";
				view.selectionBox.style.height = "0px";
				view.selectionBox.style.display = "block";
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
		} else if (view.isSelecting && view.selectionBox) {
			const rect = view.canvas.getBoundingClientRect();
			const currentX = e.clientX - rect.left;
			const currentY = e.clientY - rect.top;

			const left = Math.min(view.selectionStartX, currentX);
			const top = Math.min(view.selectionStartY, currentY);
			const width = Math.abs(currentX - view.selectionStartX);
			const height = Math.abs(currentY - view.selectionStartY);

			view.selectionBox.style.left = `${left}px`;
			view.selectionBox.style.top = `${top}px`;
			view.selectionBox.style.width = `${width}px`;
			view.selectionBox.style.height = `${height}px`;

			view.updateSelectionFromBox(left, top, width, height);
		} else if (view.isDrawingEdge && view.edgeDrawTempLine) {
			const rect = view.canvas.getBoundingClientRect();
			const canvasX = (e.clientX - rect.left - view.panX) / view.scale;
			const canvasY = (e.clientY - rect.top - view.panY) / view.scale;
			view.edgeDrawTempLine.setAttribute("x2", String(canvasX));
			view.edgeDrawTempLine.setAttribute("y2", String(canvasY));
		} else if (view.draggedNode) {
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
			} else {
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
					if (!el || n.type !== "chat" || id === view.draggedNode) continue;
					const inside = dragCenterX >= n.x && dragCenterX <= n.x + n.width &&
						dragCenterY >= n.y && dragCenterY <= n.y + n.height;
					el.toggleClass("rabbitmap-drop-target", inside);
				}
			}
		} else if (view.resizingNode) {
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
				const duplicate = Array.from(view.edges.values()).some(
					(edge) =>
						(edge.from === view.edgeDrawFromNode && edge.to === targetInfo.nodeId) ||
						(edge.from === targetInfo.nodeId && edge.to === view.edgeDrawFromNode)
				);
				if (!duplicate) {
					view.addEdge(view.edgeDrawFromNode!, targetInfo.nodeId);
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
					if (n.type !== "chat" || id === view.draggedNode) continue;
					const inside = dragCenterX >= n.x && dragCenterX <= n.x + n.width &&
						dragCenterY >= n.y && dragCenterY <= n.y + n.height;
					if (inside) {
						const chatState = view.chatStates.get(id);
						if (chatState) {
							if (!chatState.contextNodes) chatState.contextNodes = [];
							if (!chatState.contextNodes.includes(view.draggedNode)) {
								chatState.contextNodes.push(view.draggedNode);
								view.chatStates.set(id, chatState);

								const hasEdge = Array.from(view.edges.values()).some(
									edge => (edge.from === id && edge.to === view.draggedNode) ||
										(edge.from === view.draggedNode && edge.to === id)
								);
								if (!hasEdge) {
									view.addEdge(id, view.draggedNode);
								}

								const nodeEl = view.nodeElements.get(id);
								if (nodeEl) {
									const content = nodeEl.querySelector(".rabbitmap-node-content");
									if (content) {
										content.empty();
										renderChatContent(view, id, content as HTMLElement);
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
			view.selectionBox.style.display = "none";
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
		if (view.isInputFocused()) return;
		const text = e.clipboardData?.getData("text/plain")?.trim();
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

	view.canvas.addEventListener("drop", async (e) => {
		e.preventDefault();
		view.canvas.removeClass("rabbitmap-canvas-drag-over");

		const plainText = e.dataTransfer?.getData("text/plain") || "";
		if (!plainText) return;

		const canvasRect = view.canvas.getBoundingClientRect();
		const dropX = (e.clientX - canvasRect.left - view.panX) / view.scale;
		const dropY = (e.clientY - canvasRect.top - view.panY) / view.scale;

		const lines = plainText.split("\n").map(l => l.trim()).filter(l => l);
		let offsetIndex = 0;

		for (const line of lines) {
			const path = view.parsePath(line);
			if (!path) continue;

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
						const content = await view.app.vault.read(file);
						view.addNoteNode(file.path, content, dropX + offsetIndex * 30, dropY + offsetIndex * 30);
						offsetIndex++;
					} catch {}
				}
			} else if (item instanceof TFile && item.extension === "md") {
				try {
					const content = await view.app.vault.read(item);
					view.addNoteNode(item.path, content, dropX + offsetIndex * 30, dropY + offsetIndex * 30);
					offsetIndex++;
				} catch {}
			}
		}
	});
}
