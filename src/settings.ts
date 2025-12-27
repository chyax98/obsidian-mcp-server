import ObsidianMCPServer from "main";
import {
	App,
	PluginSettingTab,
	Setting,
	Notice,
} from "obsidian";

export interface ObsidianMCPServerPluginSettings {
	port: number;
	startOnStartup: boolean;
	tools: {
		// 文件操作
		list_files: boolean;
		read_file: boolean;
		create_file: boolean;
		edit_file: boolean;
		delete_file: boolean;
		create_folder: boolean;
		delete_folder: boolean;
		// Obsidian 原生 API
		get_active_file: boolean;
		get_active_file_path: boolean;
		open_file: boolean;
		get_selection: boolean;
		insert_text: boolean;
		get_vault_info: boolean;
		search_vault: boolean;
	};
}

export const DEFAULT_SETTINGS: ObsidianMCPServerPluginSettings = {
	port: 8080,
	startOnStartup: false,
	tools: {
		// 文件操作
		list_files: true,
		read_file: true,
		create_file: true,
		edit_file: true,
		delete_file: true,
		create_folder: true,
		delete_folder: true,
		// Obsidian 原生 API
		get_active_file: true,
		get_active_file_path: true,
		open_file: true,
		get_selection: true,
		insert_text: true,
		get_vault_info: true,
		search_vault: true,
	},
};

export class ObsidianMCPServerSettingTab extends PluginSettingTab {
	plugin: ObsidianMCPServer;

	constructor(app: App, plugin: ObsidianMCPServer) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// ============ 服务器设置 ============
		new Setting(containerEl)
			.setName(this.plugin.t("settings.server.heading"))
			.setHeading();

		new Setting(containerEl)
			.setName(this.plugin.t("settings.port.name"))
			.setDesc(this.plugin.t("settings.port.desc"))
			.addText((text) =>
				text
					.setPlaceholder("8080")
					.setValue(this.plugin.settings.port.toString())
					.onChange(async (value) => {
						const port = parseInt(value);
						if (!isNaN(port) && port > 0 && port < 65536) {
							this.plugin.settings.port = port;
							await this.plugin.saveSettings();
						} else {
							new Notice(
								this.plugin.t("settings.notices.invalidPort")
							);
						}
					})
			);

		new Setting(containerEl)
			.setName(this.plugin.t("settings.autoStart.name"))
			.setDesc(this.plugin.t("settings.autoStart.desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.startOnStartup)
					.onChange(async (value) => {
						this.plugin.settings.startOnStartup = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(this.plugin.t("settings.mcpEndpoint.name"))
			.setDesc(`http://localhost:${this.plugin.settings.port}/sse`)
			.addButton((button) => {
				button
					.setButtonText(this.plugin.t("settings.buttons.copy"))
					.onClick(() => {
						navigator.clipboard.writeText(
							`http://localhost:${this.plugin.settings.port}/sse`
						);
						new Notice(
							this.plugin.t("settings.notices.endpointCopied")
						);
					});
			});

		new Setting(containerEl)
			.addButton((button) => {
				button
					.setButtonText(
						this.plugin.t("settings.buttons.restartMCPServer")
					)
					.onClick(async () => {
						try {
							await this.plugin.restartMCPServer();
							new Notice(
								this.plugin.t("settings.notices.restartSuccess")
							);
						} catch (error: any) {
							console.error("MCP Server restart error:", error);
							new Notice(
								this.plugin.t("settings.notices.restartError", {
									error: error?.message || String(error),
								})
							);
						}
					});
			});

		// ============ 文件操作工具 ============
		new Setting(containerEl)
			.setName(this.plugin.t("settings.tools.fileOps.heading"))
			.setHeading();

		this.addToolToggle(containerEl, "list_files", "列出目录下的文件和文件夹");
		this.addToolToggle(containerEl, "read_file", "读取文件内容");
		this.addToolToggle(containerEl, "create_file", "创建新文件");
		this.addToolToggle(containerEl, "edit_file", "编辑文件内容");
		this.addToolToggle(containerEl, "delete_file", "删除文件");
		this.addToolToggle(containerEl, "create_folder", "创建文件夹");
		this.addToolToggle(containerEl, "delete_folder", "删除文件夹");

		// ============ Obsidian 原生 API 工具 ============
		new Setting(containerEl)
			.setName(this.plugin.t("settings.tools.nativeApi.heading"))
			.setHeading();

		this.addToolToggle(containerEl, "get_active_file", "获取当前活动文件（含内容）");
		this.addToolToggle(containerEl, "get_active_file_path", "获取当前文件路径（轻量）");
		this.addToolToggle(containerEl, "open_file", "在编辑器中打开文件");
		this.addToolToggle(containerEl, "get_selection", "获取选中的文本");
		this.addToolToggle(containerEl, "insert_text", "在光标处插入文本");
		this.addToolToggle(containerEl, "get_vault_info", "获取 Vault 信息");
		this.addToolToggle(containerEl, "search_vault", "按文件名搜索");

		// ============ 重启提示 ============
		new Setting(containerEl)
			.setDesc(this.plugin.t("settings.buttons.restartHint"));
	}

	private addToolToggle(
		containerEl: HTMLElement,
		toolName: keyof ObsidianMCPServerPluginSettings["tools"],
		description: string
	) {
		new Setting(containerEl)
			.setName(toolName)
			.setDesc(description)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.tools[toolName])
					.onChange(async (value) => {
						this.plugin.settings.tools[toolName] = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
