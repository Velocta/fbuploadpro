'use client'

import { useState } from 'react'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Building2, Users } from 'lucide-react'
import { AllocateTokensDialog } from './allocate-tokens-dialog'
import { AgencyEmptyState, AgencySectionCard } from '@/components/dashboard/agency'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type AgencyListItem = {
    id: string
    name: string | null
    email: string
    phone_number?: string | null
    tokens_balance: number | null
    is_active_override: boolean | null
    adu_total_pages?: number
    adu_active_pages?: number
    adu_followers_gained?: number
    adu_changed_followers?: number
    inapp_total_pages?: number
    inapp_active_pages?: number
    inapp_followers_gained?: number
    inapp_changed_followers?: number
    combined_total_pages?: number
    combined_active_pages?: number
    combined_followers_gained?: number
    combined_changed_followers?: number
}

interface AgenciesViewProps {
    agencies: AgencyListItem[]
}

export function AgenciesView({ agencies }: AgenciesViewProps) {
    const [sortBy, setSortBy] = useState<string>('default')

    const sortAgencies = (list: AgencyListItem[]) => {
        const sorted = [...list]
        if (sortBy === 'pages-desc') {
            return sorted.sort((a, b) => (b.combined_total_pages ?? 0) - (a.combined_total_pages ?? 0))
        }
        if (sortBy === 'followers-gained-desc') {
            return sorted.sort((a, b) => (b.combined_changed_followers ?? 0) - (a.combined_changed_followers ?? 0))
        }
        if (sortBy === 'followers-total-desc') {
            return sorted.sort((a, b) => (b.combined_followers_gained ?? 0) - (a.combined_followers_gained ?? 0))
        }
        return sorted
    }

    const payingClients = sortAgencies(agencies.filter((agency) => (agency.tokens_balance || 0) > 0))
    const unpaidClients = sortAgencies(agencies.filter((agency) => (agency.tokens_balance || 0) <= 0))

    if (agencies.length === 0) {
        return (
            <AgencyEmptyState
                icon={<Building2 className="h-6 w-6" />}
                title="No agencies found"
                description="No agency accounts are currently available. New agencies will appear here once they sign up."
                action={{ label: 'Refresh list', onClick: () => window.location.reload() }}
            />
        )
    }

    const renderAgenciesTable = (rows: AgencyListItem[]) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Agency Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-center">Token Balance</TableHead>
                    <TableHead className="text-center">ADU (Active/Total)</TableHead>
                    <TableHead className="text-center">InApp (Active/Total)</TableHead>
                    <TableHead className="text-center">Combined (Active/Total)</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((agency) => (
                    <TableRow key={agency.id}>
                        <TableCell>
                            <div className="flex items-center font-medium">
                                <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                                {agency.name || 'N/A'}
                            </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{agency.email}</TableCell>
                        <TableCell className="text-muted-foreground">
                            {agency.phone_number && agency.phone_number.trim() ? agency.phone_number : 'N/A'}
                        </TableCell>
                        <TableCell className="text-center font-mono font-semibold">
                            {agency.tokens_balance?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                            <div className="font-mono">
                                {(agency.adu_active_pages ?? 0).toLocaleString()} / {(agency.adu_total_pages ?? 0).toLocaleString()}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono flex items-center justify-center gap-1 mt-0.5">
                                <span>👥 {(agency.adu_followers_gained ?? 0).toLocaleString()}</span>
                                <span className={
                                    (agency.adu_changed_followers ?? 0) > 0 ? "text-emerald-500 font-medium" : 
                                    (agency.adu_changed_followers ?? 0) < 0 ? "text-rose-500 font-medium" : "text-muted-foreground"
                                }>
                                    ({(agency.adu_changed_followers ?? 0) >= 0 ? "+" : ""}{(agency.adu_changed_followers ?? 0).toLocaleString()})
                                </span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                            <div className="font-mono">
                                {(agency.inapp_active_pages ?? 0).toLocaleString()} / {(agency.inapp_total_pages ?? 0).toLocaleString()}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono flex items-center justify-center gap-1 mt-0.5">
                                <span>👥 {(agency.inapp_followers_gained ?? 0).toLocaleString()}</span>
                                <span className={
                                    (agency.inapp_changed_followers ?? 0) > 0 ? "text-emerald-500 font-medium" : 
                                    (agency.inapp_changed_followers ?? 0) < 0 ? "text-rose-500 font-medium" : "text-muted-foreground"
                                }>
                                    ({(agency.inapp_changed_followers ?? 0) >= 0 ? "+" : ""}{(agency.inapp_changed_followers ?? 0).toLocaleString()})
                                </span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                            <div className="font-mono">
                                {(agency.combined_active_pages ?? 0).toLocaleString()} / {(agency.combined_total_pages ?? 0).toLocaleString()}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono flex items-center justify-center gap-1 mt-0.5">
                                <span>👥 {(agency.combined_followers_gained ?? 0).toLocaleString()}</span>
                                <span className={
                                    (agency.combined_changed_followers ?? 0) > 0 ? "text-emerald-500 font-medium" : 
                                    (agency.combined_changed_followers ?? 0) < 0 ? "text-rose-500 font-medium" : "text-muted-foreground"
                                }>
                                    ({(agency.combined_changed_followers ?? 0) >= 0 ? "+" : ""}{(agency.combined_changed_followers ?? 0).toLocaleString()})
                                </span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center">
                            <Badge variant={agency.is_active_override ? "outline" : "destructive"}>
                                {agency.is_active_override ? "Active" : "Suspended"}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <AllocateTokensDialog
                                agencyId={agency.id}
                                agencyName={agency.name || agency.email}
                            />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )

    return (
        <div className="space-y-6 agency-motion-standard">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="font-display text-2xl font-semibold tracking-tight">Agencies management</h2>
                    <p className="text-muted-foreground">View and manage all registered agency accounts and their token balances.</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sort By:</span>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[240px] bg-card border-border shadow-sm">
                            <SelectValue placeholder="Select sorting..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="default">Default order</SelectItem>
                            <SelectItem value="pages-desc">Most pages (ADU + InApp)</SelectItem>
                            <SelectItem value="followers-gained-desc">Most followers gained (Net)</SelectItem>
                            <SelectItem value="followers-total-desc">Most total followers (Latest)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <AgencySectionCard>
                <CardHeader>
                    <CardTitle className="flex items-center text-sm font-semibold">
                        <Users className="mr-2 h-4 w-4" />
                        Paying Clients ({payingClients.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        Agencies with a token balance greater than zero.
                    </p>
                    {payingClients.length > 0 ? (
                        renderAgenciesTable(payingClients)
                    ) : (
                        <p className="text-sm text-muted-foreground">No paying clients found.</p>
                    )}
                </CardContent>
            </AgencySectionCard>

            <AgencySectionCard>
                <CardHeader>
                    <CardTitle className="flex items-center text-sm font-semibold">
                        <Users className="mr-2 h-4 w-4" />
                        Unpaid Clients ({unpaidClients.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        Agencies with zero token balance.
                    </p>
                    {unpaidClients.length > 0 ? (
                        renderAgenciesTable(unpaidClients)
                    ) : (
                        <p className="text-sm text-muted-foreground">No unpaid clients found.</p>
                    )}
                </CardContent>
            </AgencySectionCard>
        </div>
    )
}
