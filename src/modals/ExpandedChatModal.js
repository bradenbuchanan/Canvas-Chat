var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Modal } from "obsidian";
export class ExpandedChatModal extends Modal {
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
        // Header
        const header = contentEl.createDiv({ cls: "rabbitmap-expanded-header" });
        header.createEl("h2", { text: (node === null || node === void 0 ? void 0 : node.title) || "Chat" });
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
    sendMessage() {
        return __awaiter(this, void 0, void 0, function* () {
            const text = this.input.value.trim();
            if (!text)
                return;
            this.input.value = "";
            this.input.disabled = true;
            // Show user message + loading
            this.renderMessages(true);
            yield this.view.sendChatMessage(this.nodeId, text);
            this.input.disabled = false;
            this.input.focus();
            this.renderMessages();
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        });
    }
    onClose() {
        if (this.updateInterval) {
            window.clearInterval(this.updateInterval);
        }
        const { contentEl } = this;
        contentEl.empty();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRXhwYW5kZWRDaGF0TW9kYWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJFeHBhbmRlZENoYXRNb2RhbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQSxPQUFPLEVBQU8sS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBR3RDLE1BQU0sT0FBTyxpQkFBa0IsU0FBUSxLQUFLO0lBTzNDLFlBQVksR0FBUSxFQUFFLElBQW9CLEVBQUUsTUFBYztRQUN6RCxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDWCxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNqQixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztJQUN0QixDQUFDO0lBRUQsTUFBTTtRQUNMLE1BQU0sRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQ3BDLE9BQU8sQ0FBQyxRQUFRLENBQUMsK0JBQStCLENBQUMsQ0FBQztRQUNsRCxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFbEIsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzVDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUV0RCxTQUFTO1FBQ1QsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsRUFBRSwyQkFBMkIsRUFBRSxDQUFDLENBQUM7UUFDekUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQSxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsS0FBSyxLQUFJLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFFdkQsSUFBSSxTQUFTLEVBQUUsQ0FBQztZQUNmLE1BQU0sQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFF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QUUsQ0FBQztZQUN0QixJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7WUFFM0IsOEJBQThCO1lBQzlCLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFMUIsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBRW5ELElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQztZQUM1QixJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ25CLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN0QixJQUFJLENBQUMsaUJBQWlCLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLENBQUM7UUFDeEUsQ0FBQztLQUFBO0lBRUQsT0FBTztRQUNOLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3pCLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQzNDLENBQUM7UUFDRCxNQUFNLEVBQUUsU0FBUyxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQzNCLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUNuQixDQUFDO0NBQ0QiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHAsIE1vZGFsIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSB7IENoYXRWaWV3SGFuZGxlIH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5cbmV4cG9ydCBjbGFzcyBFeHBhbmRlZENoYXRNb2RhbCBleHRlbmRzIE1vZGFsIHtcblx0cHJpdmF0ZSB2aWV3OiBDaGF0Vmlld0hhbmRsZTtcblx0cHJpdmF0ZSBub2RlSWQ6IHN0cmluZztcblx0cHJpdmF0ZSBtZXNzYWdlc0NvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIGlucHV0ITogSFRNTFRleHRBcmVhRWxlbWVudDtcblx0cHJpdmF0ZSB1cGRhdGVJbnRlcnZhbCE6IG51bWJlcjtcblxuXHRjb25zdHJ1Y3RvcihhcHA6IEFwcCwgdmlldzogQ2hhdFZpZXdIYW5kbGUsIG5vZGVJZDogc3RyaW5nKSB7XG5cdFx0c3VwZXIoYXBwKTtcblx0XHR0aGlzLnZpZXcgPSB2aWV3O1xuXHRcdHRoaXMubm9kZUlkID0gbm9kZUlkO1xuXHR9XG5cblx0b25PcGVuKCkge1xuXHRcdGNvbnN0IHsgY29udGVudEVsLCBtb2RhbEVsIH0gPSB0aGlzO1xuXHRcdG1vZGFsRWwuYWRkQ2xhc3MoXCJyYWJiaXRtYXAtZXhwYW5kZWQtY2hhdC1tb2RhbFwiKTtcblx0XHRjb250ZW50RWwuZW1wdHkoKTtcblxuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLnZpZXcuZ2V0Tm9kZSh0aGlzLm5vZGVJZCk7XG5cdFx0Y29uc3QgY2hhdFN0YXRlID0gdGhpcy52aWV3LmdldENoYXRTdGF0ZSh0aGlzLm5vZGVJZCk7XG5cblx0XHQvLyBIZWFkZXJcblx0XHRjb25zdCBoZWFkZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1leHBhbmRlZC1oZWFkZXJcIiB9KTtcblx0XHRoZWFkZXIuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IG5vZGU/LnRpdGxlIHx8IFwiQ2hhdFwiIH0pO1xuXG5cdFx0aWYgKGNoYXRTdGF0ZSkge1xuXHRcdFx0aGVhZGVyLmNyZWF0ZUVsKFwic3BhblwiLCB7XG5cdFx0XHRcdHRleHQ6IGAke2NoYXRTdGF0ZS5wcm92aWRlcn0gLyAke2NoYXRTdGF0ZS5tb2RlbH1gLFxuXHRcdFx0XHRjbHM6IFwicmFiYml0bWFwLWV4cGFuZGVkLW1vZGVsXCJcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIE1lc3NhZ2VzXG5cdFx0dGhpcy5tZXNzYWdlc0NvbnRhaW5lciA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLWV4cGFuZGVkLW1lc3NhZ2VzXCIgfSk7XG5cdFx0dGhpcy5yZW5kZXJNZXNzYWdlcygpO1xuXG5cdFx0Ly8gSW5wdXQgYXJlYVxuXHRcdGNvbnN0IGlucHV0QXJlYSA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLWV4cGFuZGVkLWlucHV0LWFyZWFcIiB9KTtcblx0XHR0aGlzLmlucHV0ID0gaW5wdXRBcmVhLmNyZWF0ZUVsKFwidGV4dGFyZWFcIiwge1xuXHRcdFx0Y2xzOiBcInJhYmJpdG1hcC1leHBhbmRlZC1pbnB1dFwiLFxuXHRcdFx0YXR0cjogeyBwbGFjZWhvbGRlcjogXCJUeXBlIGEgbWVzc2FnZS4uLlwiLCByb3dzOiBcIjNcIiB9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBzZW5kQnRuID0gaW5wdXRBcmVhLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdHRleHQ6IFwiU2VuZFwiLFxuXHRcdFx0Y2xzOiBcInJhYmJpdG1hcC1leHBhbmRlZC1zZW5kLWJ0blwiXG5cdFx0fSk7XG5cblx0XHRzZW5kQnRuLm9uY2xpY2sgPSAoKSA9PiB2b2lkIHRoaXMuc2VuZE1lc3NhZ2UoKTtcblx0XHR0aGlzLmlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChlKSA9PiB7XG5cdFx0XHRpZiAoZS5rZXkgPT09IFwiRW50ZXJcIiAmJiAhZS5zaGlmdEtleSkge1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHZvaWQgdGhpcy5zZW5kTWVzc2FnZSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Ly8gRm9jdXMgaW5wdXQgYW5kIHNjcm9sbCB0byBib3R0b21cblx0XHR0aGlzLmlucHV0LmZvY3VzKCk7XG5cdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLm1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbFRvcCA9IHRoaXMubWVzc2FnZXNDb250YWluZXIuc2Nyb2xsSGVpZ2h0O1xuXHRcdH0sIDUwKTtcblxuXHRcdC8vIFN5bmMgbWVzc2FnZXMgcGVyaW9kaWNhbGx5XG5cdFx0dGhpcy51cGRhdGVJbnRlcnZhbCA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHR0aGlzLnJlbmRlck1lc3NhZ2VzKCk7XG5cdFx0fSwgNTAwKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyTWVzc2FnZXMoc2hvd0xvYWRpbmc6IGJvb2xlYW4gPSBmYWxzZSkge1xuXHRcdGNvbnN0IG1lc3NhZ2VzID0gdGhpcy52aWV3LmdldENoYXRNZXNzYWdlcyh0aGlzLm5vZGVJZCkgfHwgW107XG5cdFx0Y29uc3Qgc2Nyb2xsZWRUb0JvdHRvbSA9IHRoaXMubWVzc2FnZXNDb250YWluZXIuc2Nyb2xsVG9wICsgdGhpcy5tZXNzYWdlc0NvbnRhaW5lci5jbGllbnRIZWlnaHQgPj0gdGhpcy5tZXNzYWdlc0NvbnRhaW5lci5zY3JvbGxIZWlnaHQgLSAxMDtcblxuXHRcdHRoaXMubWVzc2FnZXNDb250YWluZXIuZW1wdHkoKTtcblxuXHRcdGZvciAoY29uc3QgbXNnIG9mIG1lc3NhZ2VzKSB7XG5cdFx0XHRjb25zdCBtc2dFbCA9IHRoaXMubWVzc2FnZXNDb250YWluZXIuY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBgcmFiYml0bWFwLWV4cGFuZGVkLW1lc3NhZ2UgcmFiYml0bWFwLWV4cGFuZGVkLSR7bXNnLnJvbGV9YFxuXHRcdFx0fSk7XG5cblx0XHRcdGlmIChtc2cucm9sZSA9PT0gXCJ1c2VyXCIgJiYgbXNnLmNvbnRleHRGaWxlcyAmJiBtc2cuY29udGV4dEZpbGVzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0Y29uc3QgY29udGV4dEVsID0gbXNnRWwuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1leHBhbmRlZC1jb250ZXh0XCIgfSk7XG5cdFx0XHRcdGNvbnRleHRFbC5jcmVhdGVTcGFuKHsgdGV4dDogXCJDb250ZXh0OiBcIiB9KTtcblx0XHRcdFx0Y29udGV4dEVsLmNyZWF0ZVNwYW4oeyB0ZXh0OiBtc2cuY29udGV4dEZpbGVzLm1hcChmID0+IGYuc3BsaXQoXCIvXCIpLnBvcCgpKS5qb2luKFwiLCBcIikgfSk7XG5cdFx0XHR9XG5cblx0XHRcdG1zZ0VsLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtZXhwYW5kZWQtY29udGVudFwiLCB0ZXh0OiBtc2cuY29udGVudCB9KTtcblx0XHR9XG5cblx0XHQvLyBTaG93IGxvYWRpbmcgaW5kaWNhdG9yXG5cdFx0aWYgKHNob3dMb2FkaW5nKSB7XG5cdFx0XHRjb25zdCBsb2FkaW5nRWwgPSB0aGlzLm1lc3NhZ2VzQ29udGFpbmVyLmNyZWF0ZURpdih7XG5cdFx0XHRcdGNsczogXCJyYWJiaXRtYXAtZXhwYW5kZWQtbWVzc2FnZSByYWJiaXRtYXAtZXhwYW5kZWQtYXNzaXN0YW50IHJhYmJpdG1hcC1leHBhbmRlZC1sb2FkaW5nXCJcblx0XHRcdH0pO1xuXHRcdFx0bG9hZGluZ0VsLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtZXhwYW5kZWQtY29udGVudFwiLCB0ZXh0OiBcIi4uLlwiIH0pO1xuXHRcdH1cblxuXHRcdGlmIChzY3JvbGxlZFRvQm90dG9tIHx8IHNob3dMb2FkaW5nKSB7XG5cdFx0XHR0aGlzLm1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbFRvcCA9IHRoaXMubWVzc2FnZXNDb250YWluZXIuc2Nyb2xsSGVpZ2h0O1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2VuZE1lc3NhZ2UoKSB7XG5cdFx0Y29uc3QgdGV4dCA9IHRoaXMuaW5wdXQudmFsdWUudHJpbSgpO1xuXHRcdGlmICghdGV4dCkgcmV0dXJuO1xuXG5cdFx0dGhpcy5pbnB1dC52YWx1ZSA9IFwiXCI7XG5cdFx0dGhpcy5pbnB1dC5kaXNhYmxlZCA9IHRydWU7XG5cblx0XHQvLyBTaG93IHVzZXIgbWVzc2FnZSArIGxvYWRpbmdcblx0XHR0aGlzLnJlbmRlck1lc3NhZ2VzKHRydWUpO1xuXG5cdFx0YXdhaXQgdGhpcy52aWV3LnNlbmRDaGF0TWVzc2FnZSh0aGlzLm5vZGVJZCwgdGV4dCk7XG5cblx0XHR0aGlzLmlucHV0LmRpc2FibGVkID0gZmFsc2U7XG5cdFx0dGhpcy5pbnB1dC5mb2N1cygpO1xuXHRcdHRoaXMucmVuZGVyTWVzc2FnZXMoKTtcblx0XHR0aGlzLm1lc3NhZ2VzQ29udGFpbmVyLnNjcm9sbFRvcCA9IHRoaXMubWVzc2FnZXNDb250YWluZXIuc2Nyb2xsSGVpZ2h0O1xuXHR9XG5cblx0b25DbG9zZSgpIHtcblx0XHRpZiAodGhpcy51cGRhdGVJbnRlcnZhbCkge1xuXHRcdFx0d2luZG93LmNsZWFySW50ZXJ2YWwodGhpcy51cGRhdGVJbnRlcnZhbCk7XG5cdFx0fVxuXHRcdGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuXHRcdGNvbnRlbnRFbC5lbXB0eSgpO1xuXHR9XG59XG4iXX0=