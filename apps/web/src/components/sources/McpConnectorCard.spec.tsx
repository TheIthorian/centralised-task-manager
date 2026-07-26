import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { McpConnectorCard } from './McpConnectorCard.js';

const writeText = vi.fn(async () => undefined);

describe('McpConnectorCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(navigator, { clipboard: { writeText } });
    });

    it('copies the url and opens the connector settings for paste-only clients', async () => {
        const open = vi.spyOn(window, 'open').mockReturnValue(null);
        render(<McpConnectorCard mcpUrl="https://mcp.example.com" />);

        await userEvent.click(screen.getByRole('button', { name: 'Add to Claude' }));

        await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://mcp.example.com'));
        expect(open).toHaveBeenCalledWith('https://claude.ai/settings/connectors', '_blank', 'noopener,noreferrer');
    });

    it('copies the CLI command for Claude Code', async () => {
        render(<McpConnectorCard mcpUrl="https://mcp.example.com" />);

        await userEvent.selectOptions(screen.getByLabelText('MCP client'), 'claude-code');
        await userEvent.click(screen.getByRole('button', { name: 'Add to Claude Code' }));

        await waitFor(() =>
            expect(writeText).toHaveBeenCalledWith('claude mcp add --transport http ctm https://mcp.example.com'),
        );
    });
});
