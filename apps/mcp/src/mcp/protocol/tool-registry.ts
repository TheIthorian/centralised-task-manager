import { z, type ZodRawShape } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Logger } from '@ctm/logger';

/** Behavioural hints a client may show to a user before invoking a tool. */
export type ToolAnnotations = {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
};

export type ToolContent = { type: 'text'; text: string };

export type ToolResult = { content: ToolContent[]; isError?: boolean };

/** A tool as it appears in a `tools/list` result. */
export type ToolDescriptor = {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    annotations?: ToolAnnotations;
};

type RegisteredTool = {
    descriptor: ToolDescriptor;
    schema: z.ZodObject<ZodRawShape>;
    shape: ZodRawShape;
    annotations?: ToolAnnotations;
    handler: (args: Record<string, unknown>) => Promise<ToolResult>;
};

/**
 * The tools this server exposes, held independently of any transport.
 *
 * The `2026-07-28` dispatcher reads this directly; earlier revisions are served by the MCP SDK,
 * which `applyTo` populates from the same definitions.
 */
export class ToolRegistry {
    private readonly tools = new Map<string, RegisteredTool>();

    constructor(private readonly logger: Logger) {}

    /** Register one tool. Argument shape matches the SDK's `registerTool` so definitions are portable. */
    registerTool<Shape extends ZodRawShape>(
        name: string,
        config: { description: string; inputSchema: Shape; annotations?: ToolAnnotations },
        handler: (args: z.output<z.ZodObject<Shape>>) => Promise<ToolResult>,
    ): void {
        const schema = z.object(config.inputSchema);

        this.tools.set(name, {
            descriptor: {
                name,
                description: config.description,
                inputSchema: z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>,
                ...(config.annotations ? { annotations: config.annotations } : {}),
            },
            schema: schema as z.ZodObject<ZodRawShape>,
            shape: config.inputSchema,
            ...(config.annotations ? { annotations: config.annotations } : {}),
            handler: handler as (args: Record<string, unknown>) => Promise<ToolResult>,
        });
    }

    /** Every registered tool, in registration order. */
    list(): ToolDescriptor[] {
        return [...this.tools.values()].map((tool) => tool.descriptor);
    }

    /** Whether a tool of this name is registered. */
    has(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * Run a tool. Arguments are validated against the tool's schema first, and a failure of either
     * the validation or the tool itself comes back as an error result rather than a thrown error:
     * the model can act on the message, where a protocol error only ends the call.
     */
    async call({ name, args }: { name: string; args: Record<string, unknown> }): Promise<ToolResult> {
        const tool = this.tools.get(name);

        if (!tool) throw new Error(`Unknown tool: ${name}`);

        const parsed = tool.schema.safeParse(args);

        if (!parsed.success) {
            return errorResult(`Invalid arguments for ${name}: ${z.prettifyError(parsed.error)}`);
        }

        try {
            return await tool.handler(parsed.data);
        } catch (error) {
            // The client only ever sees the message, so without this the cause leaves no trace.
            this.logger.error({ err: error, tool: name }, `MCP tool ${name} failed`);

            return errorResult(error instanceof Error ? error.message : String(error));
        }
    }

    /** Register every tool on an SDK server, for clients on a revision the SDK still handles. */
    applyTo(server: McpServer): void {
        for (const [name, tool] of this.tools) {
            server.registerTool(
                name,
                {
                    description: tool.descriptor.description,
                    inputSchema: tool.shape,
                    ...(tool.annotations ? { annotations: tool.annotations } : {}),
                },
                async (args: Record<string, unknown>) => this.call({ name, args }),
            );
        }
    }
}

function errorResult(text: string): ToolResult {
    return { content: [{ type: 'text', text }], isError: true };
}
