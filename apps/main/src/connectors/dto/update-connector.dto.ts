import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpdateConnectorDto {
    @IsOptional()
    @IsBoolean()
    enabled?: boolean;

    @IsOptional()
    @IsObject()
    settings?: Record<string, unknown>;
}
