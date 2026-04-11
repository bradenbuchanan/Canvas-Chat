import { Modal } from "obsidian";

export class PromptEditorModal extends Modal {
	private prompt: string;
	private contextTemplate: string;
	private onSave: (prompt: string, template: string) => void;

	constructor(app: any, prompt: string, contextTemplate: string, onSave: (prompt: string, template: string) => void) {
		super(app);
		this.prompt = prompt;
		this.contextTemplate = contextTemplate;
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("rabbitmap-prompt-modal");

		// System Prompt section
		contentEl.createEl("h3", { text: "System Prompt" });
		const promptTextarea = contentEl.createEl("textarea", {
			cls: "rabbitmap-prompt-textarea",
			attr: { placeholder: "Enter system prompt for this chat..." }
		});
		promptTextarea.value = this.prompt;

		// Context Template section
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

		// Preview
		contentEl.createEl("h4", { text: "Preview", cls: "rabbitmap-prompt-section-title" });
		const preview = contentEl.createDiv({ cls: "rabbitmap-prompt-preview" });

		const updatePreview = () => {
			const template = templateTextarea.value;
			const example = template
				.replace(/\{filepath\}/g, "folder/example.md")
				.replace(/\{filename\}/g, "example.md")
				.replace(/\{content\}/g, "File content here...");
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
}
