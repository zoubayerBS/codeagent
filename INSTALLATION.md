# Installation - CodeAgent MCP Extension pour Antigravity

## Installation

### Option 1 : Installation locale (Recommandée)

```bash
cd /Users/zoubayerbensaid/Desktop/Agentcod
npm run build
npm link
```

### Option 2 : Installation globale

```bash
cd /Users/zoubayerbensaid/Desktop/Agentcod
npm run build
npm install -g .
```

## Configuration dans Antigravity

Ajoute cette configuration à ton fichier de configuration MCP d'Antigravity :

**Chemin du fichier de config :** `~/.config/antigravity/mcp_config.json` (ou via l'interface UI)

```json
{
  "mcpServers": {
    "codeagent": {
      "command": "codeagent-mcp"
    }
  }
}
```

## Vérification

1. Redémarre Antigravity
2. Dans une conversation, tu devrais maintenant avoir accès aux outils :
   - `read_file`
   - `write_file`
   - `list_files`
   - `grep_search`
   - `run_command`

## Utilisation

Une fois installé, tu peux demander à Antigravity :
- "Lis le fichier package.json"
- "Crée un nouveau fichier test.py avec un Hello World"
- "Liste tous les fichiers TypeScript dans ce projet"
- "Cherche toutes les fonctions qui contiennent 'async'"

Antigravity utilisera automatiquement les outils du CodeAgent ! 🚀
