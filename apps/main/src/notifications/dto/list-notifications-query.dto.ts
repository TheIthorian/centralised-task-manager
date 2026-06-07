import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

/** Validated query parameters for listing in-app notifications. */
export class ListNotificationsQueryDto {
    @IsOptional()
    @Transform(({ value }: { value: unknown }) => (value !== undefined ? parseInt(String(value), 10) : 1))
    @IsInt()
    @Min(1)
    page: number = 1;

    @IsOptional()
    @Transform(({ value }: { value: unknown }) => (value !== undefined ? parseInt(String(value), 10) : 20))
    @IsInt()
    @Min(1)
    @Max(100)
    limit: number = 20;

    @IsOptional()
    @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
    @IsBoolean()
    unreadOnly: boolean = false;
}
