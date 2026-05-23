'use client'

import { Coins, LogOut } from 'lucide-react'

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
                  aria-label="Sign out"
                >
                  <LogOut className="size-4" />
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
        >
          <LogOut className="size-4" />
          <span className="ml-2">Sign out</span>
        </Button>
      </div>
    </SidebarFooter>
  )
}
