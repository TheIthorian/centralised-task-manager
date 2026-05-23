import { Controller, Get, Post, Delete, Query, Request, Res, UseGuards, HttpCode, Logger } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard.js';
import { DiscordConnection, type DiscordConnectionDocument } from './schemas/discord-connection.schema.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

const TEST_MESSAGES = [
    '👋 Hey! Your CTM notifications are working perfectly!',
    '🎉 Connection successful! I\'ll ping you here when something needs your attention.',
    '✅ All systems go! CTM is ready to send you notifications.',
    '🚀 Discord connected! You\'re all set to receive task reminders here.',
    '💬 Hello from CTM! Notifications are live and ready to go.',
];

const DISCORD_API = 'https://discord.com/api/v10';

interface AuthRequest {
    user: JwtPayload;
}

@ApiTags('Discord')
@Controller('connectors/discord')
export class DiscordController {
    private readonly logger = new Logger(DiscordController.name);

    private readonly botToken: string;

    constructor(
        private readonly config: ConfigService,
        @InjectModel(DiscordConnection.name) private readonly discordModel: Model<DiscordConnectionDocument>,
    ) {
        this.botToken = config.getOrThrow<string>('DISCORD_BOT_TOKEN');
    }

    /** Return the Discord OAuth2 URL (for programmatic clients). */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Get Discord OAuth URL' })
    @UseGuards(CombinedAuthGuard)
    @Get('connect-url')
    connectUrl(@Request() req: AuthRequest): { url: string } {
        const clientId = this.config.getOrThrow<string>('DISCORD_CLIENT_ID');
        const redirectUri = encodeURIComponent(
            `${this.config.getOrThrow<string>('REDIRECT_BASE_URL')}/connectors/discord/callback`,
        );
        const url =
            `https://discord.com/oauth2/authorize` +
            `?client_id=${clientId}` +
            `&redirect_uri=${redirectUri}` +
            `&response_type=code` +
            `&scope=identify%20bot` +
            `&permissions=2048` +
            `&state=${req.user.sub}`;

        return { url };
    }

    /** Redirect user to Discord OAuth2 consent screen. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Connect Discord — redirect to OAuth' })
    @UseGuards(CombinedAuthGuard)
    @Get('connect')
    async connect(@Request() req: AuthRequest, @Res() res: FastifyReply): Promise<void> {
        const { url } = this.connectUrl(req);
        await res.status(302).header('Location', url).send();
    }

    /** Discord OAuth2 callback — called by Discord after user grants access. No auth required. */
    @ApiOperation({ summary: 'Discord OAuth callback (called by Discord)' })
    @Get('callback')
    @HttpCode(302)
    async callback(
        @Query('code') code: string,
        @Query('state') state: string,
        @Res() res: FastifyReply,
    ): Promise<void> {
        const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:5173');

        try {
            const discordUserId = await this.exchangeCodeForUserId({ code });

            await this.discordModel.findOneAndUpdate(
                { userId: new Types.ObjectId(state) },
                { userId: new Types.ObjectId(state), discordUserId, dmChannelId: null },
                { upsert: true, new: true },
            );

            this.logger.log(`Discord connected: appUserId=${state} discordUserId=${discordUserId}`);

            await res.status(302).header('Location', `${webUrl}/settings/sources?discord=connected`).send();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';

            this.logger.error(`Discord callback failed: ${message}`);

            await res
                .status(302)
                .header('Location', `${webUrl}/settings/sources?error=${encodeURIComponent(message)}`)
                .send();
        }
    }

    /** Send a test DM to verify the Discord connection is working. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Test Discord connection' })
    @UseGuards(CombinedAuthGuard)
    @Post('test')
    async test(@Request() req: AuthRequest): Promise<{ sent: boolean }> {
        const connection = await this.discordModel.findOne({ userId: new Types.ObjectId(req.user.sub) });

        if (!connection) return { sent: false };

        const message = TEST_MESSAGES[Math.floor(Math.random() * TEST_MESSAGES.length)]!;
        const channelId = connection.dmChannelId ?? (await this.openDmChannel(connection));
        await this.sendDm({ channelId, content: message, connection });

        return { sent: true };
    }

    /** Disconnect Discord — removes stored connection. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Disconnect Discord' })
    @UseGuards(CombinedAuthGuard)
    @Delete()
    @HttpCode(204)
    async disconnect(@Request() req: AuthRequest): Promise<void> {
        await this.discordModel.deleteOne({ userId: new Types.ObjectId(req.user.sub) });
    }

    /** Get Discord connection status for the current user. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Get Discord connection status' })
    @UseGuards(CombinedAuthGuard)
    @Get('status')
    async status(@Request() req: AuthRequest): Promise<{ connected: boolean; discordUserId?: string }> {
        const connection = await this.discordModel.findOne({ userId: new Types.ObjectId(req.user.sub) });

        if (!connection) return { connected: false };

        return { connected: true, discordUserId: connection.discordUserId };
    }

    private async openDmChannel(connection: DiscordConnectionDocument): Promise<string> {
        const res = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
            method: 'POST',
            headers: { Authorization: `Bot ${this.botToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient_id: connection.discordUserId }),
        });

        if (!res.ok) throw new Error(`Discord open DM failed: ${res.status}`);

        const data = (await res.json()) as { id: string };

        await this.discordModel.findByIdAndUpdate(connection._id, { dmChannelId: data.id });

        return data.id;
    }

    private async sendDm({
        channelId,
        content,
        connection,
    }: {
        channelId: string;
        content: string;
        connection: DiscordConnectionDocument;
    }): Promise<void> {
        const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bot ${this.botToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        });

        if (!res.ok) {
            this.logger.error(`Discord test DM failed: ${res.status} for userId=${String(connection.userId)}`);
            throw new Error(`Discord send failed: ${res.status}`);
        }
    }

    private async exchangeCodeForUserId({ code }: { code: string }): Promise<string> {
        const clientId = this.config.getOrThrow<string>('DISCORD_CLIENT_ID');
        const clientSecret = this.config.getOrThrow<string>('DISCORD_CLIENT_SECRET');
        const redirectUri = `${this.config.getOrThrow<string>('REDIRECT_BASE_URL')}/connectors/discord/callback`;

        const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                client_id: clientId,
                client_secret: clientSecret,
            }),
        });

        if (!tokenRes.ok) throw new Error(`Discord token exchange failed: ${tokenRes.status}`);

        const tokenData = (await tokenRes.json()) as { access_token: string };

        const userRes = await fetch(`${DISCORD_API}/users/@me`, {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (!userRes.ok) throw new Error(`Discord user fetch failed: ${userRes.status}`);

        const userData = (await userRes.json()) as { id: string };

        return userData.id;
    }
}
