import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
    CallToolResultSchema,
    ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import OpenAI from "openai";
import * as readline from "readline/promises";
import { join } from "path";
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

const transport = new StdioClientTransport({
    command: "node",
    args: [join(__dirname, "index.js")],
});

const client = new Client(
    {
        name: "llama-cloud-orchestrator",
        version: "1.0.0",
    },
    {
        capabilities: {},
    }
);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

async function main() {
    console.log("Connecting to CodeAgent MCP Server...");
    await client.connect(transport);
    console.log("Connected! Fetching tools...");

    const listToolsResult = await client.request(
        { method: "tools/list" },
        ListToolsResultSchema
    );

    const tools = listToolsResult.tools.map((tool) => ({
        type: "function" as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
        },
    }));

    console.log(`Available tools: ${listToolsResult.tools.map(t => t.name).join(", ")}`);
    console.log(`Llama 4 Cloud (${model}) is ready to chat!`);

    const messages: any[] = [
        {
            role: "system",
            content:
                "You are a helpful coding assistant called CodeAgent. You have access to tools to read, write, and search files, and run commands. Use them to help the user with their coding tasks.",
        },
    ];

    while (true) {
        const userInput = await rl.question("\nVous: ");
        if (userInput.toLowerCase() === "exit") break;

        messages.push({ role: "user", content: userInput });

        try {
            let response = await openai.chat.completions.create({
                model: model,
                messages: messages,
                tools: tools,
            });

            let choice = response.choices[0];

            while (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
                messages.push(choice.message);

                for (const toolCall of choice.message.tool_calls) {
                    const func = (toolCall as any).function;
                    console.log(`\n[Tool Call] ${func.name}(${func.arguments})`);

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
                    console.log(`[Tool Result] ${resultText.substring(0, 100)}${resultText.length > 100 ? "..." : ""}`);

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

            console.log(`\nLlama: ${choice.message.content}`);
            messages.push(choice.message);
        } catch (error: any) {
            console.error(`Error: ${error.message}`);
        }
    }

    process.exit(0);
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
