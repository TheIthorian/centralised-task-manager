import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ListTasksQueryDto {
    @ApiPropertyOptional({ enum: ['open', 'done', 'archived'] })
    @IsOptional()
    @IsIn(['open', 'done', 'archived'])
    status?: 'open' | 'done' | 'archived';

    @ApiPropertyOptional({ example: 'todoist' })
    @IsOptional()
    @IsString()
    source?: string;

    @ApiPropertyOptional({ enum: ['this_week', 'this_month', 'someday'] })
    @IsOptional()
    @IsIn(['this_week', 'this_month', 'someday'])
    fuzzy?: 'this_week' | 'this_month' | 'someday';

    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @Transform(({ value }: { value: unknown }) => value === 'true')
    @IsBoolean()
    surfaced?: boolean;

    @ApiPropertyOptional({ default: 1, example: 1 })
    @IsOptional()
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional({ default: 50, example: 50 })
    @IsOptional()
    @Type(() => Number)
    limit?: number = 50;
}
