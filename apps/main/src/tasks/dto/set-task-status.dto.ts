import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { SetTaskStatusDto as ISetTaskStatusDto } from '@ctm/api-client';

export class SetTaskStatusDto implements ISetTaskStatusDto {
    @ApiProperty({ enum: ['open', 'done'], description: 'Target status for the task.' })
    @IsIn(['open', 'done'])
    status!: 'open' | 'done';
}
