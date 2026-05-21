import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength, IsNotEmpty } from 'class-validator';

export class RegisterDto {
    @ApiProperty({ example: 'Jane Smith', maxLength: 100 })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name!: string;

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
