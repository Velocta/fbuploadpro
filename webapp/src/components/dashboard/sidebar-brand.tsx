'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

import { useBrand } from '@/components/brand-provider'

type SidebarBrandProps = {
  homeHref: string
  trailing?: ReactNode
}

export function SidebarBrand({ homeHref, trailing }: SidebarBrandProps) {
  const brand = useBrand()
  const brandParts = brand.name.split(' ')
  const mainPart = brandParts[0]
  const subPart = brandParts.slice(1).join(' ')

  return (
    <div className="flex items-center gap-1">
      <SidebarMenu className="min-w-0 flex-1">
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            asChild
            className="hover:bg-transparent active:bg-transparent"
          >
            <Link href={homeHref} className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 ring-1 ring-primary/20">
                <Image
                  src={brand.logoUrl}
                  alt={brand.name}
                  width={22}
                  height={22}
                  className="size-5"
                  priority
                />
              </div>
              <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                <span className="font-display text-base font-black tracking-tighter">
                  {mainPart} {subPart && <span className="text-primary italic">{subPart}</span>}
                </span>
              </div>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      {trailing}
    </div>
  )
}

