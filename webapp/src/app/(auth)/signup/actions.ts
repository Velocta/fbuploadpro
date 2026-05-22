'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { signupSchema } from '@/lib/validations/auth'

export async function signUp(formData: FormData) {
    const validatedFields = signupSchema.safeParse(Object.fromEntries(formData.entries()))

    if (!validatedFields.success) {
        return { error: validatedFields.error.issues[0].message }
    }

    const { email, password, name, phone_number } = validatedFields.data
    const normalizedEmail = email.toLowerCase()

    const supabase = await createClient()
    const adminClient = await createAdminClient()
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown'

    // 1. Rate Limit: IP (30 requests / 1 hour)
    const { count: ipRequestCount } = await adminClient
        .from('auth_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('ip_address', ip)
        .eq('type', 'signup')
        .gt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

    if (ipRequestCount && ipRequestCount >= 30) {
        return { error: 'Too many signup requests from this connection. Please try again in 1 hour.' }
    }

    // 2. Rate Limit: Email (3 requests / 30 mins)
    const { count: emailRequestCount } = await adminClient
        .from('auth_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('email', normalizedEmail)
        .eq('type', 'signup')
        .gt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())

    if (emailRequestCount && emailRequestCount >= 3) {
        return { error: 'Too many signup attempts for this email. Please check your inbox or try again in 30 minutes.' }
    }

    // Sign up with Supabase
    const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
            data: {
                name,
                phone_number,
                role: 'agency'
            }
        }
    })

    if (error) {
        return { error: error.message }
    }

    // Log the signup initiation
    await adminClient.from('auth_attempts').insert({
        email: normalizedEmail,
        ip_address: ip,
        type: 'signup',
        success: true
    })

    if (!data.user) {
        return { error: 'Failed to initiate signup.' }
    }

    return { success: true, email: normalizedEmail, message: 'OTP sent to your Gmail! Please check your inbox.' }
}

export async function verifyOtpAction(email: string, token: string) {
    const supabase = await createClient()
    const adminClient = await createAdminClient()
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const normalizedEmail = email.toLowerCase()
    const normalizedToken = token.replace(/\D/g, '').trim()

    if (normalizedToken.length !== 6) {
        return { error: 'OTP must be exactly 6 digits.' }
    }

    // Rate Limit: 10 failures / 15 mins
    const { count: failureCount } = await adminClient
        .from('auth_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('email', normalizedEmail)
        .eq('type', 'otp')
        .gt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())

    if (failureCount && failureCount >= 10) {
        return { error: 'Too many invalid OTP attempts. Please try again in 15 minutes.' }
    }

    const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedToken,
        type: 'signup'
    })

    if (error) {
        await adminClient.from('auth_attempts').insert({
            email: normalizedEmail,
            ip_address: ip,
            type: 'otp',
            success: false
        })
        return { error: error.message }
    }

    if (data.user) {
        // Clear failures on success
        await adminClient.from('auth_attempts').delete().eq('email', normalizedEmail).eq('type', 'otp')

        // Sync role to app_metadata
        await adminClient.auth.admin.updateUserById(data.user.id, {
            app_metadata: { role: 'agency' }
        })

        // Fetch subdomain to return it to the client
        const { data: userData } = await adminClient
            .from('users')
            .select('subdomain')
            .eq('id', data.user.id)
            .single()

        return { success: true, subdomain: userData?.subdomain }
    }

    return { error: 'Verification failed.' }
}

export async function resendOtpAction(email: string) {
    const supabase = await createClient()
    const adminClient = await createAdminClient()
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const normalizedEmail = email.toLowerCase()

    // Throttling: 1 request / 60 seconds
    const { count: resendCount } = await adminClient
        .from('auth_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('email', normalizedEmail)
        .eq('type', 'resend')
        .gt('created_at', new Date(Date.now() - 60 * 1000).toISOString())

    if (resendCount && resendCount >= 1) {
        return { error: 'Please wait 60 seconds before requesting another code.' }
    }

    const { error } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
    })

    if (error) {
        return { error: error.message }
    }

    await adminClient.from('auth_attempts').insert({
        email: normalizedEmail,
        ip_address: ip,
        type: 'resend',
        success: true
    })

    return { success: true, message: 'New OTP sent to your Gmail!' }
}
