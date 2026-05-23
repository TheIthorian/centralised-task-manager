import {
    Controller,
    Get,
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
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard.js';
import { UsersService } from '../users/users.service.js';
import { Notification, type NotificationDocument } from './schemas/notification.schema.js';
import type { UpdatePreferencesDto } from './dto/update-preferences.dto.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

interface AuthRequest {
    user: JwtPayload;
}

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(CombinedAuthGuard)
export class NotificationsController {
    constructor(
        private readonly usersService: UsersService,
        @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
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
    @HttpCode(200)
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
}
