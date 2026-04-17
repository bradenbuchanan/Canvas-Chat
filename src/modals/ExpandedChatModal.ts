import { App, Modal } from "obsidian";
import type { ChatViewHandle } from "../types";

export class ExpandedChatModal extends Modal {
	private view: ChatViewHandle;
	private nodeId: string;
	private messagesContainer!: HTMLElement;
	private input!: HTMLTextAreaElement;
	private updateInterval!: number;

	constructor(app: App, view: ChatViewHandle, nodeId: string) {
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

		sendBtn.onclick = () => void this.sendMessage();
		this.input.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				void this.sendMessage();
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
