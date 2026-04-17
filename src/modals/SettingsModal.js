var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Modal, Notice, Setting } from "obsidian";
export class SettingsModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("rabbitmap-settings-modal");
        contentEl.createEl("h2", { text: "Provider settings" });
        // Providers section
        const providersContainer = contentEl.createDiv({ cls: "rabbitmap-providers-container" });
        const renderProviders = () => {
            providersContainer.empty();
            for (let i = 0; i < this.plugin.settings.providers.length; i++) {
                const provider = this.plugin.settings.providers[i];
                const providerSection = providersContainer.createDiv({ cls: "rabbitmap-provider-section" });
                // Provider header with name and toggle
                const headerRow = providerSection.createDiv({ cls: "rabbitmap-provider-header" });
                headerRow.createEl("h3", { text: provider.name });
                // Enabled toggle
                const toggleContainer = headerRow.createDiv({ cls: "rabbitmap-provider-toggle" });
                const toggleLabel = toggleContainer.createEl("label", { cls: "rabbitmap-toggle-label" });
                const toggleInput = toggleLabel.createEl("input", { type: "checkbox" });
                toggleInput.checked = provider.enabled;
                toggleLabel.createSpan({ text: provider.enabled ? "Enabled" : "Disabled" });
                toggleInput.onchange = () => __awaiter(this, void 0, void 0, function* () {
                    provider.enabled = toggleInput.checked;
                    toggleLabel.querySelector("span").textContent = provider.enabled ? "Enabled" : "Disabled";
                    yield this.plugin.saveSettings();
                });
                // Base URL setting
                new Setting(providerSection)
                    .setName("Base URL")
                    .setDesc("API endpoint URL (change for custom/proxy deployments)")
                    .addText((text) => text
                    .setPlaceholder("https://api.example.com/v1")
                    .setValue(provider.baseUrl)
                    .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                    provider.baseUrl = value;
                    yield this.plugin.saveSettings();
                })));
                // API Key setting
                new Setting(providerSection)
                    .setName("API key")
                    .setDesc(`Enter your ${provider.name} API key`)
                    .addText((text) => text
                    .setPlaceholder("sk-...")
                    .setValue(provider.apiKey)
                    .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                    provider.apiKey = value;
                    yield this.plugin.saveSettings();
                })));
                // API Format setting
                new Setting(providerSection)
                    .setName("API format")
                    .setDesc("Select the API format for this provider")
                    .addDropdown((dropdown) => dropdown
                    .addOption("openai", "OpenAI compatible")
                    .addOption("anthropic", "Anthropic (Claude)")
                    .addOption("google", "Google (Gemini)")
                    .setValue(provider.apiFormat || "openai")
                    .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                    provider.apiFormat = value;
                    yield this.plugin.saveSettings();
                })));
                // Models section
                const modelsHeader = providerSection.createDiv({ cls: "rabbitmap-models-header" });
                modelsHeader.createEl("h4", { text: "Models" });
                // Models input row
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
                // Models list
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
                            text: "×",
                            cls: "rabbitmap-models-remove-btn"
                        });
                        removeBtn.onclick = () => __awaiter(this, void 0, void 0, function* () {
                            provider.models = provider.models.filter(m => m !== model);
                            yield this.plugin.saveSettings();
                            renderModelsList();
                        });
                    }
                };
                addButton.onclick = () => __awaiter(this, void 0, void 0, function* () {
                    const newModel = modelInput.value.trim();
                    if (!newModel)
                        return;
                    if (!provider.models.includes(newModel)) {
                        provider.models.push(newModel);
                        yield this.plugin.saveSettings();
                    }
                    modelInput.value = "";
                    renderModelsList();
                });
                modelInput.onkeydown = (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        addButton.click();
                    }
                };
                renderModelsList();
            }
            // Add new provider button
            const addProviderRow = providersContainer.createDiv({ cls: "rabbitmap-add-provider-row" });
            const newProviderInput = addProviderRow.createEl("input", {
                type: "text",
                placeholder: "New provider name (e.g. Ollama)",
                cls: "rabbitmap-new-provider-input"
            });
            const addProviderBtn = addProviderRow.createEl("button", {
                text: "Add provider",
                cls: "rabbitmap-add-provider-btn"
            });
            addProviderBtn.onclick = () => __awaiter(this, void 0, void 0, function* () {
                const name = newProviderInput.value.trim();
                if (!name)
                    return;
                if (this.plugin.settings.providers.some(p => p.name === name)) {
                    new Notice(`Provider "${name}" already exists.`);
                    return;
                }
                this.plugin.settings.providers.push({
                    name,
                    baseUrl: "https://api.example.com/v1",
                    apiKey: "",
                    models: [],
                    enabled: true,
                    apiFormat: "openai"
                });
                yield this.plugin.saveSettings();
                newProviderInput.value = "";
                renderProviders();
            });
        };
        renderProviders();
        // Help links
        contentEl.createEl("p", {
            text: "Get your API keys from:",
            cls: "rabbitmap-settings-info",
        });
        const linkContainer = contentEl.createDiv({ cls: "rabbitmap-settings-links" });
        linkContainer.createEl("a", {
            text: "OpenAI platform",
            href: "https://platform.openai.com/api-keys",
        });
        linkContainer.createEl("span", { text: " | " });
        linkContainer.createEl("a", {
            text: "OpenRouter",
            href: "https://openrouter.ai/keys",
        });
        linkContainer.createEl("span", { text: " | " });
        linkContainer.createEl("a", {
            text: "Google AI Studio",
            href: "https://aistudio.google.com/apikey",
        });
        linkContainer.createEl("span", { text: " | " });
        linkContainer.createEl("a", {
            text: "Anthropic console",
            href: "https://console.anthropic.com/settings/keys",
        });
    }
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2V0dGluZ3NNb2RhbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIlNldHRpbmdzTW9kYWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUEsT0FBTyxFQUFPLEtBQUssRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBUXZELE1BQU0sT0FBTyxhQUFjLFNBQVEsS0FBSztJQUd2QyxZQUFZLEdBQVEsRUFBRSxNQUFvQjtRQUN6QyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDWCxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztJQUN0QixDQUFDO0lBRUQsTUFBTTtRQUNMLE1BQU0sRUFBRSxTQUFTLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFDM0IsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2xCLFNBQVMsQ0FBQyxRQUFRLENBQUMsMEJBQTBCLENBQUMsQ0FBQztRQUUvQyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxtQkFBbUIsRUFBRSxDQUFDLENBQUM7UUFFeEQsb0JBQW9CO1FBQ3BCLE1BQU0sa0JBQWtCLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsRUFBRSwrQkFBK0IsRUFBRSxDQUFDLENBQUM7UUFFekYsTUFBTSxlQUFlLEdBQUcsR0FBRyxFQUFFO1lBQzVCLGtCQUFrQixDQUFDLEtBQUssRUFBRSxDQUFDO1lBRTNCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ2hFLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDbkQsTUFBTSxlQUFlLEdBQUcsa0JBQWtCLENBQUMsU0FBUyxD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WUFDM0IsSUFBSSxFQUFFLGlCQUFpQjtZQUN2QixJQUFJLEVBQUUsc0NBQXNDO1NBQzVDLENBQUMsQ0FBQztRQUNILGFBQWEsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDaEQsYUFBYSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUU7WUFDM0IsSUFBSSxFQUFFLFlBQVk7WUFDbEIsSUFBSSxFQUFFLDRCQUE0QjtTQUNsQyxDQUFDLENBQUM7UUFDSCxhQUFhLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQ2hELGFBQWEsQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFO1lBQzNCLElBQUksRUFBRSxrQkFBa0I7WUFDeEIsSUFBSSxFQUFFLG9DQUFvQztTQUMxQyxDQUFDLENBQUM7UUFDSCxhQUFhLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQ2hELGFBQWEsQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFO1lBQzNCLElBQUksRUFBRSxtQkFBbUI7WUFDekIsSUFBSSxFQUFFLDZDQUE2QztTQUNuRCxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsT0FBTztRQUNOLE1BQU0sRUFBRSxTQUFTLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFDM0IsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ25CLENBQUM7Q0FDRCIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwcCwgTW9kYWwsIE5vdGljZSwgU2V0dGluZyB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgeyBQbHVnaW5TZXR0aW5ncyB9IGZyb20gXCIuLi90eXBlc1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNldHRpbmdzSG9zdCB7XG5cdHNldHRpbmdzOiBQbHVnaW5TZXR0aW5ncztcblx0c2F2ZVNldHRpbmdzKCk6IFByb21pc2U8dm9pZD47XG59XG5cbmV4cG9ydCBjbGFzcyBTZXR0aW5nc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuXHRwbHVnaW46IFNldHRpbmdzSG9zdDtcblxuXHRjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBTZXR0aW5nc0hvc3QpIHtcblx0XHRzdXBlcihhcHApO1xuXHRcdHRoaXMucGx1Z2luID0gcGx1Z2luO1xuXHR9XG5cblx0b25PcGVuKCkge1xuXHRcdGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuXHRcdGNvbnRlbnRFbC5lbXB0eSgpO1xuXHRcdGNvbnRlbnRFbC5hZGRDbGFzcyhcInJhYmJpdG1hcC1zZXR0aW5ncy1tb2RhbFwiKTtcblxuXHRcdGNvbnRlbnRFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJQcm92aWRlciBzZXR0aW5nc1wiIH0pO1xuXG5cdFx0Ly8gUHJvdmlkZXJzIHNlY3Rpb25cblx0XHRjb25zdCBwcm92aWRlcnNDb250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1wcm92aWRlcnMtY29udGFpbmVyXCIgfSk7XG5cblx0XHRjb25zdCByZW5kZXJQcm92aWRlcnMgPSAoKSA9PiB7XG5cdFx0XHRwcm92aWRlcnNDb250YWluZXIuZW1wdHkoKTtcblxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnBsdWdpbi5zZXR0aW5ncy5wcm92aWRlcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5wcm92aWRlcnNbaV07XG5cdFx0XHRcdGNvbnN0IHByb3ZpZGVyU2VjdGlvbiA9IHByb3ZpZGVyc0NvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLXByb3ZpZGVyLXNlY3Rpb25cIiB9KTtcblxuXHRcdFx0XHQvLyBQcm92aWRlciBoZWFkZXIgd2l0aCBuYW1lIGFuZCB0b2dnbGVcblx0XHRcdFx0Y29uc3QgaGVhZGVyUm93ID0gcHJvdmlkZXJTZWN0aW9uLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtcHJvdmlkZXItaGVhZGVyXCIgfSk7XG5cdFx0XHRcdGhlYWRlclJvdy5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogcHJvdmlkZXIubmFtZSB9KTtcblxuXHRcdFx0XHQvLyBFbmFibGVkIHRvZ2dsZVxuXHRcdFx0XHRjb25zdCB0b2dnbGVDb250YWluZXIgPSBoZWFkZXJSb3cuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1wcm92aWRlci10b2dnbGVcIiB9KTtcblx0XHRcdFx0Y29uc3QgdG9nZ2xlTGFiZWwgPSB0b2dnbGVDb250YWluZXIuY3JlYXRlRWwoXCJsYWJlbFwiLCB7IGNsczogXCJyYWJiaXRtYXAtdG9nZ2xlLWxhYmVsXCIgfSk7XG5cdFx0XHRcdGNvbnN0IHRvZ2dsZUlucHV0ID0gdG9nZ2xlTGFiZWwuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IHR5cGU6IFwiY2hlY2tib3hcIiB9KTtcblx0XHRcdFx0dG9nZ2xlSW5wdXQuY2hlY2tlZCA9IHByb3ZpZGVyLmVuYWJsZWQ7XG5cdFx0XHRcdHRvZ2dsZUxhYmVsLmNyZWF0ZVNwYW4oeyB0ZXh0OiBwcm92aWRlci5lbmFibGVkID8gXCJFbmFibGVkXCIgOiBcIkRpc2FibGVkXCIgfSk7XG5cdFx0XHRcdHRvZ2dsZUlucHV0Lm9uY2hhbmdlID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHByb3ZpZGVyLmVuYWJsZWQgPSB0b2dnbGVJbnB1dC5jaGVja2VkO1xuXHRcdFx0XHRcdHRvZ2dsZUxhYmVsLnF1ZXJ5U2VsZWN0b3IoXCJzcGFuXCIpIS50ZXh0Q29udGVudCA9IHByb3ZpZGVyLmVuYWJsZWQgPyBcIkVuYWJsZWRcIiA6IFwiRGlzYWJsZWRcIjtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0fTtcblxuXHRcdFx0XHQvLyBCYXNlIFVSTCBzZXR0aW5nXG5cdFx0XHRcdG5ldyBTZXR0aW5nKHByb3ZpZGVyU2VjdGlvbilcblx0XHRcdFx0XHQuc2V0TmFtZShcIkJhc2UgVVJMXCIpXG5cdFx0XHRcdFx0LnNldERlc2MoXCJBUEkgZW5kcG9pbnQgVVJMIChjaGFuZ2UgZm9yIGN1c3RvbS9wcm94eSBkZXBsb3ltZW50cylcIilcblx0XHRcdFx0XHQuYWRkVGV4dCgodGV4dCkgPT5cblx0XHRcdFx0XHRcdHRleHRcblx0XHRcdFx0XHRcdFx0LnNldFBsYWNlaG9sZGVyKFwiaHR0cHM6Ly9hcGkuZXhhbXBsZS5jb20vdjFcIilcblx0XHRcdFx0XHRcdFx0LnNldFZhbHVlKHByb3ZpZGVyLmJhc2VVcmwpXG5cdFx0XHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRwcm92aWRlci5iYXNlVXJsID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0KTtcblxuXHRcdFx0XHQvLyBBUEkgS2V5IHNldHRpbmdcblx0XHRcdFx0bmV3IFNldHRpbmcocHJvdmlkZXJTZWN0aW9uKVxuXHRcdFx0XHRcdC5zZXROYW1lKFwiQVBJIGtleVwiKVxuXHRcdFx0XHRcdC5zZXREZXNjKGBFbnRlciB5b3VyICR7cHJvdmlkZXIubmFtZX0gQVBJIGtleWApXG5cdFx0XHRcdFx0LmFkZFRleHQoKHRleHQpID0+XG5cdFx0XHRcdFx0XHR0ZXh0XG5cdFx0XHRcdFx0XHRcdC5zZXRQbGFjZWhvbGRlcihcInNrLS4uLlwiKVxuXHRcdFx0XHRcdFx0XHQuc2V0VmFsdWUocHJvdmlkZXIuYXBpS2V5KVxuXHRcdFx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0cHJvdmlkZXIuYXBpS2V5ID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0KTtcblxuXHRcdFx0XHQvLyBBUEkgRm9ybWF0IHNldHRpbmdcblx0XHRcdFx0bmV3IFNldHRpbmcocHJvdmlkZXJTZWN0aW9uKVxuXHRcdFx0XHRcdC5zZXROYW1lKFwiQVBJIGZvcm1hdFwiKVxuXHRcdFx0XHRcdC5zZXREZXNjKFwiU2VsZWN0IHRoZSBBUEkgZm9ybWF0IGZvciB0aGlzIHByb3ZpZGVyXCIpXG5cdFx0XHRcdFx0LmFkZERyb3Bkb3duKChkcm9wZG93bikgPT5cblx0XHRcdFx0XHRcdGRyb3Bkb3duXG5cdFx0XHRcdFx0XHRcdC5hZGRPcHRpb24oXCJvcGVuYWlcIiwgXCJPcGVuQUkgY29tcGF0aWJsZVwiKVxuXHRcdFx0XHRcdFx0XHQuYWRkT3B0aW9uKFwiYW50aHJvcGljXCIsIFwiQW50aHJvcGljIChDbGF1ZGUpXCIpXG5cdFx0XHRcdFx0XHRcdC5hZGRPcHRpb24oXCJnb29nbGVcIiwgXCJHb29nbGUgKEdlbWluaSlcIilcblx0XHRcdFx0XHRcdFx0LnNldFZhbHVlKHByb3ZpZGVyLmFwaUZvcm1hdCB8fCBcIm9wZW5haVwiKVxuXHRcdFx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0cHJvdmlkZXIuYXBpRm9ybWF0ID0gdmFsdWUgYXMgXCJvcGVuYWlcIiB8IFwiYW50aHJvcGljXCIgfCBcImdvb2dsZVwiO1xuXHRcdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0Ly8gTW9kZWxzIHNlY3Rpb25cblx0XHRcdFx0Y29uc3QgbW9kZWxzSGVhZGVyID0gcHJvdmlkZXJTZWN0aW9uLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtbW9kZWxzLWhlYWRlclwiIH0pO1xuXHRcdFx0XHRtb2RlbHNIZWFkZXIuY3JlYXRlRWwoXCJoNFwiLCB7IHRleHQ6IFwiTW9kZWxzXCIgfSk7XG5cblx0XHRcdFx0Ly8gTW9kZWxzIGlucHV0IHJvd1xuXHRcdFx0XHRjb25zdCBpbnB1dFJvdyA9IHByb3ZpZGVyU2VjdGlvbi5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLW1vZGVscy1pbnB1dC1yb3dcIiB9KTtcblx0XHRcdFx0Y29uc3QgbW9kZWxJbnB1dCA9IGlucHV0Um93LmNyZWF0ZUVsKFwiaW5wdXRcIiwge1xuXHRcdFx0XHRcdHR5cGU6IFwidGV4dFwiLFxuXHRcdFx0XHRcdHBsYWNlaG9sZGVyOiBcImUuZy4gZ3B0LTRvIG9yIGFudGhyb3BpYy9jbGF1ZGUtMy41LXNvbm5ldFwiLFxuXHRcdFx0XHRcdGNsczogXCJyYWJiaXRtYXAtbW9kZWxzLWlucHV0XCJcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGNvbnN0IGFkZEJ1dHRvbiA9IGlucHV0Um93LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdFx0XHR0ZXh0OiBcIkFkZFwiLFxuXHRcdFx0XHRcdGNsczogXCJyYWJiaXRtYXAtbW9kZWxzLWFkZC1idG5cIlxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHQvLyBNb2RlbHMgbGlzdFxuXHRcdFx0XHRjb25zdCBtb2RlbHNMaXN0ID0gcHJvdmlkZXJTZWN0aW9uLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtbW9kZWxzLWxpc3RcIiB9KTtcblxuXHRcdFx0XHRjb25zdCByZW5kZXJNb2RlbHNMaXN0ID0gKCkgPT4ge1xuXHRcdFx0XHRcdG1vZGVsc0xpc3QuZW1wdHkoKTtcblx0XHRcdFx0XHRpZiAocHJvdmlkZXIubW9kZWxzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0bW9kZWxzTGlzdC5jcmVhdGVFbChcImRpdlwiLCB7XG5cdFx0XHRcdFx0XHRcdHRleHQ6IFwiTm8gbW9kZWxzIGNvbmZpZ3VyZWQuXCIsXG5cdFx0XHRcdFx0XHRcdGNsczogXCJyYWJiaXRtYXAtbW9kZWxzLWVtcHR5XCJcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGZvciAoY29uc3QgbW9kZWwgb2YgcHJvdmlkZXIubW9kZWxzKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBpdGVtID0gbW9kZWxzTGlzdC5jcmVhdGVEaXYoeyBjbHM6IFwicmFiYml0bWFwLW1vZGVscy1pdGVtXCIgfSk7XG5cdFx0XHRcdFx0XHRpdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBtb2RlbCwgY2xzOiBcInJhYmJpdG1hcC1tb2RlbHMtbmFtZVwiIH0pO1xuXHRcdFx0XHRcdFx0Y29uc3QgcmVtb3ZlQnRuID0gaXRlbS5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHRcdFx0XHRcdHRleHQ6IFwiw5dcIixcblx0XHRcdFx0XHRcdFx0Y2xzOiBcInJhYmJpdG1hcC1tb2RlbHMtcmVtb3ZlLWJ0blwiXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdHJlbW92ZUJ0bi5vbmNsaWNrID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRwcm92aWRlci5tb2RlbHMgPSBwcm92aWRlci5tb2RlbHMuZmlsdGVyKG0gPT4gbSAhPT0gbW9kZWwpO1xuXHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHRcdFx0cmVuZGVyTW9kZWxzTGlzdCgpO1xuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0YWRkQnV0dG9uLm9uY2xpY2sgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgbmV3TW9kZWwgPSBtb2RlbElucHV0LnZhbHVlLnRyaW0oKTtcblx0XHRcdFx0XHRpZiAoIW5ld01vZGVsKSByZXR1cm47XG5cdFx0XHRcdFx0aWYgKCFwcm92aWRlci5tb2RlbHMuaW5jbHVkZXMobmV3TW9kZWwpKSB7XG5cdFx0XHRcdFx0XHRwcm92aWRlci5tb2RlbHMucHVzaChuZXdNb2RlbCk7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bW9kZWxJbnB1dC52YWx1ZSA9IFwiXCI7XG5cdFx0XHRcdFx0cmVuZGVyTW9kZWxzTGlzdCgpO1xuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdG1vZGVsSW5wdXQub25rZXlkb3duID0gKGUpID0+IHtcblx0XHRcdFx0XHRpZiAoZS5rZXkgPT09IFwiRW50ZXJcIikge1xuXHRcdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdFx0YWRkQnV0dG9uLmNsaWNrKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdHJlbmRlck1vZGVsc0xpc3QoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQWRkIG5ldyBwcm92aWRlciBidXR0b25cblx0XHRcdGNvbnN0IGFkZFByb3ZpZGVyUm93ID0gcHJvdmlkZXJzQ29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJyYWJiaXRtYXAtYWRkLXByb3ZpZGVyLXJvd1wiIH0pO1xuXHRcdFx0Y29uc3QgbmV3UHJvdmlkZXJJbnB1dCA9IGFkZFByb3ZpZGVyUm93LmNyZWF0ZUVsKFwiaW5wdXRcIiwge1xuXHRcdFx0XHR0eXBlOiBcInRleHRcIixcblx0XHRcdFx0cGxhY2Vob2xkZXI6IFwiTmV3IHByb3ZpZGVyIG5hbWUgKGUuZy4gT2xsYW1hKVwiLFxuXHRcdFx0XHRjbHM6IFwicmFiYml0bWFwLW5ldy1wcm92aWRlci1pbnB1dFwiXG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IGFkZFByb3ZpZGVyQnRuID0gYWRkUHJvdmlkZXJSb3cuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuXHRcdFx0XHR0ZXh0OiBcIkFkZCBwcm92aWRlclwiLFxuXHRcdFx0XHRjbHM6IFwicmFiYml0bWFwLWFkZC1wcm92aWRlci1idG5cIlxuXHRcdFx0fSk7XG5cblx0XHRcdGFkZFByb3ZpZGVyQnRuLm9uY2xpY2sgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IG5hbWUgPSBuZXdQcm92aWRlcklucHV0LnZhbHVlLnRyaW0oKTtcblx0XHRcdFx0aWYgKCFuYW1lKSByZXR1cm47XG5cdFx0XHRcdGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy5wcm92aWRlcnMuc29tZShwID0+IHAubmFtZSA9PT0gbmFtZSkpIHtcblx0XHRcdFx0XHRuZXcgTm90aWNlKGBQcm92aWRlciBcIiR7bmFtZX1cIiBhbHJlYWR5IGV4aXN0cy5gKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MucHJvdmlkZXJzLnB1c2goe1xuXHRcdFx0XHRcdG5hbWUsXG5cdFx0XHRcdFx0YmFzZVVybDogXCJodHRwczovL2FwaS5leGFtcGxlLmNvbS92MVwiLFxuXHRcdFx0XHRcdGFwaUtleTogXCJcIixcblx0XHRcdFx0XHRtb2RlbHM6IFtdLFxuXHRcdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdFx0YXBpRm9ybWF0OiBcIm9wZW5haVwiXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0bmV3UHJvdmlkZXJJbnB1dC52YWx1ZSA9IFwiXCI7XG5cdFx0XHRcdHJlbmRlclByb3ZpZGVycygpO1xuXHRcdFx0fTtcblx0XHR9O1xuXG5cdFx0cmVuZGVyUHJvdmlkZXJzKCk7XG5cblx0XHQvLyBIZWxwIGxpbmtzXG5cdFx0Y29udGVudEVsLmNyZWF0ZUVsKFwicFwiLCB7XG5cdFx0XHR0ZXh0OiBcIkdldCB5b3VyIEFQSSBrZXlzIGZyb206XCIsXG5cdFx0XHRjbHM6IFwicmFiYml0bWFwLXNldHRpbmdzLWluZm9cIixcblx0XHR9KTtcblxuXHRcdGNvbnN0IGxpbmtDb250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcInJhYmJpdG1hcC1zZXR0aW5ncy1saW5rc1wiIH0pO1xuXHRcdGxpbmtDb250YWluZXIuY3JlYXRlRWwoXCJhXCIsIHtcblx0XHRcdHRleHQ6IFwiT3BlbkFJIHBsYXRmb3JtXCIsXG5cdFx0XHRocmVmOiBcImh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9hcGkta2V5c1wiLFxuXHRcdH0pO1xuXHRcdGxpbmtDb250YWluZXIuY3JlYXRlRWwoXCJzcGFuXCIsIHsgdGV4dDogXCIgfCBcIiB9KTtcblx0XHRsaW5rQ29udGFpbmVyLmNyZWF0ZUVsKFwiYVwiLCB7XG5cdFx0XHR0ZXh0OiBcIk9wZW5Sb3V0ZXJcIixcblx0XHRcdGhyZWY6IFwiaHR0cHM6Ly9vcGVucm91dGVyLmFpL2tleXNcIixcblx0XHR9KTtcblx0XHRsaW5rQ29udGFpbmVyLmNyZWF0ZUVsKFwic3BhblwiLCB7IHRleHQ6IFwiIHwgXCIgfSk7XG5cdFx0bGlua0NvbnRhaW5lci5jcmVhdGVFbChcImFcIiwge1xuXHRcdFx0dGV4dDogXCJHb29nbGUgQUkgU3R1ZGlvXCIsXG5cdFx0XHRocmVmOiBcImh0dHBzOi8vYWlzdHVkaW8uZ29vZ2xlLmNvbS9hcGlrZXlcIixcblx0XHR9KTtcblx0XHRsaW5rQ29udGFpbmVyLmNyZWF0ZUVsKFwic3BhblwiLCB7IHRleHQ6IFwiIHwgXCIgfSk7XG5cdFx0bGlua0NvbnRhaW5lci5jcmVhdGVFbChcImFcIiwge1xuXHRcdFx0dGV4dDogXCJBbnRocm9waWMgY29uc29sZVwiLFxuXHRcdFx0aHJlZjogXCJodHRwczovL2NvbnNvbGUuYW50aHJvcGljLmNvbS9zZXR0aW5ncy9rZXlzXCIsXG5cdFx0fSk7XG5cdH1cblxuXHRvbkNsb3NlKCkge1xuXHRcdGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuXHRcdGNvbnRlbnRFbC5lbXB0eSgpO1xuXHR9XG59XG4iXX0=