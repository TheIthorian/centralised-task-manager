import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';
import type { AddReminderDto as IAddReminderDto } from '@ctm/api-client';

export class AddReminderDto implements IAddReminderDto {
    @ApiProperty({ description: 'ISO 8601 datetime for the reminder', example: '2026-06-01T14:00:00.000Z' })
    @IsISO8601()
    remindAt!: string;
}
