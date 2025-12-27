// @ts-nocheck
import { FastMCP } from "fastmcp";
import { z } from "zod";
import { App, Notice } from "obsidian";
import { listFilesTool } from "./tools/list_files.js";
import { readFileTool } from "./tools/read_file.js";
import { createFileTool } from "./tools/create_files.js";
import { editFileTool, editFileParametersSchema } from "./tools/edit_file.js";
import { deleteFileTool } from "./tools/delete_file.js";
import { createFolderTool } from "./tools/create_folder.js";
import { deleteFolderTool } from "./tools/delete_folder.js";

type TFunction = (key: string, params?: Record<string, string>) => string;

export class MCPServer {
	private server: FastMCP;
	private port: number;
	private settings: any;
	private t: TFunction;

	constructor(
		private app: App,
		port: number,
		settings: any,
		t: TFunction
	) {
		this.port = port;
		this.settings = settings;
		this.t = t;

		this.server = new FastMCP({
			name: "Obsidian MCP Server",
			version: "2.0.0",
		});

		this.setupTools();
	}

	start() {
		try {
			this.server.on("error", (error: any) => {
				console.error("MCP Server error:", error);
				if (error.code !== -32001) {
					new Notice(
						this.t("server.genericError", { error: error.message })
					);
				}
			});

			this.server.start({
				transportType: "httpStream",
				httpStream: {
					port: this.port,
				},
			});
		} catch (error: any) {
			console.error("Error starting MCP server:", error);
			new Notice(this.t("server.startError", { port: this.port.toString() }));
			throw error;
		}
	}

	setupTools() {
		// ============ File Operations ============

		if (this.settings.tools.list_files) {
			this.server.addTool({
				name: "list_files",
				description:
					"Lists files and sub-folders within a specified directory of your Obsidian Vault. Use '.' for the vault root.",
				parameters: z.object({
					relative_path: z
						.string()
						.describe("Relative path to the root of the Obsidian vault.")
						.default("."),
				}),
				execute: async (input: { relative_path?: string }) => {
					try {
						return await listFilesTool(
							this.app,
							input.relative_path || "."
						);
					} catch (error) {
						console.error("Error listing files:", error);
						return JSON.stringify({
							error: "Failed to list files. See console for details.",
						});
					}
				},
			});
		}

		if (this.settings.tools.read_file) {
			this.server.addTool({
				name: "read_file",
				description:
					"Reads the full content of a specific note or file within your Obsidian Vault.",
				parameters: z.object({
					relative_path: z
						.string()
						.describe("Relative path to the file."),
					line_number: z
						.boolean()
						.optional()
						.describe("Whether to include line numbers in the output."),
				}),
				execute: async (input: {
					relative_path: string;
					line_number?: boolean;
				}) => {
					try {
						return await readFileTool(
							this.app,
							input.relative_path,
							input.line_number
						);
					} catch (error) {
						console.error("Error reading file:", error);
						return JSON.stringify({
							error: "Failed to read file. See console for details.",
						});
					}
				},
			});
		}

		if (this.settings.tools.create_file) {
			this.server.addTool({
				name: "create_file",
				description:
					"Creates a new file with the specified content at the given path within your Obsidian Vault.",
				parameters: z.object({
					relative_path: z
						.string()
						.describe("Relative path to the file."),
					content: z
						.string()
						.describe("Content to write to the file."),
				}),
				execute: async (input: {
					relative_path: string;
					content: string;
				}) => {
					try {
						return await createFileTool(
							this.app,
							input.relative_path,
							input.content
						);
					} catch (error) {
						console.error("Error writing file:", error);
						return JSON.stringify({
							error: "Failed to write file. See console for details.",
						});
					}
				},
			});
		}

		if (this.settings.tools.edit_file) {
			this.server.addTool({
				name: "edit_file",
				description:
					"Edits a specific range of lines within a file in your Obsidian Vault.",
				parameters: editFileParametersSchema,
				execute: async (input: any) => {
					try {
						const validatedInput = editFileParametersSchema.parse(input);
						return await editFileTool(this.app, validatedInput);
					} catch (error: any) {
						console.error("Error editing file via tool:", error);
						if (error instanceof z.ZodError) {
							return JSON.stringify({
								error: "Invalid parameters provided.",
								details: error.errors,
							});
						}
						return JSON.stringify({
							error: `Failed to execute edit_file tool: ${error.message || error}`,
						});
					}
				},
			});
		}

		if (this.settings.tools.delete_file) {
			this.server.addTool({
				name: "delete_file",
				description:
					"Deletes a file within your Obsidian Vault. Use with caution.",
				parameters: z.object({
					relative_path: z
						.string()
						.describe("Relative path to the file."),
				}),
				execute: async (input: { relative_path: string }) => {
					try {
						return await deleteFileTool(this.app, input.relative_path);
					} catch (error) {
						console.error("Error deleting file:", error);
						return JSON.stringify({
							error: "Failed to delete file. See console for details.",
						});
					}
				},
			});
		}

		if (this.settings.tools.create_folder) {
			this.server.addTool({
				name: "create_folder",
				description:
					"Creates a folder within your Obsidian Vault.",
				parameters: z.object({
					relative_path: z
						.string()
						.describe("Relative path to the folder."),
				}),
				execute: async (input: { relative_path: string }) => {
					try {
						await createFolderTool(this.app, input.relative_path);
						new Notice(
							this.t("server.folderCreated", {
								path: input.relative_path,
							})
						);
						return JSON.stringify({
							success: "Folder created successfully.",
						});
					} catch (error) {
						console.error("Error creating folder:", error);
						return JSON.stringify({
							error: "Failed to create folder. See console for details.",
						});
					}
				},
			});
		}

		if (this.settings.tools.delete_folder) {
			this.server.addTool({
				name: "delete_folder",
				description:
					"Deletes a folder within your Obsidian Vault. Use with extreme caution.",
				parameters: z.object({
					relative_path: z
						.string()
						.describe("Relative path to the folder."),
					force: z
						.boolean()
						.describe("Whether to force delete even if not empty.")
						.default(false),
				}),
				execute: async (input: {
					relative_path: string;
					force: boolean;
				}) => {
					try {
						return await deleteFolderTool(
							this.app,
							input.relative_path,
							input.force
						);
					} catch (error) {
						console.error("Error deleting folder:", error);
						return JSON.stringify({
							error: "Failed to delete folder. See console for details.",
						});
					}
				},
			});
		}

		// ============ Obsidian Native API Tools ============

		if (this.settings.tools.get_active_file) {
			this.server.addTool({
				name: "get_active_file",
				description:
					"Gets the currently active/focused file in Obsidian. Returns the file path and content.",
				parameters: z.object({}),
				execute: async () => {
					try {
						const activeFile = this.app.workspace.getActiveFile();
						if (!activeFile) {
							return JSON.stringify({
								error: "No active file",
								active: false,
							});
						}
						const content = await this.app.vault.read(activeFile);
						return JSON.stringify({
							active: true,
							path: activeFile.path,
							name: activeFile.name,
							basename: activeFile.basename,
							extension: activeFile.extension,
							content: content,
						});
					} catch (error: any) {
						console.error("Error getting active file:", error);
						return JSON.stringify({
							error: `Failed to get active file: ${error.message}`,
						});
					}
				},
			});
		}

		if (this.settings.tools.get_active_file_path) {
			this.server.addTool({
				name: "get_active_file_path",
				description:
					"Gets only the path of the currently active file (without content). Lightweight alternative to get_active_file.",
				parameters: z.object({}),
				execute: async () => {
					try {
						const activeFile = this.app.workspace.getActiveFile();
						if (!activeFile) {
							return JSON.stringify({
								error: "No active file",
								active: false,
							});
						}
						return JSON.stringify({
							active: true,
							path: activeFile.path,
							name: activeFile.name,
							basename: activeFile.basename,
							extension: activeFile.extension,
						});
					} catch (error: any) {
						console.error("Error getting active file path:", error);
						return JSON.stringify({
							error: `Failed to get active file path: ${error.message}`,
						});
					}
				},
			});
		}

		if (this.settings.tools.open_file) {
			this.server.addTool({
				name: "open_file",
				description:
					"Opens a file in Obsidian editor. Optionally navigate to a specific line.",
				parameters: z.object({
					relative_path: z
						.string()
						.describe("Relative path to the file to open."),
					line: z
						.number()
						.optional()
						.describe("Line number to navigate to (1-based)."),
					new_leaf: z
						.boolean()
						.optional()
						.describe("Whether to open in a new tab."),
				}),
				execute: async (input: {
					relative_path: string;
					line?: number;
					new_leaf?: boolean;
				}) => {
					try {
						const file = this.app.vault.getAbstractFileByPath(input.relative_path);
						if (!file) {
							return JSON.stringify({
								error: `File not found: ${input.relative_path}`,
							});
						}

						const leaf = this.app.workspace.getLeaf(input.new_leaf ?? false);
						await leaf.openFile(file as any);

						// Navigate to line if specified
						if (input.line !== undefined) {
							const view = this.app.workspace.getActiveViewOfType(
								(this.app as any).workspace.getViewType?.("markdown") || null
							);
							if (view && (view as any).editor) {
								(view as any).editor.setCursor({ line: input.line - 1, ch: 0 });
							}
						}

						return JSON.stringify({
							success: true,
							path: input.relative_path,
							line: input.line,
						});
					} catch (error: any) {
						console.error("Error opening file:", error);
						return JSON.stringify({
							error: `Failed to open file: ${error.message}`,
						});
					}
				},
			});
		}

		if (this.settings.tools.get_selection) {
			this.server.addTool({
				name: "get_selection",
				description:
					"Gets the currently selected text in the active editor.",
				parameters: z.object({}),
				execute: async () => {
					try {
						const activeView = this.app.workspace.getActiveViewOfType(
							(this.app as any).workspace.getViewType?.("markdown") || null
						) as any;

						if (!activeView || !activeView.editor) {
							return JSON.stringify({
								error: "No active markdown editor",
								hasSelection: false,
							});
						}

						const editor = activeView.editor;
						const selection = editor.getSelection();

						if (!selection) {
							return JSON.stringify({
								hasSelection: false,
								selection: "",
							});
						}

						return JSON.stringify({
							hasSelection: true,
							selection: selection,
							from: editor.getCursor("from"),
							to: editor.getCursor("to"),
						});
					} catch (error: any) {
						console.error("Error getting selection:", error);
						return JSON.stringify({
							error: `Failed to get selection: ${error.message}`,
						});
					}
				},
			});
		}

		if (this.settings.tools.insert_text) {
			this.server.addTool({
				name: "insert_text",
				description:
					"Inserts text at the current cursor position or replaces the current selection.",
				parameters: z.object({
					text: z.string().describe("Text to insert."),
				}),
				execute: async (input: { text: string }) => {
					try {
						const activeView = this.app.workspace.getActiveViewOfType(
							(this.app as any).workspace.getViewType?.("markdown") || null
						) as any;

						if (!activeView || !activeView.editor) {
							return JSON.stringify({
								error: "No active markdown editor",
							});
						}

						const editor = activeView.editor;
						editor.replaceSelection(input.text);

						return JSON.stringify({
							success: true,
							insertedLength: input.text.length,
						});
					} catch (error: any) {
						console.error("Error inserting text:", error);
						return JSON.stringify({
							error: `Failed to insert text: ${error.message}`,
						});
					}
				},
			});
		}

		if (this.settings.tools.get_vault_info) {
			this.server.addTool({
				name: "get_vault_info",
				description:
					"Gets information about the current Obsidian vault.",
				parameters: z.object({}),
				execute: async () => {
					try {
						const vault = this.app.vault;
						const files = vault.getMarkdownFiles();
						const allFiles = vault.getAllLoadedFiles();

						return JSON.stringify({
							name: vault.getName(),
							totalMarkdownFiles: files.length,
							totalFiles: allFiles.length,
							configDir: vault.configDir,
						});
					} catch (error: any) {
						console.error("Error getting vault info:", error);
						return JSON.stringify({
							error: `Failed to get vault info: ${error.message}`,
						});
					}
				},
			});
		}

		if (this.settings.tools.search_vault) {
			this.server.addTool({
				name: "search_vault",
				description:
					"Searches for files in the vault by name pattern (simple string matching, not regex).",
				parameters: z.object({
					query: z.string().describe("Search query to match against file names."),
					include_content: z
						.boolean()
						.optional()
						.describe("Whether to include file content in results (slower)."),
					limit: z
						.number()
						.optional()
						.describe("Maximum number of results to return.")
						.default(20),
				}),
				execute: async (input: {
					query: string;
					include_content?: boolean;
					limit?: number;
				}) => {
					try {
						const files = this.app.vault.getMarkdownFiles();
						const query = input.query.toLowerCase();
						const limit = input.limit || 20;

						const matches = files
							.filter((f) => f.path.toLowerCase().includes(query))
							.slice(0, limit);

						const results = await Promise.all(
							matches.map(async (f) => {
								const result: any = {
									path: f.path,
									name: f.name,
									basename: f.basename,
								};
								if (input.include_content) {
									result.content = await this.app.vault.read(f);
								}
								return result;
							})
						);

						return JSON.stringify({
							query: input.query,
							count: results.length,
							results: results,
						});
					} catch (error: any) {
						console.error("Error searching vault:", error);
						return JSON.stringify({
							error: `Failed to search vault: ${error.message}`,
						});
					}
				},
			});
		}
	}

	stop() {
		try {
			this.server.stop();
		} catch (error) {
			console.error("Error stopping MCP server:", error);
			new Notice(this.t("server.stopError"));
		}
	}
}
