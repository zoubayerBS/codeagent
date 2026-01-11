# CodeAgent for VS Code

CodeAgent est un assistant de codage AI "Agentic" intégré directement dans VS Code. Contrairement aux simples chats, CodeAgent peut explorer votre projet, lire des fichiers, et effectuer des modifications réelles de manière proactive.

![Demo](media/icon.png)

## Fonctionnalités Principales 🚀

*   **Mode Agent** : CodeAgent ne fait pas que répondre, il agit. Il peut lister les fichiers, chercher dans le code avec `grep`, et modifier des fichiers.
*   **Diffs Visuels** : Voyez exactement ce que l'agent modifie grâce à des blocs diff colorés (vert/rouge).
*   **Contexte Intelligent** :
    *   **Add Selection to Chat** : Envoyez un bout de code à l'agent depuis le menu contextuel.
    *   **Add File to Chat** : Envoyez un fichier entier à l'agent depuis l'explorateur.
    *   **Fix Errors** : Demandez à l'agent de corriger les erreurs/warnings du fichier actuel.
*   **Bring Your Own Key** : Utilisez votre propre clé API (Hugging Face / OpenAI). Vos données, votre contrôle.

## Configuration ⚙️

1.  Installez l'extension.
2.  Ouvrez la barre latérale **CodeAgent** (cliquez sur l'icône cerveau 🧠).
3.  L'extension vous demandera votre Clé API (Hugging Face ou OpenAI).
    *   Vous pouvez la changer plus tard dans **Settings** > **CodeAgent** > **Api Key**.
4.  (Optionnel) Configurez le modèle (`codeagent.llm.model`) si vous souhaitez utiliser un autre modèle que Llama 3.

## Utilisation 💡

*   **Chat** : Posez des questions, demandez de créer des scripts, de refactoriser du code.
*   **Clic Droit** : Utilisez les commandes "CodeAgent" dans l'éditeur de texte ou l'explorateur de fichiers.
*   **Nouveau Chat** : Cliquez sur le bouton "➕ New Chat" pour recommencer à zéro.

## Prérequis

*   Une clé API valide (Hugging Face Inference API ou OpenAI API).

---

**Note** : Cette extension utilise le protocole MCP (Model Context Protocol) pour interagir avec votre système de fichiers de manière sécurisée et structurée.
