import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString, IsOptional, IsISO8601, IsInt, Min, Max,
    IsArray, MaxLength, IsUrl, ValidateNested, IsEnum,
} from 'class-validator';
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

export class DueDateDto {
    @ApiProperty({ example: '2026-06-01' })
    @IsISO8601()
    date!: string;

    @ApiPropertyOptional({ example: 'America/New_York' })
    @IsOptional()
    @IsString()
    timezone?: string;

    @ApiPropertyOptional({ example: 'FREQ=WEEKLY;BYDAY=MO' })
    @IsOptional()
    @IsString()
    recurrence?: string;
}

export class DurationDto {
    @ApiProperty({ example: 90 })
    @IsInt()
    @Min(1)
    amount!: number;

    @ApiProperty({ example: 'minute', enum: ['minute', 'day'] })
    @IsEnum(['minute', 'day'])
    unit!: 'minute' | 'day';
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

    @ApiPropertyOptional({ type: DueDateDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => DueDateDto)
    due?: DueDateDto;

    @ApiPropertyOptional({ example: '2026-06-30' })
    @IsOptional()
    @IsISO8601()
    deadlineDate?: string;

    @ApiPropertyOptional({ type: DurationDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => DurationDto)
    duration?: DurationDto;

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
