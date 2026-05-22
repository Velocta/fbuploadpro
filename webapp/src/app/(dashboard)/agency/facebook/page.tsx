import { redirect } from 'next/navigation'

export default function LegacyFacebookRedirect() {
  redirect('/agency/facebook/accounts')
}
