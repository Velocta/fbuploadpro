'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

type Account = { id: string; fb_user_name?: string | null }
type FbPage = { id: string; name: string; access_token: string; picture?: string }
type SavedPage = { id: string; fb_page_name: string | null; fb_page_id: string }

export function InappSchedulePagesClient() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [pages, setPages] = useState<FbPage[]>([])
  const [saved, setSaved] = useState<SavedPage[]>([])
  const [accountId, setAccountId] = useState('')
  const [pageId, setPageId] = useState('')

  const loadSaved = async () => {
    const res = await fetch('/api/v1/agency/facebook/inapp-schedule/pages')
    if (res.ok) setSaved((await res.json()).pages || [])
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial client fetch
    void loadSaved()
    void fetch('/api/v1/agency/facebook/accounts').then((r) => r.json()).then((d) => setAccounts(d.accounts || []))
  }, [])

  useEffect(() => {
    if (!accountId) return
    void fetch(`/api/v1/agency/facebook/accounts/${accountId}/pages`)
      .then((r) => r.json())
      .then((d) => setPages(d.pages || []))
  }, [accountId])

  const savePage = async () => {
    const page = pages.find((p) => p.id === pageId)
    if (!page || !accountId) {
      toast.error('Select account and page')
      return
    }
    const res = await fetch('/api/v1/agency/facebook/inapp-schedule/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        facebookAccountId: accountId,
        fbPageId: page.id,
        fbPageName: page.name,
        fbPageImage: page.picture,
        fbPageAccessToken: page.access_token,
      }),
    })
    if (!res.ok) {
      toast.error('Failed to save page')
      return
    }
    toast.success('Page saved')
    await loadSaved()
  }

  const removePage = async (id: string) => {
    await fetch(`/api/v1/agency/facebook/inapp-schedule/pages?id=${id}`, { method: 'DELETE' })
    await loadSaved()
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-4 rounded-2xl border border-border p-6">
        <Label>Account</Label>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.fb_user_name || a.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label>Page</Label>
        <Select value={pageId} onValueChange={setPageId}>
          <SelectTrigger><SelectValue placeholder="Page" /></SelectTrigger>
          <SelectContent>
            {pages.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={savePage}>Save page</Button>
      </section>
      <section className="space-y-3 rounded-2xl border border-border p-6">
        {saved.map((p) => (
          <div key={p.id} className="flex justify-between rounded-lg border p-3 text-sm">
            <span>{p.fb_page_name || p.fb_page_id}</span>
            <Button size="sm" variant="outline" onClick={() => removePage(p.id)}>Remove</Button>
          </div>
        ))}
      </section>
    </div>
  )
}
