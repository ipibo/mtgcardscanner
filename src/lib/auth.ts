export const COOKIE_NAME = "mtg_auth"
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET env var is not set")
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

const PAYLOAD = new TextEncoder().encode("authenticated")

export async function createToken(): Promise<string> {
  const key = await getKey()
  const sig = await crypto.subtle.sign("HMAC", key, PAYLOAD)
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const key = await getKey()
    const sigBytes = Uint8Array.from(atob(token), (c) => c.charCodeAt(0))
    return await crypto.subtle.verify("HMAC", key, sigBytes, PAYLOAD)
  } catch {
    return false
  }
}
