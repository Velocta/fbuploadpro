'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { loginSchema } from '@/lib/validations/auth'
import { zodErrorMessage } from '@/lib/validations/errors'
import { getMainDomain, isLocalHost, isVercelPreviewHost } from '@/lib/config/runtime'

export async function login(formData: FormData) {
  const validatedFields = loginSchema.safeParse(Object.fromEntries(formData.entries()))

  if (!validatedFields.success) {
    return { error: zodErrorMessage(validatedFields.error) }
  }

  const { email, password } = validatedFields.data

  const supabase = await createClient()
  const adminClient = await createAdminClient()
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown'

  // 1. Check Rate Limit (IP + Email Combination)
  // This prevents an attacker from locking out a target user's account 
  // just by knowing their email address.
  const { count: combinedFailCount } = await adminClient
    .from('auth_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('email', email)
    .eq('ip_address', ip)
    .eq('type', 'login')
    .eq('success', false)
    .gt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())

  if (combinedFailCount && combinedFailCount >= 10) {
    return { error: 'Too many failed attempts for this account from your connection. Please try again in 15 minutes.' }
  }

  // 2. Global IP Protection (Prevent blanket brute-force)
  const { count: globalIpFailCount } = await adminClient
    .from('auth_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .eq('success', false)
    .gt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

  if (globalIpFailCount && globalIpFailCount >= 50) {
    return { error: 'Too many failed attempts from your connection. Please try again in 1 hour.' }
  }

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Detect unconfirmed email
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return { error: error.message, unconfirmed: true, email }
    }

    // Log failure
    await adminClient.from('auth_attempts').insert({
      email,
      ip_address: ip,
      type: 'login',
      success: false
    })
    return { error: error.message }
  }

  // Clear failure logs on success
  await adminClient.from('auth_attempts').delete().eq('email', email).eq('type', 'login')

  const user = authData.user
  if (user) {
    // Fallback: Fetch role from public.users if missing from metadata
    let role = user.app_metadata?.role

    if (!role) {
      const { data: userData } = await adminClient
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      role = userData?.role

      if (role) {
        // Sync back to metadata for future requests
        await adminClient.auth.admin.updateUserById(user.id, {
          app_metadata: { role }
        })
      }
    }

    if (role === 'super_admin') {
      redirect('/super-admin')
    } else if (role === 'agency') {
      // Fetch subdomain
      const { data: userData } = await adminClient
        .from('users')
        .select('subdomain')
        .eq('id', user.id)
        .single()

      if (userData?.subdomain) {
        const hostname = headersList.get('host') || ''
        const mainDomain = getMainDomain(hostname)
        const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'

        // Keep users on current host in local and Vercel preview environments.
        if (isLocalHost(hostname) || isVercelPreviewHost(hostname)) {
          redirect('/agency')
        }

        const cleanMainDomain = mainDomain.replace(/^https?:\/\//, '').split(':')[0]
        const subdomainUrl = `${protocol}://${userData.subdomain}.${cleanMainDomain}/agency`
        redirect(subdomainUrl)
      }

      redirect('/agency')
    }
  }

  redirect('/')
}

