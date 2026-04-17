import { setIcon } from "obsidian";
import type { CanvasChatView } from "../main";
import { SettingsModal } from "../modals";

export function createToolbar(view: CanvasChatView, container: Element): void {
	const toolbar = container.createDiv({ cls: "rabbitmap-toolbar" });

	const addCardBtn = toolbar.createEl("button", { cls: "rabbitmap-btn rabbitmap-btn-icon", attr: { title: "Add card" } });
	setIcon(addCardBtn, "square-plus");
	addCardBtn.onclick = () => view.addCardAtCenter();

	const addChatBtn = toolbar.createEl("button", { cls: "rabbitmap-btn rabbitmap-btn-icon", attr: { title: "Add chat" } });
	setIcon(addChatBtn, "message-square");
	addChatBtn.onclick = () => view.addChatAtCenter();

	const addLinkBtn = toolbar.createEl("button", { cls: "rabbitmap-btn rabbitmap-btn-icon", attr: { title: "Add link" } });
	setIcon(addLinkBtn, "link");
	addLinkBtn.onclick = () => view.showAddLinkModal();

	toolbar.createDiv({ cls: "rabbitmap-toolbar-separator" });

	const settingsBtn = toolbar.createEl("button", { cls: "rabbitmap-btn rabbitmap-btn-icon", attr: { title: "Settings" } });
	setIcon(settingsBtn, "settings");
	settingsBtn.onclick = () => new SettingsModal(view.app, view.plugin).open();
}
