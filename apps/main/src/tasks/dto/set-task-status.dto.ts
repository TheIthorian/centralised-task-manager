import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class SetTaskStatusDto {
    @ApiProperty({ enum: ['open', 'done'], description: 'Target status for the task.' })
    @IsIn(['open', 'done'])
    status!: 'open' | 'done';
}
