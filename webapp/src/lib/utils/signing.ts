import { createHmac, timingSafeEqual } from 'crypto'

function getSecret(): string {
    const secret = process.env.MAGIC_LINK_SIGNING_SECRET
    if (!secret) {
        throw new Error('Missing required environment variable: MAGIC_LINK_SIGNING_SECRET')
    }
    return secret
}

export function signData(data: object, expiresInMs: number = 10 * 60 * 1000): string {
    const secret = getSecret()
    const payload = {
        ...data,
        exp: Date.now() + expiresInMs
    }
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const signature = createHmac('sha256', secret).update(payloadStr).digest('base64url')
    return `${payloadStr}.${signature}`
}

export function verifyData<T>(token: string): T | null {
    try {
        const secret = getSecret()
        const [payloadStr, signature] = token.split('.')
        if (!payloadStr || !signature) return null

        const expectedSignature = createHmac('sha256', secret).update(payloadStr).digest('base64url')

        if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            return null
        }

        const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString())

        if (payload.exp && Date.now() > payload.exp) {
            return null
        }

        return payload as T
    } catch (e) {
        console.error('Verification Error:', e)
        return null
    }
}
