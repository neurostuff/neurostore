import { InternalAxiosRequestConfig, RawAxiosRequestConfig } from 'axios';

/**
 * Request options that gzip a JSON body. A project PUT carries every curation stub, and past
 * about 41k stubs it is over the 100M body limit of compose's nginx; gzipped it is about 3x smaller.
 * The compose backend decompresses it (neurosynth_compose/gzip_request.py).
 */
export const GZIP_REQUEST: RawAxiosRequestConfig = { headers: { 'Content-Encoding': 'gzip' } };

const gzip = async (text: string): Promise<ArrayBuffer> => {
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    // not awaited: the reader below drains the stream, or a large body would block the write
    writer.write(new TextEncoder().encode(text)).catch(() => undefined);
    writer.close().catch(() => undefined);
    return new Response(stream.readable).arrayBuffer();
};

/**
 * Request interceptor: gzips a serialized body when the request asks for Content-Encoding: gzip.
 * Without CompressionStream, or with a body that is not yet a string, it sends the body as is and
 * drops the header.
 */
export const gzipRequestBody = async (config: InternalAxiosRequestConfig) => {
    if (config.headers.get('Content-Encoding') !== 'gzip') return config;
    if (typeof config.data !== 'string' || typeof CompressionStream === 'undefined') {
        config.headers.delete('Content-Encoding');
        return config;
    }
    config.data = await gzip(config.data);
    return config;
};
