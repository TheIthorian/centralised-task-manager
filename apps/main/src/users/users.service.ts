import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, type UserDocument } from './schemas/user.schema.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
    constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

    /** Create a new user. Throws ConflictException if email already exists. */
    async create({ email, password, name = '' }: { email: string; password: string; name?: string }): Promise<UserDocument> {
        const passwordHash = await bcrypt.hash(password, 12);

        try {
            return await this.userModel.create({ email, passwordHash, name });
        } catch (err: unknown) {
            if (isMongooseDuplicateError(err)) throw new ConflictException('Email already registered');

            throw err;
        }
    }

    /** Find a user by email. Returns null if not found. */
    async findByEmail(email: string): Promise<UserDocument | null> {
        return this.userModel.findOne({ email: email.toLowerCase() });
    }

    /** Find a user by id. Returns null if not found. */
    async findById(id: string): Promise<UserDocument | null> {
        return this.userModel.findById(id);
    }

    /** Update email and/or password for a user. Throws NotFoundException if user not found. */
    async update({ id, dto }: { id: string; dto: UpdateUserDto }): Promise<UserDocument> {
        const patch: Partial<{ email: string; passwordHash: string }> = {};

        if (dto.email) patch.email = dto.email;

        if (dto.password) patch.passwordHash = await bcrypt.hash(dto.password, 12);

        const user = await this.userModel.findByIdAndUpdate(id, patch, { new: true });

        if (!user) throw new NotFoundException('User not found');

        return user;
    }

    /** Permanently delete a user by id. */
    async delete(id: string): Promise<void> {
        await this.userModel.findByIdAndDelete(id);
    }
}

function isMongooseDuplicateError(err: unknown): boolean {
    return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}
