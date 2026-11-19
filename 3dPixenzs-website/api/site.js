import { createHash, timingSafeEqual } from 'node:crypto';
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import worker from '../dist/server/index.js';

let client;
function storage(env) {
  if (!env.R2_ACCOUNT_ID || !env.R2_BUCKET || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 storage settings are missing.');
  }
  client ??= new S3Client({
    endpoint: 'https://' + env.R2_ACCOUNT_ID + '.r2.cloudflarestorage.com',
    region: 'auto',
    forcePathStyle: true,
    credentials: {accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY}
  });
  const Bucket = env.R2_BUCKET;
  return {
    async get(Key) {
      try {
        const result = await client.send(new GetObjectCommand({Bucket, Key}));
        return {
          etag: result.ETag.replaceAll('"', ''),
          get body() { return result.Body.transformToWebStream(); },
          json: async () => JSON.parse(await result.Body.transformToString()),
          httpMetadata: {contentType: result.ContentType}
        };
      } catch (error) {
        if (error.name === 'NoSuchKey') return null;
        throw error;
      }
    },
    async put(Key, value, options = {}) {
      try {
        const result = await client.send(new PutObjectCommand({
          Bucket, Key, Body: value instanceof ArrayBuffer ? Buffer.from(value) : value,
          ContentType: options.httpMetadata?.contentType,
          IfMatch: options.onlyIf?.get('If-Match') ?? undefined,
          IfNoneMatch: options.onlyIf?.get('If-None-Match') ?? undefined
        }));
        return {etag: result.ETag.replaceAll('"', '')};
      } catch (error) {
        if ([409, 412].includes(error.$metadata?.httpStatusCode)) return null;
        throw error;
      }
    },
    async list({prefix, cursor, limit} = {}) {
      const result = await client.send(new ListObjectsV2Command({
        Bucket, Prefix: prefix, ContinuationToken: cursor, MaxKeys: limit
      }));
      return {
        objects: (result.Contents ?? []).map(object => ({key: object.Key})),
        truncated: Boolean(result.IsTruncated), cursor: result.NextContinuationToken
      };
    }
  };
}

const digest = value => createHash('sha256').update(value).digest();

export default {
  async fetch(incoming) {
    const env = process.env;
    const url = new URL(incoming.url);
    const mappedPath = url.searchParams.get('__site_path');
    if (url.pathname === '/api/site' && mappedPath?.startsWith('/')) url.pathname = mappedPath;
    url.searchParams.delete('__site_path');

    const headers = new Headers(incoming.headers);
    headers.delete('oai-authenticated-user-id');
    headers.delete('oai-authenticated-user-email');
    const protectedRoute = ['/admin', '/admin.html'].includes(url.pathname) ||
      url.pathname.startsWith('/api/admin/');
    if (protectedRoute) {
      if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 20) {
        return new Response('Configure owner access before using Admin.', {status: 503});
      }
      const expected = 'Basic ' + Buffer.from(env.ADMIN_EMAIL + ':' + env.ADMIN_PASSWORD).toString('base64');
      if (!timingSafeEqual(digest(headers.get('authorization') ?? ''), digest(expected))) {
        return new Response('Owner sign-in required.', {
          status: 401,
          headers: {'WWW-Authenticate': 'Basic realm="3dPixenzs Admin", charset="UTF-8"', 'Cache-Control': 'no-store'}
        });
      }
      headers.set('oai-authenticated-user-id', 'vercel-store-owner');
      headers.set('oai-authenticated-user-email', env.ADMIN_EMAIL);
    }
    headers.delete('authorization');
    try {
      const request = new Request(url, {
        method: incoming.method, headers,
        ...(incoming.body ? {body: incoming.body, duplex: 'half'} : {})
      });
      return await worker.fetch(request, {...env, BUCKET: storage(env)});
    } catch {
      return new Response('Store temporarily unavailable.', {status: 503});
    }
  }
};
