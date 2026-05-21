import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
    @ApiProperty({ example: 'jane@example.com', maxLength: 320 })
    @IsEmail()
    @MaxLength(320)
    email!: string;

    @ApiProperty({ minLength: 8, maxLength: 255, example: 'hunter2hunter2' })
    @IsString()
    @MinLength(8)
    @MaxLength(255)
    password!: string;
}
