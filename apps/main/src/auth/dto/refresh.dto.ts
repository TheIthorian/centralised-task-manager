import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class RefreshDto {
    @ApiPropertyOptional({
        description:
            'Refresh token issued by POST /auth/login or /auth/register. Omit when the ctm_refresh cookie is present.',
        maxLength: 4096,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(4096)
    refreshToken?: string;
}
