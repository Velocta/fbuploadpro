'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { requestResetSchema, verifyOtpSchema, updatePasswordSchema } from '@/lib/validations/auth'
import { zodErrorMessage } from '@/lib/validations/errors'

export async function requestReset(formData: FormData) {
  const validatedFields = requestResetSchema.safeParse(Object.fromEntries(formData.entries()))

  if (!validatedFields.success) {
    return { error: zodErrorMessage(validatedFields.error) }
  }

  const { email } = validatedFields.data
  const normalizedEmail = email.toLowerCase()

  const supabase = await createClient()
  const adminClient = await createAdminClient()
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown'

  // 1. Check Email Rate Limit
  const { count: requestCount } = await adminClient
    .from('auth_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('email', normalizedEmail)
    .eq('type', 'forgot_password')
    .gt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())

  if (requestCount && requestCount >= 3) {
    return { error: 'Too many requests for this email. Please try again in 30 minutes.' }
  }

  // 2. Check IP Rate Limit
  const { count: ipFailCount } = await adminClient
    .from('auth_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .eq('success', false)
    .gt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

  if (ipFailCount && ipFailCount >= 20) {
    return { error: 'Too many failed attempts from your connection. Please try again in 1 hour.' }
  }

  // Check if user exists in our public.users table first
  // Use adminClient to bypass RLS since the user is not logged in
  const { data: userExists, error: checkError } = await adminClient
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .single()

  if (checkError || !userExists) {
    // Return generic success to prevent email enumeration
    return { success: true, message: 'If an account exists with this email, you will receive a verification code.' }
  }

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail)

  if (error) {
    return { error: error.message }
  }

  // Log Request
  await adminClient.from('auth_attempts').insert({
    email: normalizedEmail,
    ip_address: ip,
    type: 'forgot_password',
    success: true
  })

  // Redirect to OTP verification page with email as query param
  redirect(`/login/verify-otp?email=${encodeURIComponent(normalizedEmail)}`)
}

export async function verifyOtp(formData: FormData) {
  const validatedFields = verifyOtpSchema.safeParse({
    email: formData.get('email'),
    token: formData.get('otp')
  })

  if (!validatedFields.success) {
    return { error: zodErrorMessage(validatedFields.error) }
  }

  const { email, token } = validatedFields.data
  const normalizedEmail = email.toLowerCase()

  const supabase = await createClient()
  const adminClient = await createAdminClient()
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown'

  // 1. Check Email Rate Limit
  const { count: failureCount } = await adminClient
    .from('auth_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('email', normalizedEmail)
    .eq('type', 'otp')
    .eq('success', false)
    .gt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())

  if (failureCount && failureCount >= 5) {
    return { error: 'Too many invalid OTP attempts for this email. Please try again in 10 minutes.' }
  }

  // 2. Check IP Rate Limit
  const { count: ipFailCount } = await adminClient
    .from('auth_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .eq('success', false)
    .gt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

  if (ipFailCount && ipFailCount >= 20) {
    return { error: 'Too many failed attempts from your connection. Please try again in 1 hour.' }
  }

  const { error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token,
    type: 'recovery',
  })

  if (error) {
    // Log failure
    await adminClient.from('auth_attempts').insert({
      email: normalizedEmail,
      ip_address: ip,
      type: 'otp',
      success: false
    })
    return { error: error.message }
  }

  // Clear failure logs on success
  await adminClient.from('auth_attempts').delete().eq('email', normalizedEmail).eq('type', 'otp')

  redirect('/login/update-password')
}

export async function updatePassword(formData: FormData) {
  const validatedFields = updatePasswordSchema.safeParse(Object.fromEntries(formData.entries()))

  if (!validatedFields.success) {
    return { error: zodErrorMessage(validatedFields.error) }
  }

  const { password } = validatedFields.data

  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // After password update, redirect to home/dashboard
  // Logic from login/actions.ts to determine role and redirect
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const role = user.app_metadata?.role

    if (role === 'super_admin') {
      redirect('/super-admin')
    } else if (role === 'agency') {
      redirect('/agency')
    }
  }

  redirect('/')
}
