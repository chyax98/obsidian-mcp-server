import { Notice, Plugin, getLanguage } from "obsidian";

interface Translation {
	commands: Record<string, string>;
	notices: Record<string, string>;
	ribbonTooltip: string;
	serverStatus: {
		running: string;
		stopped: string;
	};
	[key: string]: any;
}

interface Translations {
	en: Translation;
	zh?: Translation;
}

import { MCPServer } from "./src/mcp-server.js";
import {
	ObsidianMCPServerPluginSettings,
	DEFAULT_SETTINGS,
	ObsidianMCPServerSettingTab,
} from "./src/settings";

export default class ObsidianMCPServer extends Plugin {
	settings: ObsidianMCPServerPluginSettings;
	private mcpServer?: MCPServer;
	private translations: Translations = { en: {} as Translation };
	private currentLanguage = "en";

	async loadTranslations() {
		const lang = getLanguage() || "en";
		this.currentLanguage = ["en", "zh"].includes(lang) ? lang : "en";

		try {
			const enTranslations: Translation = (
				await import("./locales/en.json")
			).default;
			this.translations.en = enTranslations;

			if (this.currentLanguage === "zh") {
				const zhTranslations: Translation = (
					await import("./locales/zh.json")
				).default;
				this.translations.zh = zhTranslations;
			}
		} catch (error) {
			console.error("Failed to load translations:", error);
		}
	}

	t(key: string, params: Record<string, string> = {}): string {
		const keys = key.split(".");

		const findTranslation = (
			langTranslations: Translation | undefined
		): string | undefined => {
			if (!langTranslations) return undefined;
			let current: any = langTranslations;
			for (const k of keys) {
				if (current && typeof current === "object" && k in current) {
					current = current[k];
				} else {
					return undefined;
				}
			}
			return typeof current === "string" ? current : undefined;
		};

		const lang = this.currentLanguage as keyof Translations;
		let translation = findTranslation(this.translations[lang]);

		if (translation === undefined && lang !== "en") {
			translation = findTranslation(this.translations.en);
		}

		translation = translation ?? key;

		return Object.entries(params).reduce(
			(str, [k, v]) => str.replace(`{${k}}`, v),
			translation
		);
	}

	async onload() {
		await this.loadSettings();
		await this.loadTranslations();

		if (this.settings.startOnStartup) {
			this.startMCPServer();
		}

		this.addCommand({
			id: "start-mcp-server",
			name: this.t("commands.start-mcp-server"),
			callback: () => {
				if (!this.mcpServer) {
					this.startMCPServer();
				} else {
					new Notice(this.t("notices.serverAlreadyRunning"));
				}
			},
		});

		this.addCommand({
			id: "stop-mcp-server",
			name: this.t("commands.stop-mcp-server"),
			callback: () => {
				this.stopMCPServer();
			},
		});

		const ribbonIconEl = this.addRibbonIcon(
			"server",
			this.t("ribbonTooltip"),
			(evt: MouseEvent) => {
				if (this.mcpServer) {
					new Notice(this.t("notices.serverRunning"));
				} else {
					new Notice(this.t("serverStatus.stopped"));
				}
			}
		);
		ribbonIconEl.addClass("mcp-server-ribbon-class");

		this.addSettingTab(
			new ObsidianMCPServerSettingTab(this.app, this)
		);
	}

	async onunload() {
		this.stopMCPServer();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private startMCPServer() {
		if (this.mcpServer) {
			new Notice(this.t("notices.serverAlreadyRunning"));
			return;
		}

		try {
			this.mcpServer = new MCPServer(
				this.app,
				this.settings.port,
				this.settings,
				this.t.bind(this)
			);
			this.mcpServer.start();
			new Notice(
				this.t("notices.serverStarted", {
					port: this.settings.port.toString(),
				})
			);
		} catch (error: any) {
			console.error("Failed to start MCP Server:", error);
			new Notice(
				this.t("notices.serverStartFailed", { error: error.message })
			);
			this.mcpServer = undefined;
		}
	}

	private stopMCPServer() {
		if (this.mcpServer) {
			this.mcpServer.stop();
			this.mcpServer = undefined;
			new Notice(this.t("notices.serverStopped"));
		} else {
			new Notice(this.t("notices.serverAlreadyStopped"));
		}
	}

	async restartMCPServer() {
		this.stopMCPServer();
		await new Promise((resolve) => setTimeout(resolve, 500));
		this.startMCPServer();
	}
}
