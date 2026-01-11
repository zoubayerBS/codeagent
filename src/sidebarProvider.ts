import * as vscode from "vscode";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
    CallToolResultSchema,
    ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import OpenAI from "openai";
import { join } from "path";
import "dotenv/config";

export class CodexiaSidebarProvider implements vscode.WebviewViewProvider {
    _view?: vscode.WebviewView;
    _doc?: vscode.TextDocument;
    private _client?: Client;
    private _openai?: OpenAI;
    private _tools: any[] = [];
    private _messages: any[] = [];
    private _selectedModel: string = "meta-llama/Llama-3.3-70B-Instruct";

    constructor(private readonly _extensionUri: vscode.Uri, private readonly _context: vscode.ExtensionContext) {
        this._initialize();
    }

    private async _initialize() {
        // Load history
        const savedMessages = this._context.workspaceState.get<any[]>("chatHistory");
        if (savedMessages && savedMessages.length > 0) {
            this._messages = savedMessages;
        } else {
            this._messages = [
                {
                    role: "system",
                    content: `You are Codexia, an expert AI coding assistant. You possess a "Agentic" mindset, meaning you are proactive, capable, and autonomous.

**Your Goal**: Help the user solve complex coding tasks, debug issues, and build software.

**Your Tools**:
1.  \`read_file\`: Read file contents. ALWAYS read a file before modifying it to ensure you have the latest context.
2.  \`write_file\`: Create or update files. Use this to implement code changes.
3.  \`list_files\`: Explore the project structure.
4.  \`run_command\`: Execute shell commands (e.g., \`ls\`, \`npm test\`, \`grep\`).
5.  \`grep_search\`: Search for patterns in the codebase.

**Operational Rules**:
-   **Be Proactive**: Don't just explain how to do something; offer to do it for the user using your tools.
-   **Explore First**: If you don't know where a file is or what it contains, use \`list_files\` or \`grep_search\` to find it.
-   **Verify**: After making changes or running commands, try to verify the result if possible.
-   **Communication**: functionality: answering user questions, writing code, and executing terminal commands.
-   **Language**: Detect the user's language (mostly French) and respond in that language fluently.
-   **Formatting**: Use Markdown for all responses. Use bold for emphasis and code blocks for code.
-   **Visualizing Changes**: When you modify a file, ALWAYS show a \`diff\` code block illustrating the changes (- old line, + new line).

**Persona**: informative, concise, and helpful. You are a "clone" of a high-level coding agent. Act like one.`,
                },
            ];
        }

        // Get configuration from VS Code Settings
        const config = vscode.workspace.getConfiguration("codexia.llm");
        let apiKey = config.get<string>("apiKey");
        const baseURL = config.get<string>("baseUrl") || "https://router.huggingface.co/v1";
        const model = config.get<string>("model") || "meta-llama/Llama-3.3-70B-Instruct";
        this._selectedModel = model;

        if (!apiKey) {
            const selection = await vscode.window.showWarningMessage(
                "Codexia API Key is missing. Please set it in Settings or provide it now.",
                "Enter API Key",
                "Open Settings"
            );

            if (selection === "Enter API Key") {
                const input = await vscode.window.showInputBox({
                    prompt: "Enter your Hugging Face / OpenAI API Key",
                    password: true,
                    ignoreFocusOut: true
                });
                if (input) {
                    await config.update("apiKey", input, vscode.ConfigurationTarget.Global);
                    apiKey = input;
                    vscode.window.showInformationMessage("API Key saved to Global Settings.");
                } else {
                    return;
                }
            } else if (selection === "Open Settings") {
                vscode.commands.executeCommand("workbench.action.openSettings", "codexia.llm.apiKey");
                return;
            } else {
                return;
            }
        }


        this._openai = new OpenAI({
            apiKey: apiKey,
            baseURL: baseURL,
        });

        // Initialize MCP
        const rootPath = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0)
            ? vscode.workspace.workspaceFolders[0].uri.fsPath
            : process.cwd();

        const transport = new StdioClientTransport({
            command: "node",
            args: [join(__dirname, "index.js"), rootPath],
        });

        this._client = new Client(
            {
                name: "codexia-vscode",
                version: "1.0.0",
            },
            {
                capabilities: {},
            }
        );

        try {
            await this._client.connect(transport);
            const listToolsResult = await this._client.request(
                { method: "tools/list" },
                ListToolsResultSchema
            );

            this._tools = listToolsResult.tools.map((tool) => ({
                type: "function" as const,
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.inputSchema,
                },
            }));

            console.log("Codexia: Connected and tools loaded.");
        } catch (error) {
            console.error("Codexia Initialization Error:", error);
            vscode.window.showErrorMessage("Failed to connect to Codexia core.");
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data: { type: string; value?: string; message?: string; model?: string }) => {
            if (data.type === "user-message" && data.message) {
                await this._handleUserMessage(data.message);
            } else if (data.type === "clear-history") {
                this._messages = [
                    {
                        role: "system",
                        content: `You are Codexia, an expert AI coding assistant. You possess a "Agentic" mindset, meaning you are proactive, capable, and autonomous.

**Your Goal**: Help the user solve complex coding tasks, debug issues, and build software.

**Your Tools**:
1.  \`read_file\`: Read file contents. ALWAYS read a file before modifying it to ensure you have the latest context.
2.  \`write_file\`: Create or update files. Use this to implement code changes.
3.  \`list_files\`: Explore the project structure.
4.  \`run_command\`: Execute shell commands (e.g., \`ls\`, \`npm test\`, \`grep\`).
5.  \`grep_search\`: Search for patterns in the codebase.

**Operational Rules**:
-   **Be Proactive**: Don't just explain how to do something; offer to do it for the user using your tools.
-   **Explore First**: If you don't know where a file is or what it contains, use \`list_files\` or \`grep_search\` to find it.
-   **Verify**: After making changes or running commands, try to verify the result if possible.
-   **Communication**: functionality: answering user questions, writing code, and executing terminal commands.
-   **Language**: Detect the user's language (mostly French) and respond in that language fluently.
-   **Formatting**: Use Markdown for all responses. Use bold for emphasis and code blocks for code.
-   **Visualizing Changes**: When you modify a file, ALWAYS show a \`diff\` code block illustrating the changes (- old line, + new line).

**Persona**: informative, concise, and helpful. You are a "clone" of a high-level coding agent. Act like one.`,
                    },
                ];
                await this._context.workspaceState.update("chatHistory", this._messages);
                this._view?.webview.postMessage({ type: "history", messages: [] });
            } else if (data.type === "webview-ready") {
                this._sendHistoryToView();
            } else if (data.type === "change-model" && data.model) {
                this._selectedModel = data.model;
                console.log("Codexia: Model switched to", this._selectedModel);
            }
        });
    }

    private _sendHistoryToView() {
        if (this._view) {
            // Filter messages to show only user and assistant
            const displayMessages = this._messages.filter(m => m.role === "user" || (m.role === "assistant" && m.content)).map(m => ({
                role: m.role,
                content: m.content
            }));
            this._view.webview.postMessage({ type: "history", messages: displayMessages, currentModel: this._selectedModel });
        }
    }

    private async _handleUserMessage(userMessage: string) {
        // Reload config on every message in case it changed
        const config = vscode.workspace.getConfiguration("codexia.llm");
        const apiKey = config.get<string>("apiKey");

        if (!apiKey) {
            this._view?.webview.postMessage({ type: "bot-message", message: "⚠️ API Key missing. Please set 'codexia.llm.apiKey' in settings." });
            return;
        }

        // Re-init OpenAI if key changed or was just set
        if (!this._openai || this._openai.apiKey !== apiKey) {
            const baseURL = config.get<string>("baseUrl") || "https://router.huggingface.co/v1";
            this._openai = new OpenAI({ apiKey, baseURL });
        }

        if (!this._client) {
            this._view?.webview.postMessage({ type: "bot-message", message: "Error: MCP Client not connected." });
            return;
        }

        this._messages.push({ role: "user", content: userMessage });
        await this._context.workspaceState.update("chatHistory", this._messages);

        try {
            // Use selected model
            const model = this._selectedModel;
            let response = await this._openai.chat.completions.create({
                model: model,
                messages: this._messages,
                tools: this._tools,
            });

            let choice = response.choices[0];

            while (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
                this._messages.push(choice.message);

                for (const toolCall of choice.message.tool_calls) {
                    const func = (toolCall as any).function;
                    // Provide feedback
                    this._view?.webview.postMessage({ type: "bot-message", message: `🛠️ Exécution de: ${func.name}...` });

                    const toolResult = await this._client.request(
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
                    this._messages.push({
                        role: "tool",
                        content: resultText,
                        tool_call_id: toolCall.id,
                    });
                }

                await this._context.workspaceState.update("chatHistory", this._messages);

                response = await this._openai.chat.completions.create({
                    model: model,
                    messages: this._messages,
                    tools: this._tools,
                });
                choice = response.choices[0];
            }

            const assistantMessage = choice.message.content || "Je n'ai pas de réponse.";
            this._messages.push(choice.message);
            await this._context.workspaceState.update("chatHistory", this._messages);
            this._view?.webview.postMessage({ type: "bot-message", message: assistantMessage });

        } catch (error: any) {
            console.error("Chat Error:", error);
            this._view?.webview.postMessage({ type: "bot-message", message: `Error: ${error.message}` });
        }
    }

    public revive(panel: vscode.WebviewView) {
        this._view = panel;
    }

    public addSelectionToChat(text: string) {
        if (this._view) {
            this._view.show?.(true);
            this._view.webview.postMessage({
                type: "set-input",
                value: text.startsWith("Voici") || text.startsWith("Fichier") ? text : `Voici un extrait de code :\n\n\`\`\`\n${text}\n\`\`\`\n\nPeux-tu m'expliquer ce que cela fait ?`
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Use local icon if available
        const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "icon.png"));

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Codexia</title>
            <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
            <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
            <style>
                body {
                    padding: 0;
                    color: var(--vscode-editor-foreground);
                    font-family: var(--vscode-font-family);
                    background-color: var(--vscode-editor-background);
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    overflow: hidden;
                }
                .header {
                    padding: 15px;
                    border-bottom: 1px solid var(--vscode-widget-border);
                    background-color: var(--vscode-sideBar-background);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    animation: fadeInDown 0.5s ease;
                }
                .header img {
                    width: 24px;
                    height: 24px;
                    border-radius: 4px;
                }
                .header h3 {
                    margin: 0;
                    font-size: 14px;
                    font-weight: 600;
                    flex-grow: 1;
                }
                #chat-container {
                    flex: 1;
                    padding: 15px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                    animation: fadeInUp 0.5s ease;
                }
                .message {
                    padding: 10px 14px;
                    border-radius: 8px;
                    max-width: 85%;
                    word-wrap: break-word;
                    font-size: 13px;
                    line-height: 1.5;
                    position: relative;
                    animation: fadeInUp 0.3s ease;
                }
                .user-message {
                    align-self: flex-end;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border-bottom-right-radius: 2px;
                }
                .bot-message {
                    align-self: flex-start;
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    color: var(--vscode-editor-foreground);
                    border-bottom-left-radius: 2px;
                }
                .input-area {
                    border-top: 1px solid var(--vscode-widget-border);
                    background-color: var(--vscode-sideBar-background);
                    display: flex;
                    flex-direction: column;
                }
                .model-selector-container {
                    padding: 8px 15px 0 15px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .model-selector-container label {
                    font-size: 11px;
                    opacity: 0.8;
                }
                select {
                    flex: 1;
                    background-color: var(--vscode-select-background);
                    color: var(--vscode-select-foreground);
                    border: 1px solid var(--vscode-select-border);
                    border-radius: 4px;
                    padding: 2px 4px;
                    font-size: 11px;
                    outline: none;
                }
                select:focus {
                    border-color: var(--vscode-focusBorder);
                }
                .input-container {
                    padding: 10px 15px 15px 15px;
                    display: flex;
                    gap: 10px;
                }
                textarea {
                    flex: 1;
                    min-height: 40px;
                    max-height: 120px;
                    padding: 10px;
                    border-radius: 6px;
                    resize: none;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    font-family: inherit;
                    font-size: 13px;
                }
                textarea:focus {
                    outline: 1px solid var(--vscode-focusBorder);
                }
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 0 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: opacity 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                button:hover {
                    opacity: 0.9;
                }
                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                /* New Chat Button */
                #new-chat-btn {
                    background: none;
                    border: 1px solid var(--vscode-button-secondaryBackground);
                    color: var(--vscode-textLink-foreground);
                    padding: 4px 10px;
                    font-size: 11px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    transition: all 0.2s;
                }
                #new-chat-btn:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                    transform: scale(1.05);
                }
                #new-chat-btn svg {
                    width: 12px;
                    height: 12px;
                    fill: currentColor;
                    transition: transform 0.3s;
                }
                #new-chat-btn:hover svg {
                    transform: rotate(90deg);
                }

                /* Code highlighting */
                pre {
                    background-color: #0d1117;
                    padding: 12px;
                    border-radius: 6px;
                    overflow-x: auto;
                    margin: 8px 0;
                    border: 1px solid #30363d;
                }
                code {
                    font-family: var(--vscode-editor-font-family, monospace);
                    font-size: 12px;
                }

                /* Animations */
                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Empty State */
                .empty-state {
                    text-align: center;
                    margin-top: 40px;
                    opacity: 0.7;
                    font-size: 13px;
                    animation: fadeInDown 0.5s ease 0.2s backwards;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <img src="${iconUri}" alt="Logo" />
                <h3>Codexia</h3>
                <button id="new-chat-btn" title="New Chat">
                    <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    New Chat
                </button>
            </div>
            <div id="chat-container">
                <div class="empty-state">
                    👋 Bonjour ! Je suis Codexia.<br>Comment puis-je vous aider ?
                </div>
            </div>
            <div class="input-area">
                <div class="model-selector-container">
                    <label for="model-select">Modèle :</label>
                    <select id="model-select">
                        <option value="meta-llama/Llama-3.2-1B-Instruct">Llama 3.2 1B (Ultra-Rapide)</option>
                        <option value="meta-llama/Llama-3.2-3B-Instruct">Llama 3.2 3B (Rapide)</option>
                        <option value="meta-llama/Llama-3.1-8B-Instruct">Llama 3.1 8B (Équilibré)</option>
                        <option value="meta-llama/Llama-3.3-70B-Instruct" selected>Llama 3.3 70B (Puissant)</option>
                    </select>
                </div>
                <div class="input-container">
                    <textarea id="message-input" placeholder="Ecrivez votre message (Cmd+Entrée pour envoyer)..."></textarea>
                    <button id="send-btn">➤</button>
                </div>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                const chatContainer = document.getElementById('chat-container');
                const messageInput = document.getElementById('message-input');
                const sendBtn = document.getElementById('send-btn');
                const newChatBtn = document.getElementById('new-chat-btn');
                const modelSelect = document.getElementById('model-select');

                // Notify extension that webview is ready to receive history
                window.addEventListener('load', () => {
                   vscode.postMessage({ type: 'webview-ready' });
                });

                modelSelect.addEventListener('change', () => {
                    vscode.postMessage({ type: 'change-model', model: modelSelect.value });
                });

                function addMessage(role, text) {
                    // Remove empty state if present
                    const emptyState = document.querySelector('.empty-state');
                    if (emptyState) emptyState.remove();

                    const div = document.createElement('div');
                    div.className = \`message \${role === 'user' ? 'user-message' : 'bot-message'}\`;
                    
                    // Render Markdown
                    div.innerHTML = marked.parse(text);
                    
                    chatContainer.appendChild(div);
                    chatContainer.scrollTop = chatContainer.scrollHeight;

                    // Highlight code blocks
                    div.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightElement(block);
                    });
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'bot-message':
                            addMessage('assistant', message.message);
                            break;
                        case 'history':
                             // Clear current view first to avoid duplicates if called multiple times
                            chatContainer.innerHTML = '';
                            if (message.messages.length === 0) {
                                chatContainer.innerHTML = \`<div class="empty-state">👋 Bonjour ! Je suis Codexia.<br>Comment puis-je vous aider ?</div>\`;
                            } else {
                                message.messages.forEach(m => addMessage(m.role, m.content));
                            }
                            if (message.currentModel) {
                                modelSelect.value = message.currentModel;
                            }
                            break;
                        case 'set-input':
                            messageInput.value = message.value;
                            messageInput.focus();
                            // Auto-resize
                            messageInput.style.height = 'auto';
                            messageInput.style.height = messageInput.scrollHeight + 'px';
                            break;
                    }
                });

                function sendMessage() {
                    const text = messageInput.value.trim();
                    if (text) {
                        addMessage('user', text);
                        vscode.postMessage({ type: 'user-message', message: text });
                        messageInput.value = '';
                        messageInput.style.height = '40px';
                    }
                }

                sendBtn.addEventListener('click', sendMessage);
                messageInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                });

                // Auto-resize textarea
                messageInput.addEventListener('input', function() {
                    this.style.height = 'auto';
                    this.style.height = (this.scrollHeight) + 'px';
                });

                // New Chat
                newChatBtn.addEventListener('click', () => {
                    chatContainer.innerHTML = \`<div class="empty-state">👋 Bonjour ! Je suis Codexia.<br>Comment puis-je vous aider ?</div>\`;
                    vscode.postMessage({ type: 'clear-history' });
                });
            </script>
        </body>
        </html>`;
    }
}
