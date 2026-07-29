# Custom Agents Setup

You can use any agent that implements the [Agent Client Protocol (ACP)](https://agentclientprotocol.com/get-started/agents).

## Install and Configure

1. Install your ACP-compatible agent (e.g., [OpenCode](https://github.com/anomalyco/opencode), [Qwen Code](https://github.com/QwenLM/qwen-code), [Kiro](https://kiro.dev/)).

2. Open **Settings → Obsidian Harness** and scroll to the **Agents** section.

3. Click **Add agent**.

4. Configure the agent:
   - **Agent ID**: Unique identifier (e.g., `my-agent`)
   - **Display name**: Name shown in menus (e.g., `My Agent`)
   - **Path**: Command name or absolute path to the agent executable. The command name alone (e.g., `opencode`) works in many cases. If the agent is not found automatically, set the full path, or click **Auto-detect**.
   - **Arguments**: Command-line arguments, one per line (if required)
   - **Environment variables**: `KEY=VALUE` pairs, one per line (if required)

## Configuration Examples

### OpenCode

| Field | Value |
|-------|-------|
| **Agent ID** | `opencode` |
| **Display name** | `OpenCode` |
| **Path** | `opencode` |
| **Arguments** | `acp` |
| **Environment variables** | (optional) |

### Qwen Code

| Field | Value |
|-------|-------|
| **Agent ID** | `qwen-code` |
| **Display name** | `Qwen Code` |
| **Path** | `qwen` |
| **Arguments** | `--experimental-acp` |
| **Environment variables** | (optional) |

### Kiro

| Field | Value |
|-------|-------|
| **Agent ID** | `kiro-cli` |
| **Display name** | `Kiro` |
| **Path** | `kiro-cli` |
| **Arguments** | `acp` |
| **Environment variables** | (optional) |

## Authentication

Authentication depends on the specific agent. Common patterns:

- **API Key (recommended)**: Fill the agent's **API key** field — the key is stored in Obsidian's Keychain and never written to `data.json`. Set **API key env var name** to the variable the agent reads (e.g., `MY_API_KEY`), and Harness injects it when spawning the agent.
- **Account Login**: Run the agent's CLI to authenticate, then leave the API key fields empty.
- **Other config**: Put non-secret `KEY=VALUE` pairs in **Environment variables** (stored as plain text in `data.json` — do not put secrets here).

Refer to your agent's documentation for specific authentication instructions.

## Verify Setup

1. Click the robot icon in the ribbon (or run **Open session manager**).
2. In the Session Navigator, click **New session**, then select your custom agent from the agent dropdown in the header.
3. Send a message to verify the connection.

Having issues? See [Troubleshooting](/help/troubleshooting).
