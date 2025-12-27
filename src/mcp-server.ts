// @ts-nocheck
import { FastMCP } from "fastmcp";
import { z } from "zod";
import { App, Notice, TFile, TFolder, MarkdownView, normalizePath } from "obsidian";
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
					"Gets the currently active file in Obsidian. Set include_content=true to also get file content.",
				parameters: z.object({
					include_content: z
						.boolean()
						.optional()
						.default(false)
						.describe("Include file content in response."),
				}),
				execute: async (input: { include_content?: boolean }) => {
					try {
						const activeFile = this.app.workspace.getActiveFile();
						if (!activeFile) {
							return JSON.stringify({ error: "No active file", active: false });
						}
						const result: any = {
							active: true,
							path: activeFile.path,
							name: activeFile.name,
							basename: activeFile.basename,
							extension: activeFile.extension,
						};
						if (input.include_content) {
							result.content = await this.app.vault.read(activeFile);
						}
						return JSON.stringify(result);
					} catch (error: any) {
						console.error("Error getting active file:", error);
						return JSON.stringify({ error: `Failed: ${error.message}` });
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

		// ============ MetadataCache Tools ============

		if (this.settings.tools.get_file_metadata) {
			this.server.addTool({
				name: "get_file_metadata",
				description:
					"Gets metadata for a file including frontmatter, tags, headings, and links. Uses Obsidian's MetadataCache for accurate, real-time data.",
				parameters: z.object({
					relative_path: z
						.string()
						.describe("Relative path to the markdown file."),
				}),
				execute: async (input: { relative_path: string }) => {
					try {
						const path = normalizePath(input.relative_path);
						const file = this.app.vault.getAbstractFileByPath(path);

						if (!file || !(file instanceof TFile)) {
							return JSON.stringify({
								error: `File not found: ${input.relative_path}`,
							});
						}

						const cache = this.app.metadataCache.getFileCache(file);
						if (!cache) {
							return JSON.stringify({
								error: "No cached metadata available for this file",
							});
						}

						return JSON.stringify({
							path: file.path,
							frontmatter: cache.frontmatter || null,
							tags: cache.tags?.map(t => t.tag) || [],
							headings: cache.headings?.map(h => ({
								heading: h.heading,
								level: h.level,
								line: h.position.start.line,
							})) || [],
							links: cache.links?.map(l => ({
								link: l.link,
								displayText: l.displayText,
								line: l.position.start.line,
							})) || [],
							embeds: cache.embeds?.map(e => ({
								link: e.link,
								displayText: e.displayText,
								line: e.position.start.line,
							})) || [],
							listItems: cache.listItems?.length || 0,
							sections: cache.sections?.length || 0,
						});
					} catch (error: any) {
						console.error("Error getting file metadata:", error);
						return JSON.stringify({
							error: `Failed to get file metadata: ${error.message}`,
						});
					}
				},
			});
		}

		if (this.settings.tools.get_links) {
			this.server.addTool({
				name: "get_links",
				description:
					"Gets links for a file. direction='incoming' for backlinks, 'outgoing' for forward links, 'both' for all.",
				parameters: z.object({
					relative_path: z.string().describe("Path to the file."),
					direction: z
						.enum(["incoming", "outgoing", "both"])
						.default("both")
						.describe("Link direction to retrieve."),
				}),
				execute: async (input: { relative_path: string; direction: "incoming" | "outgoing" | "both" }) => {
					try {
						const path = normalizePath(input.relative_path);
						const file = this.app.vault.getAbstractFileByPath(path);

						if (!file || !(file instanceof TFile)) {
							return JSON.stringify({ error: `File not found: ${input.relative_path}` });
						}

						const result: any = { path: file.path };

						// Incoming links (backlinks)
						if (input.direction === "incoming" || input.direction === "both") {
							const backlinks: { path: string; count: number }[] = [];
							for (const [sourcePath, links] of Object.entries(this.app.metadataCache.resolvedLinks)) {
								if (links[file.path]) {
									backlinks.push({ path: sourcePath, count: links[file.path] });
								}
							}
							result.incoming = backlinks;
						}

						// Outgoing links
						if (input.direction === "outgoing" || input.direction === "both") {
							const resolved = this.app.metadataCache.resolvedLinks[file.path] || {};
							const unresolved = this.app.metadataCache.unresolvedLinks[file.path] || {};
							result.outgoing = {
								resolved: Object.entries(resolved).map(([target, count]) => ({ target, count })),
								unresolved: Object.entries(unresolved).map(([target, count]) => ({ target, count })),
							};
						}

						return JSON.stringify(result);
					} catch (error: any) {
						console.error("Error getting links:", error);
						return JSON.stringify({ error: `Failed: ${error.message}` });
					}
				},
			});
		}

		// ============ Workspace Tools ============

		if (this.settings.tools.get_open_files) {
			this.server.addTool({
				name: "get_open_files",
				description:
					"Gets all currently open files in Obsidian tabs. Useful for understanding user's current working context.",
				parameters: z.object({}),
				execute: async () => {
					try {
						const leaves = this.app.workspace.getLeavesOfType("markdown");
						const openFiles = leaves
							.map((leaf) => {
								const view = leaf.view;
								if (view instanceof MarkdownView && view.file) {
									return {
										path: view.file.path,
										name: view.file.name,
										isActive: leaf === this.app.workspace.activeLeaf,
									};
								}
								return null;
							})
							.filter(Boolean);

						return JSON.stringify({
							openFiles: openFiles,
							count: openFiles.length,
						});
					} catch (error: any) {
						console.error("Error getting open files:", error);
						return JSON.stringify({
							error: `Failed to get open files: ${error.message}`,
						});
					}
				},
			});
		}

		// ============ Command Tools ============

		if (this.settings.tools.list_commands) {
			this.server.addTool({
				name: "list_commands",
				description:
					"Lists all available Obsidian commands. Use with execute_command to automate Obsidian actions.",
				parameters: z.object({
					filter: z
						.string()
						.optional()
						.describe("Optional filter string to search command names/IDs."),
				}),
				execute: async (input: { filter?: string }) => {
					try {
						// @ts-ignore - commands is internal API
						const allCommands = this.app.commands.listCommands();
						let commands = allCommands.map((cmd: any) => ({
							id: cmd.id,
							name: cmd.name,
						}));

						if (input.filter) {
							const filter = input.filter.toLowerCase();
							commands = commands.filter(
								(cmd: any) =>
									cmd.id.toLowerCase().includes(filter) ||
									cmd.name.toLowerCase().includes(filter)
							);
						}

						return JSON.stringify({
							commands: commands,
							count: commands.length,
							totalAvailable: allCommands.length,
						});
					} catch (error: any) {
						console.error("Error listing commands:", error);
						return JSON.stringify({
							error: `Failed to list commands: ${error.message}`,
						});
					}
				},
			});
		}

		if (this.settings.tools.execute_command) {
			this.server.addTool({
				name: "execute_command",
				description:
					"⚠️ POTENTIALLY DANGEROUS: Executes an Obsidian command by ID. Some commands may modify files, delete content, or change settings. Use list_commands first to find command IDs. Always verify the command is safe before executing.",
				parameters: z.object({
					command_id: z
						.string()
						.describe("The command ID to execute (e.g., 'editor:toggle-bold', 'app:reload')."),
				}),
				execute: async (input: { command_id: string }) => {
					try {
						// @ts-ignore - commands is internal API
						const command = this.app.commands.commands[input.command_id];
						if (!command) {
							return JSON.stringify({
								error: `Command not found: ${input.command_id}`,
								hint: "Use list_commands to find available command IDs.",
							});
						}

						// @ts-ignore
						const result = this.app.commands.executeCommandById(input.command_id);

						return JSON.stringify({
							success: true,
							commandId: input.command_id,
							commandName: command.name,
						});
					} catch (error: any) {
						console.error("Error executing command:", error);
						return JSON.stringify({
							error: `Failed to execute command: ${error.message}`,
						});
					}
				},
			});
		}

		// ============ FileManager Tools ============

		if (this.settings.tools.rename_file) {
			this.server.addTool({
				name: "rename_file",
				description:
					"⚠️ MODIFIES MULTIPLE FILES: Renames a file and automatically updates ALL links pointing to it across the vault. Safer than manual rename. The new path should include the file extension.",
				parameters: z.object({
					old_path: z
						.string()
						.describe("Current relative path of the file."),
					new_path: z
						.string()
						.describe("New relative path for the file (including extension)."),
				}),
				execute: async (input: { old_path: string; new_path: string }) => {
					try {
						const oldPath = normalizePath(input.old_path);
						const newPath = normalizePath(input.new_path);

						const file = this.app.vault.getAbstractFileByPath(oldPath);
						if (!file) {
							return JSON.stringify({
								error: `File not found: ${input.old_path}`,
							});
						}

						// Count how many files link to this file before rename
						const backlinks = Object.entries(this.app.metadataCache.resolvedLinks)
							.filter(([_, links]) => links[oldPath])
							.length;

						await this.app.fileManager.renameFile(file, newPath);

						return JSON.stringify({
							success: true,
							oldPath: oldPath,
							newPath: newPath,
							linksUpdated: backlinks,
							message: `File renamed. ${backlinks} file(s) with links to this file were automatically updated.`,
						});
					} catch (error: any) {
						console.error("Error renaming file:", error);
						return JSON.stringify({
							error: `Failed to rename file: ${error.message}`,
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
