import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { encodeLogo, LOGO_CONTENT_TYPE, LOGO_SIZE_PX, MAX_LOGO_DIMENSION_PX } from './logo-image.js';

describe('encodeLogo', () => {
    it('re-encodes an image to a fixed format and size', async () => {
        const logo = await encodeLogo(await squarePng(512));

        expect(logo?.contentType).toBe(LOGO_CONTENT_TYPE);

        const metadata = await sharp(logo?.data).metadata();

        expect(metadata.format).toBe('png');
        expect(metadata.width).toBe(LOGO_SIZE_PX);
        expect(metadata.height).toBe(LOGO_SIZE_PX);
    });

    it('re-encodes a jpeg to png', async () => {
        const source = await sharp({ create: square(64) })
            .jpeg()
            .toBuffer();

        expect((await encodeLogo(source))?.contentType).toBe(LOGO_CONTENT_TYPE);
    });

    it('refuses an image larger than the dimension cap', async () => {
        const source = await sharp({
            create: { width: MAX_LOGO_DIMENSION_PX + 1, height: 8, channels: 3, background: '#336699' },
        })
            .png()
            .toBuffer();

        expect(await encodeLogo(source)).toBeNull();
    });

    it('refuses bytes that are not a decodable image', async () => {
        expect(await encodeLogo(Buffer.from('not an image'))).toBeNull();
    });
});

function square(size: number): sharp.Create {
    return { width: size, height: size, channels: 3, background: '#336699' };
}

async function squarePng(size: number): Promise<Buffer> {
    return sharp({ create: square(size) })
        .png()
        .toBuffer();
}
