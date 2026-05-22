import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { TerminalBreadcrumbs } from '@/components/dashboard/terminal-breadcrumbs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Activity,
  Settings2,
  UserX,
  ShieldAlert,
  KeyRound,
  Facebook,
  Instagram,
  Youtube,
  Link2,
  Trash2,
  RefreshCcw,
  Users,
  Music
} from 'lucide-react'
import { SettingsForm } from './settings-form'
import { DeletePageDialog } from '../delete-page-dialog'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { PageToggle } from './page-toggle'
import { Page } from './settings-form'
import { formatPageAddedDate, formatPageAge } from '@/lib/page-age'
import { cn } from '@/lib/utils'

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

export default async function PageDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch Page Data
  const { data: profile } = await supabase
    .from('pages')
    .select(`
      id, 
      page_name, 
      source_platform, 
      source_username, 
      fb_page_access_token, 
      fb_page_id, 
      posts_per_day, 
      schedule_type, 
      status, 
      timezone, 
      posting_times, 
      fb_page_image, 
      sync_status, 
      created_at,
      followers_count,
      followers_gained,
      pending_reels_count,
      posted_reels_count,
      failed_reels_count,
      facebook_accounts(fb_user_name, fb_user_id, fb_user_image)
    `)
    .eq('id', id)
    .single()

  const pendingReels = profile?.pending_reels_count || 0
  const postedReels = profile?.posted_reels_count || 0
  const failedReels = profile?.failed_reels_count || 0
  const currentFollowers = profile?.followers_gained || 0
  const startingFollowers = profile?.followers_count || 0
  const followersDelta = currentFollowers - startingFollowers
  const addedDate = formatPageAddedDate(profile?.created_at)
  const pageAge = formatPageAge(profile?.created_at)

  if (!profile) return notFound()

  return (
    <div className="space-y-6 agency-motion-standard">
      {/* Terminal-like Path Navigation */}
      <TerminalBreadcrumbs
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'Pages', href: '/agency/pages' },
          { label: profile.page_name || 'Page' }
        ]}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          {(profile as Page).fb_page_image ? (
            <div className="relative h-16 w-16">
              <Image
                src={(profile as Page).fb_page_image!}
                alt=""
                fill
                className="rounded-xl border-2 border-white shadow-sm object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center border-2 border-white shadow-sm">
              <Facebook className="h-8 w-8 text-primary" />
            </div>
          )}
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                {profile.page_name}
              </h1>
              {/* Dynamic Status Badge */}
              {(() => {
                let badgeText = "";
                let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "default";
                let badgeClassName = "px-3 py-1 text-xs font-semibold";
                let icon = null;

                if (profile.sync_status === 'error') {
                  badgeText = "unable to find the username please check if the username exists";
                  badgeVariant = "destructive";
                } else if (profile.sync_status === 'processing') {
                  badgeText = "Your reels are being scraped";
                  badgeClassName += " bg-secondary hover:bg-secondary/90 text-secondary-foreground border-none";
                  icon = <RefreshCcw className="h-3.5 w-3.5 animate-spin mr-1.5" />;
                } else if (profile.sync_status === 'pending') {
                  badgeText = "Your reels will be scraped soon, please wait";
                  badgeClassName += " bg-secondary hover:bg-secondary/90 text-secondary-foreground border-none";
                  icon = <Clock className="h-3.5 w-3.5 mr-1.5" />;
                } else if (profile.sync_status === 'synced') {
                  switch (profile.status) {
                    case 'active':
                      badgeText = "Active Posting";
                      badgeClassName += " bg-primary hover:bg-primary/90 text-primary-foreground border-none";
                      icon = <span className="mr-2 flex h-1.5 w-1.5 rounded-full bg-primary-foreground" />;
                      break;
                    case 'inactive':
                      badgeText = "Posting Inactive";
                      badgeVariant = "secondary";
                      break;
                    case 'fb_verification_required':
                      badgeText = "Verification Required";
                      badgeVariant = "destructive";
                      break;
                    case 'invalid_token':
                      badgeText = "Invalid Token";
                      badgeVariant = "destructive";
                      break;
                    case '2fa_required_on_BM':
                      badgeText = "BM 2FA Required";
                      badgeVariant = "destructive";
                      icon = <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />;
                      break;
                    case 'check_developer_app':
                      badgeText = "Check Developer App";
                      badgeVariant = "destructive";
                      icon = <AlertCircle className="h-3.5 w-3.5 mr-1.5" />;
                      break;
                    case 'account_suspended':
                      badgeText = "Account Suspended";
                      badgeVariant = "destructive";
                      icon = <UserX className="h-3.5 w-3.5 mr-1.5" />;
                      break;
                    case 'invalid_username':
                      badgeText = "Source Disabled";
                      badgeVariant = "destructive";
                      break;
                    case 'completed':
                      badgeText = "All Reels Posted";
                      badgeVariant = "outline";
                      icon = <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-primary" />;
                      break;
                    default:
                      badgeText = (profile.status as string | null)?.replace('_', ' ') || 'Unknown';
                      badgeVariant = "outline";
                  }
                }

                return (
                  <Badge variant={badgeVariant} className={badgeClassName}>
                    {icon}
                    {badgeText}
                  </Badge>
                );
              })()}
            </div>
            <p className="mt-1 flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
              Internal ID: {profile.fb_page_id}
            </p>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-primary font-bold tracking-wide uppercase">
              <Users className="h-3.5 w-3.5" />
              <span>{currentFollowers.toLocaleString()} followers</span>
            </div>
            <div className="text-xs font-semibold tracking-wide text-muted-foreground">
              Starting followers: {startingFollowers.toLocaleString()}
            </div>
            <div className={cn(
              "text-xs font-semibold tracking-wide",
              followersDelta >= 0 ? "text-primary" : "text-destructive"
            )}>
              Followers gained: {followersDelta > 0 ? '+' : ''}{followersDelta.toLocaleString()}
            </div>
            <div className="text-xs tracking-wide text-muted-foreground">
              Added {addedDate} • Live for {pageAge}
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 mt-2">
              {profile.fb_page_id && (
                <a
                  href={`https://facebook.com/${profile.fb_page_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 transition-colors group w-fit"
                >
                  <Facebook className="h-3 w-3" />
                  <span>Facebook Page</span>
                  <Link2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              )}
              {profile.source_username && (
                <a
                  href={sourceProfileUrl(profile.source_platform as SourcePlatform, profile.source_username || '')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 transition-colors group w-fit"
                >
                  {profile.source_platform === 'instagram' && <Instagram className="h-3 w-3" />}
                  {profile.source_platform === 'youtube' && <Youtube className="h-3 w-3" />}
                  {profile.source_platform === 'tiktok' && <Music className="h-3 w-3" />}
                  {profile.source_platform === 'facebook' && <Facebook className="h-3 w-3" />}
                  <span className="capitalize">{profile.source_platform}: {sourceIdentityLabel(profile.source_platform as SourcePlatform, profile.source_username || '')}</span>
                  <Link2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              )}

              {/* Connected Facebook Account */}
              {(profile as Page).facebook_accounts && (
                <div className="flex h-full items-center gap-2 border-l border-border/70 pl-4">
                  <div className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owner:</div>
                  <div className="relative h-4 w-4 overflow-hidden rounded-full border border-border">
                    {(profile as Page).facebook_accounts?.fb_user_image ? (
                      <Image
                        src={(profile as Page).facebook_accounts?.fb_user_image || ''}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Facebook className="h-2 w-2 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {(profile as Page).facebook_accounts?.fb_user_name}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <PageToggle pageId={profile.id} initialStatus={profile.status || 'inactive'} />
          <Link href="/agency/pages">
            <Button variant="outline" size="sm">Back to Hub</Button>
          </Link>
          <DeletePageDialog
            pageId={profile.id}
            pageName={profile.page_name}
            redirectToHub={true}
            trigger={
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive hover:text-destructive/80 hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </div>

      {/* Logic-Based Guidance Alerts */}
      <div className="space-y-4">
        {(() => {
          let alertTitle = "";
          let alertDescription = "";
          let alertVariant: "default" | "destructive" = "default";
          let alertIcon = <AlertCircle className="h-4 w-4" />;

          if (profile.sync_status === 'error') {
            alertTitle = "Username Not Found";
            alertDescription = "unable to find the username please check if the username exists";
            alertVariant = "destructive";
          } else if (profile.sync_status === 'processing') {
            alertTitle = "Scraping in Progress";
            alertDescription = "Your reels are being scraped";
            alertIcon = <RefreshCcw className="h-4 w-4 animate-spin" />;
          } else if (profile.sync_status === 'pending') {
            alertTitle = "Scraping Pending";
            alertDescription = "Your reels will be scraped soon, please wait";
            alertIcon = <Clock className="h-4 w-4" />;
          } else if (profile.sync_status === 'synced') {
            switch (profile.status) {
              case 'active':
                return null; // Don't show alert for active synced pages
              case 'inactive':
                alertTitle = "Posting Inactive";
                alertDescription = "Posting Inactive / Activate via toggle";
                break;
              case 'fb_verification_required':
                alertTitle = "Facebook Verification Required";
                alertDescription = "Facebook Verification Required. Please login to your Facebook page using a mobile device to confirm verification, then activate automation.";
                alertVariant = "destructive";
                alertIcon = <ShieldAlert className="h-4 w-4" />;
                break;
              case 'invalid_token':
                alertTitle = "Access Token Expired";
                alertDescription = "Please go to the Facebook Accounts section and reconnect your account. Your access token has expired or been revoked.";
                alertVariant = "destructive";
                alertIcon = <KeyRound className="h-4 w-4" />;
                break;
              case '2fa_required_on_BM':
                alertTitle = "Business 2FA Required";
                alertDescription = "The connected Facebook user must be an admin/editor/moderator on this page and complete required Business Manager two-factor authentication. Update role/2FA, then reconnect the account.";
                alertVariant = "destructive";
                alertIcon = <ShieldAlert className="h-4 w-4" />;
                break;
              case 'check_developer_app':
                alertTitle = "Developer App Access Blocked";
                alertDescription = "Facebook API access is blocked for this page/app combination. Review your Meta Developer app status, app mode, permissions, and policy compliance, then reconnect.";
                alertVariant = "destructive";
                alertIcon = <AlertCircle className="h-4 w-4" />;
                break;
              case 'account_suspended':
                alertTitle = "Facebook Account Suspended";
                alertDescription = "The connected Facebook user is not allowed to create valid sessions right now. Confirm the account is active/verified in Facebook and reconnect from the Facebook Accounts section.";
                alertVariant = "destructive";
                alertIcon = <UserX className="h-4 w-4" />;
                break;
              case 'invalid_username':
                alertTitle = "Source Account Disabled";
                alertDescription = "Your selected source account may be disabled or inaccessible. Verify the source account is active, then update source details in Settings > Source if needed.";
                alertVariant = "destructive";
                alertIcon = <UserX className="h-4 w-4" />;
                break;
              case 'completed':
                alertTitle = "All Reels Posted";
                alertDescription = "All reels posted. You can update Settings > Source to a different source account to continue posting.";
                alertIcon = <CheckCircle2 className="h-4 w-4" />;
                break;
              default:
                return null;
            }
          }

          return (
            <Alert variant={alertVariant} className={alertVariant === 'destructive' ? "border-destructive/20 bg-destructive/10 text-destructive shadow-sm" : "shadow-sm"}>
              {alertIcon}
              <AlertTitle className={alertVariant === 'destructive' ? "text-destructive font-bold" : "font-bold"}>{alertTitle}</AlertTitle>
              <AlertDescription className={alertVariant === 'destructive' ? "text-destructive/90 space-y-2" : "space-y-2"}>
                <p>{alertDescription}</p>
              </AlertDescription>
            </Alert>
          );
        })()}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <div className="flex justify-center md:justify-start">
          <TabsList className="rounded-lg border border-border/70 bg-muted/50 p-1">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Activity className="h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" /> Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6 agency-motion-standard">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-sm transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Pending</CardTitle>
                <Clock className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingReels || 0}</div>
                <p className="pt-1 text-xs text-muted-foreground">Reels ready for posting</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-sm transition-shadow border-primary/20 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-primary">Total Posted</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{postedReels || 0}</div>
                <p className="pt-1 text-xs text-muted-foreground">Successful automations</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-sm transition-shadow border-destructive/20 bg-destructive/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-destructive">Failed Posts</CardTitle>
                <XCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{failedReels || 0}</div>
                <p className="pt-1 text-xs text-muted-foreground">Require attention</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-sm transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Followers Gained</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className={cn(
                  "text-2xl font-bold",
                  followersDelta >= 0 ? "text-primary" : "text-destructive"
                )}>
                  {followersDelta > 0 ? '+' : ''}{followersDelta.toLocaleString()}
                </div>
                <p className="pt-1 text-xs text-muted-foreground">Net growth since page onboarding</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="agency-motion-standard">
          <SettingsForm profile={profile as unknown as Page} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
