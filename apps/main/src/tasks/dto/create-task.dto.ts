import { IsString, IsNotEmpty, IsOptional, IsISO8601, IsIn, Min, Max, IsInt } from 'class-validator';

export class CreateTaskDto {
    @IsString()
    @IsNotEmpty()
    title!: string;

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

    @IsString()
    @IsNotEmpty()
    source!: string;
}
