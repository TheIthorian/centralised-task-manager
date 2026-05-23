import { Controller, Get, Delete, Query, Request, Res, UseGuards, HttpCode, Logger } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard.js';
import { DiscordConnection, type DiscordConnectionDocument } from './schemas/discord-connection.schema.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

const DISCORD_API = 'https://discord.com/api/v10';

interface AuthRequest {
    user: JwtPayload;
}

@ApiTags('Discord')
@Controller('connectors/discord')
@UseGuards(CombinedAuthGuard)
export class DiscordController {
    private readonly logger = new Logger(DiscordController.name);

    constructor(
        private readonly config: ConfigService,
        @InjectModel(DiscordConnection.name) private readonly discordModel: Model<DiscordConnectionDocument>,
    ) {}

    /** Redirect user to Discord OAuth2 consent screen. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Connect Discord — redirect to OAuth' })
    @Get('connect')
    async connect(@Request() req: AuthRequest, @Res() res: FastifyReply): Promise<void> {
        const clientId = this.config.getOrThrow<string>('DISCORD_CLIENT_ID');
        const redirectUri = encodeURIComponent(
            `${this.config.getOrThrow<string>('REDIRECT_BASE_URL')}/connectors/discord/callback`,
        );
        const url =
            `https://discord.com/oauth2/authorize` +
            `?client_id=${clientId}` +
            `&redirect_uri=${redirectUri}` +
            `&response_type=code` +
            `&scope=identify` +
            `&state=${req.user.sub}`;

        await res.status(302).header('Location', url).send();
    }

    /** Discord OAuth2 callback — exchange code for user ID and store connection. */
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

            await res.status(302).header('Location', `${webUrl}/settings/notifications?discord=connected`).send();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';

            this.logger.error(`Discord callback failed: ${message}`);

            await res
                .status(302)
                .header('Location', `${webUrl}/settings/notifications?error=${encodeURIComponent(message)}`)
                .send();
        }
    }

    /** Disconnect Discord — removes stored connection. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Disconnect Discord' })
    @Delete()
    @HttpCode(204)
    async disconnect(@Request() req: AuthRequest): Promise<void> {
        await this.discordModel.deleteOne({ userId: new Types.ObjectId(req.user.sub) });
    }

    /** Get Discord connection status for the current user. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Get Discord connection status' })
    @Get('status')
    async status(@Request() req: AuthRequest): Promise<{ connected: boolean; discordUserId?: string }> {
        const connection = await this.discordModel.findOne({ userId: new Types.ObjectId(req.user.sub) });

        if (!connection) return { connected: false };

        return { connected: true, discordUserId: connection.discordUserId };
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
