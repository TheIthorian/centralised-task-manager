import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsBoolean, MaxLength, IsISO8601 } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ListTasksQueryDto {
    /** UI-level preset filter — maps to date/status constraints in the service. */
    @ApiPropertyOptional({ enum: ['all', 'today', 'upcoming', 'done'] })
    @IsOptional()
    @IsIn(['all', 'today', 'upcoming', 'done'])
    filter?: 'all' | 'today' | 'upcoming' | 'done';

    @ApiPropertyOptional({ enum: ['open', 'done', 'archived'] })
    @IsOptional()
    @IsIn(['open', 'done', 'archived'])
    status?: 'open' | 'done' | 'archived';

    @ApiPropertyOptional({ example: 'todoist', maxLength: 50 })
    @IsOptional()
    @IsString()
    @MaxLength(50)
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

    /** ISO date string — only return tasks updated on or after this date. */
    @ApiPropertyOptional({ example: '2026-05-23T00:00:00.000Z' })
    @IsOptional()
    @IsString()
    lastUpdatedFromDate?: string;

    /** ISO date string — only tasks where due.date < dueBefore. Must not be combined with the \`filter\` preset. */
    @ApiPropertyOptional({ example: '2026-05-30T00:00:00.000Z' })
    @IsOptional()
    @IsISO8601()
    dueBefore?: string;

    /** ISO date string — only tasks where due.date >= dueAfter. */
    @ApiPropertyOptional({ example: '2026-05-29T00:00:00.000Z' })
    @IsOptional()
    @IsISO8601()
    dueAfter?: string;

    /** When true, only return tasks with no due date. */
    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
    @IsBoolean()
    noDate?: boolean;

    @ApiPropertyOptional({ default: 1, example: 1 })
    @IsOptional()
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional({ default: 50, example: 50 })
    @IsOptional()
    @Type(() => Number)
    limit?: number = 50;
}
