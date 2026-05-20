import { IsString, IsOptional, IsISO8601, IsInt, Min, Max, IsArray } from 'class-validator';

export class UpdateTaskDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsISO8601()
    dueDate?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(4)
    priority?: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];
}
