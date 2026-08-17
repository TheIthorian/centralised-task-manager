import sharp from 'sharp';

/** Formats accepted from a client. Anything else is refused rather than handed to the encoder. */
export const ALLOWED_LOGO_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];

/** Format every stored logo is re-encoded to, whatever arrived. */
export const LOGO_CONTENT_TYPE = 'image/png';

/** Edge length of the stored square logo, in pixels. */
export const LOGO_SIZE_PX = 128;

/** Largest response accepted from the client's host, before decoding. */
export const MAX_LOGO_BYTES = 512 * 1024;

/** Largest decoded image accepted, so a small file cannot expand into a huge bitmap. */
export const MAX_LOGO_DIMENSION_PX = 4096;

/** An image that has been re-encoded into the stored logo format. */
export type EncodedLogo = {
    data: Buffer;
    contentType: string;
};

/**
 * Re-encode arbitrary image bytes into the stored logo format.
 * Returns null if the bytes are not an image, or decode to more pixels than are allowed.
 */
export async function encodeLogo(body: Buffer): Promise<EncodedLogo | null> {
    try {
        const image = sharp(body, { animated: false });
        const metadata = await image.metadata();

        if (!metadata.width || !metadata.height) return null;

        if (metadata.width > MAX_LOGO_DIMENSION_PX || metadata.height > MAX_LOGO_DIMENSION_PX) return null;

        const data = await image
            .resize({
                width: LOGO_SIZE_PX,
                height: LOGO_SIZE_PX,
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .png()
            .toBuffer();

        return { data, contentType: LOGO_CONTENT_TYPE };
    } catch {
        return null;
    }
}
