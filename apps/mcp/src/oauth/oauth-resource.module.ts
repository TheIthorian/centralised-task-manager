import { Module } from '@nestjs/common';
import { OAuthResourceController } from './oauth-resource.controller.js';
import { OAuthResourceService } from './oauth-resource.service.js';

@Module({
    controllers: [OAuthResourceController],
    providers: [OAuthResourceService],
    exports: [OAuthResourceService],
})
export class OAuthResourceModule {}
