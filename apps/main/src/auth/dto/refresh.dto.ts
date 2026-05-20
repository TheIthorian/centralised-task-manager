import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshDto {
    @ApiProperty({ description: 'Refresh token issued by POST /auth/login or /auth/register' })
    @IsString()
    @IsNotEmpty()
    refreshToken!: string;
}
