import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft,
  Facebook,
  Instagram,
  Link2,
  Music,
  Trash2,
  Users,
  Youtube,
} from 'lucide-react'

import { AgencyGlassPageHero } from '@/components/dashboard/agency'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getAduPageStatusBadge } from '@/lib/adu-page-detail-status'
import { formatPageAddedDate, formatPageAge } from '@/lib/page-age'
import { cn } from '@/lib/utils'

import { DeletePageDialog } from '../delete-page-dialog'
import { AduStatusIcon } from './adu-status-icon'
import { PageToggle } from './page-toggle'
import type { Page } from './settings-form'

export type PageDetailProfile = Page & {
  sync_status?: string | null
  created_at?: string | null
  followers_count?: number | null
  followers_gained?: number | null
}

type SourcePlatform = 'instagram' | 'youtube' | 'tiktok' | 'facebook'

function sourceProfileUrl(sourcePlatform: SourcePlatform, sourceUsername: string): string {
  if (sourcePlatform === 'instagram') return `https://instagram.com/${sourceUsername}`
  if (sourcePlatform === 'youtube') return `https://youtube.com/@${sourceUsername}`
  if (sourcePlatform === 'tiktok') return `https://tiktok.com/@${sourceUsername}`
  if (sourcePlatform === 'facebook') return `https://facebook.com/${sourceUsername}`
  return '#'
}

function sourceIdentityLabel(sourcePlatform: SourcePlatform, sourceUsername: string): string {
  return sourcePlatform === 'facebook' ? sourceUsername : `@${sourceUsername}`
}

export function PageDetailHeader({ profile }: { profile: PageDetailProfile }) {
  const currentFollowers = profile.followers_gained || 0
  const startingFollowers = profile.followers_count || 0
  const followersDelta = currentFollowers - startingFollowers
  const addedDate = formatPageAddedDate(profile.created_at)
  const pageAge = formatPageAge(profile.created_at)
  const statusBadge = getAduPageStatusBadge(profile)
  const fbAccount = profile.facebook_accounts

  return (
    <AgencyGlassPageHero
      segments={[
        { label: 'Agency', href: '/agency' },
        { label: 'Auto Download/Upload', href: '/agency/facebook/auto-download-upload' },
        { label: profile.page_name || 'Page' },
      ]}
      title={
        <span className="flex flex-wrap items-center gap-3">
          {profile.page_name}
          <Badge variant={statusBadge.variant} className={cn('text-xs font-semibold', statusBadge.className)}>
            {statusBadge.iconKind !== 'none' ? (
              <AduStatusIcon kind={statusBadge.iconKind} className="mr-1.5" />
            ) : null}
            {statusBadge.label}
          </Badge>
        </span>
      }
      description={`Internal ID: ${profile.fb_page_id}`}
      leading={
        profile.fb_page_image ? (
          <div className="relative h-16 w-16 overflow-hidden rounded-2xl ring-2 ring-primary/20">
            <Image src={profile.fb_page_image} alt="" fill className="object-cover" unoptimized />
          </div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-2 ring-primary/20">
            <Facebook className="h-8 w-8 text-primary" />
          </div>
        )
      }
      actions={
        <>
          <PageToggle pageId={profile.id} initialStatus={profile.status || 'inactive'} />
          <Button variant="outline" className="h-11 rounded-xl" asChild>
            <Link href="/agency/facebook/auto-download-upload">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Hub
            </Link>
          </Button>
          <DeletePageDialog
            pageId={profile.id}
            pageName={profile.page_name}
            redirectToHub
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            }
          />
        </>
      }
    >
      <div className="flex flex-wrap gap-2 pt-2">
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/50 bg-background/30 px-3 py-1.5 text-xs font-semibold">
          <Users className="h-3.5 w-3.5 text-primary" />
          {currentFollowers.toLocaleString()} followers
        </span>
        <span
          className={cn(
            'inline-flex items-center rounded-xl border border-border/50 bg-background/30 px-3 py-1.5 text-xs font-semibold',
            followersDelta >= 0 ? 'text-primary' : 'text-destructive',
          )}
        >
          {followersDelta > 0 ? '+' : ''}
          {followersDelta.toLocaleString()} gained
        </span>
        <span className="inline-flex items-center rounded-xl border border-border/50 bg-background/30 px-3 py-1.5 text-xs text-muted-foreground">
          Starting {startingFollowers.toLocaleString()} · Added {addedDate} · {pageAge}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        {profile.fb_page_id ? (
          <a
            href={`https://facebook.com/${profile.fb_page_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 rounded-xl border border-border/50 bg-background/30 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary/30"
          >
            <Facebook className="h-3 w-3" />
            Facebook Page
            <Link2 className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
          </a>
        ) : null}
        {profile.source_username ? (
          <a
            href={sourceProfileUrl(profile.source_platform, profile.source_username)}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 rounded-xl border border-border/50 bg-background/30 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary/30"
          >
            {profile.source_platform === 'instagram' && <Instagram className="h-3 w-3" />}
            {profile.source_platform === 'youtube' && <Youtube className="h-3 w-3" />}
            {profile.source_platform === 'tiktok' && <Music className="h-3 w-3" />}
            {profile.source_platform === 'facebook' && <Facebook className="h-3 w-3" />}
            <span className="capitalize">
              {profile.source_platform}: {sourceIdentityLabel(profile.source_platform, profile.source_username)}
            </span>
            <Link2 className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
          </a>
        ) : null}
        {fbAccount ? (
          <div className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-background/30 px-3 py-1.5 text-xs">
            <span className="font-semibold uppercase tracking-wide text-muted-foreground">Owner</span>
            <div className="relative h-5 w-5 overflow-hidden rounded-full border border-border">
              {fbAccount.fb_user_image ? (
                <Image src={fbAccount.fb_user_image} alt="" fill className="object-cover" unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <Facebook className="h-2.5 w-2.5 text-muted-foreground" />
                </div>
              )}
            </div>
            <span className="font-semibold text-foreground">{fbAccount.fb_user_name}</span>
          </div>
        ) : null}
      </div>
    </AgencyGlassPageHero>
  )
}
