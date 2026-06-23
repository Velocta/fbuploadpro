import Link from 'next/link'
import Image from 'next/image'
import { AgencyGlassPageHero } from '@/components/dashboard/agency'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ExternalLink, CalendarPlus } from 'lucide-react'
import { DeleteInappPageDialog } from '../delete-inapp-page-dialog'
import { InappComposerDialog } from './inapp-composer-dialog'
import { BulkInappComposerDialog } from './bulk-inapp-composer-dialog'

interface FacebookAccount {
  fb_user_name: string | null
  fb_user_image: string | null
}

interface InappPage {
  id: string
  fb_page_id: string
  fb_page_name: string | null
  fb_page_image: string | null
  facebook_accounts: FacebookAccount | FacebookAccount[] | null
}

export function InappPageDetailHeader({
  page,
  stats,
}: {
  page: InappPage
  stats: { pending: number; posted: number; failed: number }
}) {
  const fbAccount = Array.isArray(page.facebook_accounts)
    ? page.facebook_accounts[0]
    : page.facebook_accounts

  const facebookLink = `https://facebook.com/${page.fb_page_id}`

  return (
    <AgencyGlassPageHero
      segments={[
        { label: 'Agency', href: '/agency' },
        { label: 'InApp Schedule', href: '/agency/facebook/inapp-schedule' },
        { label: page.fb_page_name || 'Page Details' },
      ]}
      title={page.fb_page_name || 'Facebook Page'}
      description={
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {fbAccount?.fb_user_name && (
            <Badge variant="outline" className="gap-1.5 border-primary/20 bg-primary/5 text-xs text-primary">
              <span className="opacity-70">via</span>
              {fbAccount.fb_user_name}
            </Badge>
          )}
          <Badge variant="secondary" className="gap-1 bg-background/50 text-xs">
            {page.fb_page_id}
          </Badge>
          <div className="h-1 w-1 rounded-full bg-border/50" />
          <div className="flex gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              {stats.pending} pending
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {stats.posted} posted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              {stats.failed} failed
            </span>
          </div>
        </div>
      }
      icon={
        page.fb_page_image ? (
          <Image
            src={page.fb_page_image}
            alt={page.fb_page_name || 'Page'}
            width={48}
            height={48}
            className="rounded-xl ring-2 ring-primary/20"
            unoptimized
          />
        ) : null
      }
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="gap-2 rounded-full" asChild>
            <Link href="/agency/facebook/inapp-schedule">
              <ArrowLeft className="h-4 w-4" />
              Hub
            </Link>
          </Button>

          <Button variant="outline" className="gap-2 rounded-full" asChild>
            <a href={facebookLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              View Page
            </a>
          </Button>

          <DeleteInappPageDialog
            pageId={page.id}
            pageName={page.fb_page_name || 'Page'}
            redirectToHub
          />

          <BulkInappComposerDialog pageId={page.id}>
            <Button variant="outline" className="gap-2 rounded-full">
              <CalendarPlus className="h-4 w-4" />
              Bulk Queue
            </Button>
          </BulkInappComposerDialog>

          <InappComposerDialog pageId={page.id}>
            <Button className="gap-2 rounded-full bg-primary px-6 hover:bg-primary/90">
              <CalendarPlus className="h-4 w-4" />
              Schedule Post
            </Button>
          </InappComposerDialog>
        </div>
      }
    />
  )
}
