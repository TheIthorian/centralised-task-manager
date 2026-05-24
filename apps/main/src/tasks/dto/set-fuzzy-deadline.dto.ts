import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import type { SetFuzzyDeadlineDto as ISetFuzzyDeadlineDto } from '@ctm/api-client';

export class SetFuzzyDeadlineDto implements ISetFuzzyDeadlineDto {
    @ApiProperty({ enum: ['this_week', 'this_month', 'someday'] })
    @IsIn(['this_week', 'this_month', 'someday'])
    type!: 'this_week' | 'this_month' | 'someday';

    @ApiPropertyOptional({ enum: ['daily', 'weekly'] })
    @IsOptional()
    @IsIn(['daily', 'weekly'])
    remindEvery?: 'daily' | 'weekly';
}
