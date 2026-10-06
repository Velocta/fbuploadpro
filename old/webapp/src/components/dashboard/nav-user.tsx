'use client'

import { Coins, LogOut, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type NavUserProps = {
  name: string
  role: string
  tokensBalance?: number
  showTokens?: boolean
  onSignOut: () => void
  isSignOutPending?: boolean
}

function TokensBadge({
  tokensBalance,
  className,
}: {
  tokensBalance: number
  className?: string
}) {
  const isEmpty = tokensBalance === 0
  return (
    <Badge
      variant="outline"
      className={cn(
        'justify-center py-1.5',
        isEmpty
          ? 'border-destructive/30 bg-destructive/5 text-destructive'
          : 'border-primary/20 bg-primary/5 text-primary',
        className
      )}
    >
      <Coins className="mr-1.5 size-3.5" />
      {tokensBalance.toLocaleString()} tokens
    </Badge>
  )
}

export function NavUser({
  name,
  role,
  tokensBalance = 0,
  showTokens = false,
  onSignOut,
  isSignOutPending = false,
}: NavUserProps) {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'

  if (collapsed) {
    return (
      <SidebarFooter className="gap-2 p-2">
        <SidebarMenu>
          {showTokens ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                size="sm"
                tooltip={`${tokensBalance.toLocaleString()} tokens`}
                className={cn(
                  'justify-center',
                  tokensBalance === 0
                    ? 'text-destructive hover:text-destructive'
                    : 'text-primary hover:text-primary'
                )}
              >
                <Coins className="size-4" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 w-full text-muted-foreground hover:text-destructive"
                  onClick={onSignOut}
                  disabled={isSignOutPending}
                  aria-label="Sign out"
                >
                  {isSignOutPending ? (
                    <Loader2 className="size-4 animate-spin text-destructive" />
                  ) : (
                    <LogOut className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    )
  }

  return (
    <SidebarFooter className="gap-2 p-2">
      <div className="dashboard-sidebar-footer space-y-3">
        {showTokens ? <TokensBadge tokensBalance={tokensBalance} className="w-full" /> : null}
        <div className="px-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {role.replace(/_/g, ' ')}
          </p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={onSignOut}
          disabled={isSignOutPending}
        >
          {isSignOutPending ? (
            <Loader2 className="size-4 animate-spin text-destructive" />
          ) : (
            <LogOut className="size-4" />
          )}
          <span className="ml-2">{isSignOutPending ? 'Signing out...' : 'Sign out'}</span>
        </Button>
      </div>
    </SidebarFooter>
  )
}
