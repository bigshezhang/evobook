import { createRemoteJWKSet, jwtVerify } from 'jose';

const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error('SUPABASE_URL environment variable is required');
}

const JWKS = createRemoteJWKSet(
  new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
);

export interface TokenPayload {
  sub: string;
  email?: string;
  aud: string;
}

/**
 * 验证 Supabase JWT，返回 payload。无效时返回 null。
 */
export async function verifySupabaseToken(
  token: string,
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      audience: 'authenticated',
    });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: payload.email as string | undefined,
      aud: payload.aud as string,
    };
  } catch {
    return null;
  }
}
