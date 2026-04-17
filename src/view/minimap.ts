import type { CanvasChatView } from "../main";

export function createMinimap(view: CanvasChatView, container: Element): void {
	view.minimap = container.createDiv({ cls: "rabbitmap-minimap" }) as HTMLElement;
	view.minimapContent = view.minimap.createDiv({ cls: "rabbitmap-minimap-content" });
	view.minimapViewport = view.minimap.createDiv({ cls: "rabbitmap-minimap-viewport" });

	view.minimap.addEventListener("mousedown", (e) => {
		e.preventDefault();
		navigateFromMinimap(view, e);
	});

	view.minimap.addEventListener("mousemove", (e) => {
		if (e.buttons === 1) {
			navigateFromMinimap(view, e);
		}
	});
}

export function navigateFromMinimap(view: CanvasChatView, e: MouseEvent): void {
	const bounds = view.getContentBounds();
	if (!bounds) return;

	const rect = view.minimap.getBoundingClientRect();
	const canvasRect = view.canvas.getBoundingClientRect();

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

	view.panX = canvasRect.width / 2 - canvasX * view.scale;
	view.panY = canvasRect.height / 2 - canvasY * view.scale;

	const clamped = view.clampPan(view.panX, view.panY);
	view.panX = clamped.x;
	view.panY = clamped.y;

	view.updateTransform();
	view.triggerSave();
}

export function updateMinimap(view: CanvasChatView): void {
	if (!view.minimap) return;

	const bounds = view.getContentBounds();
	if (!bounds) {
		view.minimapViewport.style.display = "none";
		return;
	}

	const canvasRect = view.canvas.getBoundingClientRect();
	const minimapRect = view.minimap.getBoundingClientRect();

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

	for (const [nodeId, node] of view.nodes) {
		let minimapNode = view.minimapNodes.get(nodeId);
		if (!minimapNode) {
			minimapNode = view.minimapContent.createDiv({ cls: "rabbitmap-minimap-node" });
			if (node.type === "chat") {
				minimapNode.addClass("rabbitmap-minimap-node-chat");
			} else if (node.type === "link") {
				minimapNode.addClass("rabbitmap-minimap-node-link");
			} else if (node.type === "note") {
				minimapNode.addClass("rabbitmap-minimap-node-note");
			}
			view.minimapNodes.set(nodeId, minimapNode);
		}

		minimapNode.style.left = `${offsetX + (node.x - contentMinX) * minimapScale}px`;
		minimapNode.style.top = `${offsetY + (node.y - contentMinY) * minimapScale}px`;
		minimapNode.style.width = `${node.width * minimapScale}px`;
		minimapNode.style.height = `${node.height * minimapScale}px`;
	}

	for (const [nodeId, el] of view.minimapNodes) {
		if (!view.nodes.has(nodeId)) {
			el.remove();
			view.minimapNodes.delete(nodeId);
		}
	}

	view.minimapViewport.style.display = "block";
	const viewLeft = (-view.panX / view.scale - contentMinX) * minimapScale + offsetX;
	const viewTop = (-view.panY / view.scale - contentMinY) * minimapScale + offsetY;
	const viewWidth = (canvasRect.width / view.scale) * minimapScale;
	const viewHeight = (canvasRect.height / view.scale) * minimapScale;

	view.minimapViewport.style.left = `${viewLeft}px`;
	view.minimapViewport.style.top = `${viewTop}px`;
	view.minimapViewport.style.width = `${viewWidth}px`;
	view.minimapViewport.style.height = `${viewHeight}px`;
}
