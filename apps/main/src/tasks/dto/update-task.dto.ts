import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsISO8601, IsInt, Min, Max, IsArray, MaxLength, IsUrl, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LocationDto {
    @ApiPropertyOptional({ example: 'Eiffel Tower', maxLength: 200 })
    @IsString()
    @MaxLength(200)
    name!: string;

    @ApiPropertyOptional({ example: 'https://maps.google.com/?q=Eiffel+Tower', maxLength: 500 })
    @IsString()
    @IsUrl()
    @MaxLength(500)
    googleMapsUrl!: string;
}

export class UpdateTaskDto {
    @ApiPropertyOptional({ example: 'Updated title', maxLength: 200 })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    title?: string;

    @ApiPropertyOptional({ example: 'Updated description', maxLength: 2000 })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiPropertyOptional({ example: '2026-07-01T00:00:00.000Z' })
    @IsOptional()
    @IsISO8601()
    dueDate?: string;

    @ApiPropertyOptional({ minimum: 1, maximum: 4, example: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(4)
    priority?: number;

    @ApiPropertyOptional({ type: [String], example: ['work', 'urgent'], maxLength: 50 })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @MaxLength(50, { each: true })
    tags?: string[];

    @ApiPropertyOptional({ type: [LocationDto], description: 'Locations with Google Maps links' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LocationDto)
    locations?: LocationDto[];
}
