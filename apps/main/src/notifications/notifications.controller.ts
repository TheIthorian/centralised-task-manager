import {
    Controller,
    Get,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    Request,
    Res,
    UseGuards,
    HttpCode,
    NotFoundException,
    Logger,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard.js';
import { NotificationsService } from './notifications.service.js';
import { UsersService } from '../users/users.service.js';
import { Notification, type NotificationDocument } from './schemas/notification.schema.js';
import { DiscordConnection, type DiscordConnectionDocument } from './schemas/discord-connection.schema.js';
import type { UpdatePreferencesDto } from './dto/update-preferences.dto.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

const DISCORD_API = 'https://discord.com/api/v10';

interface AuthRequest {
    user: JwtPayload;
}

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(CombinedAuthGuard)
export class NotificationsController {
    private readonly logger = new Logger(NotificationsController.name);

    constructor(
        private readonly notificationsService: NotificationsService,
        private readonly usersService: UsersService,
        private readonly config: ConfigService,
        @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
        @InjectModel(DiscordConnection.name) private readonly discordModel: Model<DiscordConnectionDocument>,
    ) {}

    // ── Inbox ──────────────────────────────────────────────────────────────────

    /** List the current user's in-app notifications, newest first. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'List in-app notifications' })
    @Get()
    async list(
        @Request() req: AuthRequest,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
        @Query('unreadOnly') unreadOnly = false,
    ): Promise<unknown[]> {
        const filter: Record<string, unknown> = { userId: new Types.ObjectId(req.user.sub) };

        if (unreadOnly) filter['read'] = false;

        const docs = await this.notificationModel
            .find(filter)
            .select('type title body read createdAt')
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .sort({ createdAt: -1 });

        return docs.map((d) => ({
            id: String(d._id),
            type: d.type,
            title: d.title,
            body: d.body,
            read: d.read,
            createdAt: d.createdAt,
        }));
    }

    /** Mark a single notification as read. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Mark a notification as read' })
    @Patch(':id/read')
    async markRead(@Request() req: AuthRequest, @Param('id') id: string): Promise<{ id: string; read: boolean }> {
        const doc = await this.notificationModel.findOneAndUpdate(
            { _id: id, userId: new Types.ObjectId(req.user.sub) },
            { read: true },
            { new: true },
        );

        if (!doc) throw new NotFoundException('Notification not found');

        return { id: String(doc._id), read: doc.read };
    }

    /** Mark all notifications as read for the current user. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Mark all notifications as read' })
    @Patch('read-all')
    async markAllRead(@Request() req: AuthRequest): Promise<{ updated: number }> {
        const result = await this.notificationModel.updateMany(
            { userId: new Types.ObjectId(req.user.sub), read: false },
            { read: true },
        );

        return { updated: result.modifiedCount };
    }

    // ── Preferences ────────────────────────────────────────────────────────────

    /** Get the current user's notification preferences. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Get notification preferences' })
    @Get('preferences')
    async getPreferences(@Request() req: AuthRequest): Promise<unknown> {
        return this.usersService.getNotificationPreferences(req.user.sub);
    }

    /** Update notification preferences (partial — only sent fields are changed). */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Update notification preferences' })
    @Patch('preferences')
    async updatePreferences(@Request() req: AuthRequest, @Body() dto: UpdatePreferencesDto): Promise<unknown> {
        return this.usersService.updateNotificationPreferences({ userId: req.user.sub, prefs: dto });
    }

    // ── Discord OAuth ───────────────────────────────────────────────────────────

    /** Redirect user to Discord OAuth2 consent screen. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Connect Discord — redirect to OAuth' })
    @Get('discord/connect')
    async discordConnect(@Request() req: AuthRequest, @Res() res: FastifyReply): Promise<void> {
        const clientId = this.config.getOrThrow<string>('DISCORD_CLIENT_ID');
        const redirectUri = encodeURIComponent(
            `${this.config.getOrThrow<string>('REDIRECT_BASE_URL')}/notifications/discord/callback`,
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
    @Get('discord/callback')
    @HttpCode(302)
    async discordCallback(
        @Query('code') code: string,
        @Query('state') state: string,
        @Res() res: FastifyReply,
    ): Promise<void> {
        const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:5173');

        try {
            const discordUserId = await this.exchangeCodeForUserId({ code, state });

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
    @Delete('discord')
    @HttpCode(204)
    async discordDisconnect(@Request() req: AuthRequest): Promise<void> {
        await this.discordModel.deleteOne({ userId: new Types.ObjectId(req.user.sub) });
    }

    /** Get Discord connection status for the current user. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Get Discord connection status' })
    @Get('discord/status')
    async discordStatus(@Request() req: AuthRequest): Promise<{ connected: boolean; discordUserId?: string }> {
        const connection = await this.discordModel.findOne({ userId: new Types.ObjectId(req.user.sub) });

        if (!connection) return { connected: false };

        return { connected: true, discordUserId: connection.discordUserId };
    }

    private async exchangeCodeForUserId({ code, state }: { code: string; state: string }): Promise<string> {
        const clientId = this.config.getOrThrow<string>('DISCORD_CLIENT_ID');
        const clientSecret = this.config.getOrThrow<string>('DISCORD_CLIENT_SECRET');
        const redirectUri = `${this.config.getOrThrow<string>('REDIRECT_BASE_URL')}/notifications/discord/callback`;

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

        void state;

        return userData.id;
    }
}
