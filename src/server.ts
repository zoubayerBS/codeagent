import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
    CallToolResultSchema,
    ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import OpenAI from "openai";
import { join } from "path";
import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import "dotenv/config";

const apiKey = process.env.LLM_API_KEY;
const baseURL = process.env.LLM_BASE_URL || "https://router.huggingface.co/v1";
const model = process.env.LLM_MODEL || "meta-llama/Llama-3.3-70B-Instruct";

if (!apiKey) {
    console.error("Error: LLM_API_KEY is not set. Please check your .env file.");
    process.exit(1);
}

const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
});

// Express setup
const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.static(join(__dirname, "../public")));

// MCP Client setup
const transport = new StdioClientTransport({
    command: "node",
    args: [join(__dirname, "index.js")],
});

const client = new Client(
    {
        name: "llama-web-orchestrator",
        version: "1.0.0",
    },
    {
        capabilities: {},
    }
);

let tools: any[] = [];

// Initialize MCP connection
async function initializeMCP() {
    console.log("Connecting to CodeAgent MCP Server...");
    await client.connect(transport);
    console.log("Connected! Fetching tools...");

    const listToolsResult = await client.request(
        { method: "tools/list" },
        ListToolsResultSchema
    );

    tools = listToolsResult.tools.map((tool) => ({
        type: "function" as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
        },
    }));

    console.log(`Available tools: ${listToolsResult.tools.map(t => t.name).join(", ")}`);
}

// Socket.io connection handling
io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    const messages: any[] = [
        {
            role: "system",
            content:
                "You are a helpful coding assistant called CodeAgent. You have access to tools to read, write, and search files, and run commands. Use them to help the user with their coding tasks. Always respond in French.",
        },
    ];

    socket.on("message", async (userMessage: string) => {
        try {
            messages.push({ role: "user", content: userMessage });

            let response = await openai.chat.completions.create({
                model: model,
                messages: messages,
                tools: tools,
            });

            let choice = response.choices[0];

            // Handle tool calls
            while (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
                messages.push(choice.message);

                for (const toolCall of choice.message.tool_calls) {
                    const func = (toolCall as any).function;

                    // Emit tool call to client
                    socket.emit("tool_call", {
                        name: func.name,
                        arguments: func.arguments,
                    });

                    const toolResult = await client.request(
                        {
                            method: "tools/call",
                            params: {
                                name: func.name,
                                arguments: JSON.parse(func.arguments),
                            },
                        },
                        CallToolResultSchema
                    );

                    const resultText = (toolResult.content[0] as any).text;

                    // Emit tool result to client
                    socket.emit("tool_result", {
                        name: func.name,
                        result: resultText,
                    });

                    messages.push({
                        role: "tool",
                        content: resultText,
                        tool_call_id: toolCall.id,
                    });
                }

                response = await openai.chat.completions.create({
                    model: model,
                    messages: messages,
                    tools: tools,
                });
                choice = response.choices[0];
            }

            // Send final response
            const assistantMessage = choice.message.content || "Désolé, je n'ai pas pu générer une réponse.";
            messages.push(choice.message);
            socket.emit("response", assistantMessage);

        } catch (error: any) {
            console.error("Error processing message:", error);
            socket.emit("error", error.message);
        }
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

// Start server
async function main() {
    await initializeMCP();

    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
        console.log(`\n🚀 CodeAgent Web UI is running!`);
        console.log(`📱 Open your browser to: http://localhost:${PORT}`);
        console.log(`🤖 Using model: ${model}\n`);
    });
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
