import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesService } from './files.service.js';
import { FILE_STORAGE } from './storage/file-storage.interface.js';
import { LocalFileStorage } from './storage/local-file-storage.js';

@Module({
    providers: [
        {
            provide: FILE_STORAGE,
            useFactory: (config: ConfigService) =>
                new LocalFileStorage(config.get<string>('EXPORT_DIR', './exports')),
            inject: [ConfigService],
        },
        FilesService,
    ],
    exports: [FilesService],
})
export class FilesModule {}
