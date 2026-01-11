import * as vscode from 'vscode';
import { CodexiaSidebarProvider } from './sidebarProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Codexia extension is now active!');

    const sidebarProvider = new CodexiaSidebarProvider(context.extensionUri, context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            "codexia-view",
            sidebarProvider
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("codexia.addSelectionToChat", () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const selection = editor.document.getText(editor.selection);
                sidebarProvider.addSelectionToChat(selection);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("codexia.addFileToChat", async (uri: vscode.Uri) => {
            if (uri) {
                try {
                    const content = await vscode.workspace.fs.readFile(uri);
                    const fileContent = Buffer.from(content).toString('utf-8');
                    const fileName = uri.path.split('/').pop();
                    sidebarProvider.addSelectionToChat(`Fichier : ${fileName}\n\`\`\`\n${fileContent}\n\`\`\``);
                } catch (err) {
                    vscode.window.showErrorMessage("Error reading file: " + err);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("codexia.fixDiagnostics", () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
                const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error || d.severity === vscode.DiagnosticSeverity.Warning);

                if (errors.length === 0) {
                    vscode.window.showInformationMessage("No errors or warnings found!");
                    return;
                }

                const errorMessages = errors.map(d => `- Line ${d.range.start.line + 1}: ${d.message}`).join("\n");
                const fileContent = editor.document.getText();

                const prompt = `Voici le code du fichier actuel :\n\`\`\`\n${fileContent}\n\`\`\`\n\nIl contient les erreurs suivantes :\n${errorMessages}\n\nPeux-tu corriger ce code ?`;

                sidebarProvider.addSelectionToChat(prompt);
            }
        })
    );
}

export function deactivate() { }
