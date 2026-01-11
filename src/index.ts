#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Initial configuration
if (process.argv.length > 2) {
    const targetDir = process.argv[2];
    try {
        process.chdir(targetDir);
        console.error(`Changed working directory to: ${targetDir}`);
    } catch (err) {
        console.error(`Failed to change working directory to ${targetDir}:`, err);
    }
}

const server = new Server(
    {
        name: "codeagent",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

const TOOLS: Tool[] = [
    {
        name: "read_file",
        description: "Read the contents of a file",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the file" },
            },
            required: ["path"],
        },
    },
    {
        name: "write_file",
        description: "Write content to a file",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the file" },
                content: { type: "string", description: "Content to write" },
            },
            required: ["path", "content"],
        },
    },
    {
        name: "list_files",
        description: "List files in a directory",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the directory" },
            },
            required: ["path"],
        },
    },
    {
        name: "run_command",
        description: "Execute a shell command",
        inputSchema: {
            type: "object",
            properties: {
                command: { type: "string", description: "The command to run" },
                cwd: { type: "string", description: "The working directory" },
            },
            required: ["command"],
        },
    },
    {
        name: "grep_search",
        description: "Search for a pattern in files",
        inputSchema: {
            type: "object",
            properties: {
                pattern: { type: "string", description: "The regex pattern to search for" },
                path: { type: "string", description: "The directory to search in" },
            },
            required: ["pattern", "path"],
        },
    },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: TOOLS,
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case "read_file": {
                const { path: filePath } = z.object({ path: z.string() }).parse(args);
                const content = await fs.readFile(filePath, "utf-8");
                return { content: [{ type: "text", text: content }] };
            }
            case "write_file": {
                const { path: filePath, content } = z
                    .object({ path: z.string(), content: z.string() })
                    .parse(args);
                await fs.mkdir(path.dirname(filePath), { recursive: true });
                await fs.writeFile(filePath, content, "utf-8");
                return { content: [{ type: "text", text: `File written to ${filePath}` }] };
            }
            case "list_files": {
                const { path: dirPath } = z.object({ path: z.string() }).parse(args);
                const files = await fs.readdir(dirPath, { withFileTypes: true });
                const list = files
                    .map((f) => `${f.isDirectory() ? "[DIR]" : "[FILE]"} ${f.name}`)
                    .join("\n");
                return { content: [{ type: "text", text: list }] };
            }
            case "run_command": {
                const { command, cwd } = z
                    .object({ command: z.string(), cwd: z.string().optional() })
                    .parse(args);
                const { stdout, stderr } = await execAsync(command, { cwd: cwd || process.cwd() });
                return {
                    content: [
                        { type: "text", text: `STDOUT:\n${stdout}\nSTDERR:\n${stderr}` },
                    ],
                };
            }
            case "grep_search": {
                const { pattern, path: searchPath } = z
                    .object({ pattern: z.string(), path: z.string() })
                    .parse(args);
                // Simple grep implementation using shell
                const { stdout } = await execAsync(`grep -rnE "${pattern}" .`, { cwd: searchPath });
                return { content: [{ type: "text", text: stdout || "No matches found." }] };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error: any) {
        return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true,
        };
    }
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("CodeAgent MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
