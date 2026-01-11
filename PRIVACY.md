# Privacy Policy for CodeAgent

Last Updated: January 11, 2026

## 1. Data Collection
**CodeAgent does not collect, store, or share any personal data.**

We (the authors of CodeAgent) do not have access to your code, your chat history, or your API keys. All data processing happens locally on your machine or directly between your machine and the LLM provider you configure.

## 2. API Usage & Data Transmission
CodeAgent requires an API Key to function (e.g., from OpenAI or Hugging Face).

*   **API Keys**: Your API Key is stored securely on your local machine using VS Code's configuration system. It is never sent to us.
*   **Code & Prompts**: When you ask a question or use a command (like "Add File to Chat"), the relevant code snippets and your prompt are sent securely (via HTTPS) to the API provider you have configured (e.g., `api.openai.com` or `router.huggingface.co`).
*   **Third-Party Privacy**: By using this extension, you are governed by the privacy policy of the LLM provider you choose to use. Please refer to OpenAI's or Hugging Face's privacy policies for details on how they handle data.

## 3. Local Execution
CodeAgent uses the Model Context Protocol (MCP) to execute commands (`ls`, `grep`) and read/write files on your computer. These actions are performed locally and initiated by you or the AI agent with your oversight. No logs of these actions are uploaded to our servers.

## 4. Contact
If you have any questions about this privacy policy, please open an issue on our GitHub repository.
