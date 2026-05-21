import { Controller, Get } from '@nestjs/common';
import { OAuthResourceService, type OAuthProtectedResourceMetadata } from './oauth-resource.service.js';

@Controller('.well-known')
export class OAuthResourceController {
    constructor(private readonly oauthResource: OAuthResourceService) {}

    /** RFC 9728 protected resource metadata (root fallback). */
    @Get('oauth-protected-resource')
    root(): OAuthProtectedResourceMetadata {
        return this.oauthResource.getMetadata();
    }

    /** RFC 9728 protected resource metadata for the `/mcp` resource path. */
    @Get('oauth-protected-resource/mcp')
    mcp(): OAuthProtectedResourceMetadata {
        return this.oauthResource.getMetadata();
    }
}
