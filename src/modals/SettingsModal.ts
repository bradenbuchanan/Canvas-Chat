import { Modal, Notice, Setting } from "obsidian";
import type { PluginSettings } from "../types";

export interface SettingsHost {
	settings: PluginSettings;
	saveSettings(): Promise<void>;
}

export class SettingsModal extends Modal {
	plugin: SettingsHost;

	constructor(app: any, plugin: SettingsHost) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("rabbitmap-settings-modal");

		contentEl.createEl("h2", { text: "Provider Settings" });

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
				toggleInput.onchange = async () => {
					provider.enabled = toggleInput.checked;
					toggleLabel.querySelector("span")!.textContent = provider.enabled ? "Enabled" : "Disabled";
					await this.plugin.saveSettings();
				};

				// Base URL setting
				new Setting(providerSection)
					.setName("Base URL")
					.setDesc("API endpoint URL (change for custom/proxy deployments)")
					.addText((text) =>
						text
							.setPlaceholder("https://api.example.com/v1")
							.setValue(provider.baseUrl)
							.onChange(async (value) => {
								provider.baseUrl = value;
								await this.plugin.saveSettings();
							})
					);

				// API Key setting
				new Setting(providerSection)
					.setName("API Key")
					.setDesc(`Enter your ${provider.name} API key`)
					.addText((text) =>
						text
							.setPlaceholder("sk-...")
							.setValue(provider.apiKey)
							.onChange(async (value) => {
								provider.apiKey = value;
								await this.plugin.saveSettings();
							})
					);

				// API Format setting
				new Setting(providerSection)
					.setName("API Format")
					.setDesc("Select the API format for this provider")
					.addDropdown((dropdown) =>
						dropdown
							.addOption("openai", "OpenAI Compatible")
							.addOption("anthropic", "Anthropic (Claude)")
							.addOption("google", "Google (Gemini)")
							.setValue(provider.apiFormat || "openai")
							.onChange(async (value) => {
								provider.apiFormat = value as "openai" | "anthropic" | "google";
								await this.plugin.saveSettings();
							})
					);

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
						removeBtn.onclick = async () => {
							provider.models = provider.models.filter(m => m !== model);
							await this.plugin.saveSettings();
							renderModelsList();
						};
					}
				};

				addButton.onclick = async () => {
					const newModel = modelInput.value.trim();
					if (!newModel) return;
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

			// Add new provider button
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
				if (!name) return;
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
				await this.plugin.saveSettings();
				newProviderInput.value = "";
				renderProviders();
			};
		};

		renderProviders();

		// Help links
		contentEl.createEl("p", {
			text: "Get your API keys from:",
			cls: "rabbitmap-settings-info",
		});

		const linkContainer = contentEl.createDiv({ cls: "rabbitmap-settings-links" });
		linkContainer.createEl("a", {
			text: "OpenAI Platform",
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
			text: "Anthropic Console",
			href: "https://console.anthropic.com/settings/keys",
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
