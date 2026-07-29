import {
    Controller,
    Get,
    Post,
    Patch,
    Param,
    Body,
    Query,
    Request,
    UseGuards,
    HttpCode,
    NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { UsersService } from '../users/users.service.js';
import { Channel, NotificationsService } from './notifications.service.js';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto.js';
import type { UpdatePreferencesDto } from './dto/update-preferences.dto.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import {
    MarkAllReadResultDto,
    MarkReadResultDto,
    NotificationDto,
    NotificationPreferencesDto,
    TestChannelResultDto,
} from './dto/notification-response.dto.js';
import { ZodParam } from '../common/zod/zod-validation.pipe.js';
import { objectIdSchema } from '../common/zod/param-schemas.js';
import { z } from 'zod';

type AuthRequest = { user: JwtPayload };

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(
        private readonly usersService: UsersService,
        private readonly notificationsService: NotificationsService,
    ) {}

    // ── Channels ───────────────────────────────────────────────────────────────

    /** Send a test notification to the specified channel to verify it is working. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Test a notification channel' })
    @Post('channels/:channel/test')
    async testNotificationChannel(
        @Request() req: AuthRequest,
        @Param('channel', ZodParam(z.enum(Channel))) channel: Channel,
    ): Promise<TestChannelResultDto> {
        return this.notificationsService.testChannel({ userId: req.user.sub, channel });
    }

    // ── Inbox ──────────────────────────────────────────────────────────────────

    /** List the current user's in-app notifications, newest first. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'List in-app notifications' })
    @Get()
    async list(@Request() req: AuthRequest, @Query() query: ListNotificationsQueryDto): Promise<NotificationDto[]> {
        return this.notificationsService.list({
            userId: req.user.sub,
            page: query.page,
            limit: query.limit,
            unreadOnly: query.unreadOnly,
        });
    }

    /** Mark a single notification as read. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Mark a notification as read' })
    @Patch(':id/read')
    async markRead(@Request() req: AuthRequest, @Param('id', ZodParam(objectIdSchema)) id: string): Promise<MarkReadResultDto> {
        return this.notificationsService.markRead({ userId: req.user.sub, id });
    }

    /** Mark all notifications as read for the current user. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Mark all notifications as read' })
    @Patch('read-all')
    @HttpCode(200)
    async markAllRead(@Request() req: AuthRequest): Promise<MarkAllReadResultDto> {
        return this.notificationsService.markAllRead({ userId: req.user.sub });
    }

    // ── Preferences ────────────────────────────────────────────────────────────

    /** Get the current user's notification preferences. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Get notification preferences' })
    @Get('preferences')
    async getPreferences(@Request() req: AuthRequest): Promise<NotificationPreferencesDto> {
        const prefs = await this.usersService.getNotificationPreferences(req.user.sub);

        if (!prefs) throw new NotFoundException('User not found');

        return prefs as NotificationPreferencesDto;
    }

    /** Update notification preferences (partial — only sent fields are changed). */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Update notification preferences' })
    @Patch('preferences')
    async updatePreferences(
        @Request() req: AuthRequest,
        @Body() dto: UpdatePreferencesDto,
    ): Promise<NotificationPreferencesDto> {
        return this.usersService.updateNotificationPreferences({ userId: req.user.sub, prefs: dto });
    }
}
