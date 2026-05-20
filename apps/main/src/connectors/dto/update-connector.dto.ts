import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpdateConnectorDto {
    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    enabled?: boolean;

    @ApiPropertyOptional({ example: { projectIds: ['abc123'] } })
    @IsOptional()
    @IsObject()
    settings?: Record<string, unknown>;
}
