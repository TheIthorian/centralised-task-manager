import { Injectable, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { assertTimeZone, UTC } from '@ctm/time';
import { User, type UserDocument, type NotificationPreferences } from './schemas/user.schema.js';
import { ConnectorConfig, type ConnectorConfigDocument } from '../connectors/schemas/connector-config.schema.js';
import { Task, type TaskDocument } from '../tasks/schemas/task.schema.js';
import { createLogger } from '@ctm/logger';
import { UpdateUserDto } from './dto/update-user.dto.js';
import type { UpdatePreferencesDto } from '../notifications/dto/update-preferences.dto.js';

@Injectable()
export class UsersService {
    private readonly logger = createLogger(UsersService.name);

    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(ConnectorConfig.name) private readonly connectorConfigModel: Model<ConnectorConfigDocument>,
        @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    ) {}

    /** Create a new user. Throws ConflictException if email already exists. */
    async create({
        email,
        password,
        name = '',
    }: {
        email: string;
        password: string;
        name?: string;
    }): Promise<UserDocument> {
        const passwordHash = await bcrypt.hash(password, 12);

        try {
            return await this.userModel.create({ email, passwordHash, name });
        } catch (err: unknown) {
            if (isMongooseDuplicateError(err)) {
                this.logger.debug({ err }, 'Registration rejected: email already in use');

                throw new ConflictException('Email already registered');
            }

            this.logger.error({ err }, 'Failed to create a user');

            throw err;
        }
    }

    /** Find a user by email. Returns null if not found. */
    async findByEmail(email: string): Promise<UserDocument | null> {
        return this.userModel.findOne({ email: email.toLowerCase() });
    }

    /** Find a user by id. Returns null if not found. */
    async findById(id: string): Promise<UserDocument | null> {
        return this.userModel.findById(id);
    }

    /** Update email, timezone and/or password for a user. Throws NotFoundException if user not found. */
    async update({ id, dto }: { id: string; dto: UpdateUserDto }): Promise<UserDocument> {
        const patch: Partial<{ email: string; passwordHash: string; timezone: string }> = {};

        if (dto.email) patch.email = dto.email;

        if (dto.timezone) patch.timezone = assertTimeZone(dto.timezone);

        if (dto.newPassword) {
            const user = await this.userModel.findById(id).select('passwordHash');

            if (!user || !dto.currentPassword || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
                throw new UnauthorizedException('Current password is incorrect');
            }

            patch.passwordHash = await bcrypt.hash(dto.newPassword, 12);
        }

        const user = await this.userModel.findByIdAndUpdate(id, patch, { new: true });

        if (!user) throw new NotFoundException('User not found');

        return user;
    }

    /** The IANA zone whose days this user's date boundaries follow. Falls back to UTC. */
    async getTimeZone(userId: string): Promise<string> {
        const user = await this.userModel.findById(userId).select('timezone');

        return user?.timezone ?? UTC;
    }

    /** Get the notification preferences for a user. Returns null if user not found. */
    async getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
        const user = await this.userModel.findById(userId).select('notificationPreferences');

        return user?.notificationPreferences ?? null;
    }

    /** Patch notification preferences. Only updates provided trigger+channel combinations. */
    async updateNotificationPreferences({
        userId,
        prefs,
    }: {
        userId: string;
        prefs: UpdatePreferencesDto;
    }): Promise<NotificationPreferences> {
        const user = await this.userModel.findById(userId).select('notificationPreferences');

        if (!user) throw new NotFoundException('User not found');

        const patch: Record<string, boolean> = {};

        for (const [trigger, channelPrefs] of Object.entries(prefs)) {
            if (channelPrefs) {
                for (const [channel, value] of Object.entries(channelPrefs)) {
                    if (value !== undefined) {
                        patch[`notificationPreferences.${trigger}.${channel}`] = value as boolean;
                    }
                }
            }
        }

        const updated = await this.userModel
            .findByIdAndUpdate(userId, { $set: patch }, { new: true })
            .select('notificationPreferences');

        if (!updated) throw new NotFoundException('User not found');

        return updated.notificationPreferences;
    }

    /** Permanently delete a user and all their associated data. */
    async delete(id: string): Promise<void> {
        const userId = new Types.ObjectId(id);

        await Promise.all([
            this.userModel.findByIdAndDelete(id),
            this.connectorConfigModel.deleteMany({ userId }),
            this.taskModel.deleteMany({ userId }),
        ]);
    }
}

function isMongooseDuplicateError(err: unknown): boolean {
    return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}
