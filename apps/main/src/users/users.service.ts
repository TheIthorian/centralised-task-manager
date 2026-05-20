import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, type UserDocument } from './schemas/user.schema.js';

@Injectable()
export class UsersService {
    constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

    /** Create a new user. Throws ConflictException if email already exists. */
    async create({ email, password }: { email: string; password: string }): Promise<UserDocument> {
        const passwordHash = await bcrypt.hash(password, 12);

        try {
            return await this.userModel.create({ email, passwordHash });
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
}

function isMongooseDuplicateError(err: unknown): boolean {
    return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}
