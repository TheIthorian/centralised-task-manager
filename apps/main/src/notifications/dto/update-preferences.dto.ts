import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type {
    UpdateChannelPrefsDto as IUpdateChannelPrefsDto,
    UpdateNotificationPreferencesDto as IUpdateNotificationPreferencesDto,
} from '@ctm/api-client';

export class ChannelPrefsDto implements IUpdateChannelPrefsDto {
    @IsOptional()
    @IsBoolean()
    inApp?: boolean;

    @IsOptional()
    @IsBoolean()
    discord?: boolean;

    @IsOptional()
    @IsBoolean()
    email?: boolean;
}

export class UpdatePreferencesDto implements IUpdateNotificationPreferencesDto {
    @IsOptional()
    @ValidateNested()
    @Type(() => ChannelPrefsDto)
    connectorReconnect?: ChannelPrefsDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => ChannelPrefsDto)
    dailySummary?: ChannelPrefsDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => ChannelPrefsDto)
    reminder?: ChannelPrefsDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => ChannelPrefsDto)
    upcomingDeadline?: ChannelPrefsDto;
}
