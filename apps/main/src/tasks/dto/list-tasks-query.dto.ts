import { IsOptional, IsString, IsIn, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ListTasksQueryDto {
    @IsOptional()
    @IsIn(['open', 'done', 'archived'])
    status?: 'open' | 'done' | 'archived';

    @IsOptional()
    @IsString()
    source?: string;

    @IsOptional()
    @IsIn(['this_week', 'this_month', 'someday'])
    fuzzy?: 'this_week' | 'this_month' | 'someday';

    @IsOptional()
    @Transform(({ value }: { value: unknown }) => value === 'true')
    @IsBoolean()
    surfaced?: boolean;

    @IsOptional()
    @Type(() => Number)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    limit?: number = 50;
}
