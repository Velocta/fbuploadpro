'use client'

import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Building2, Users } from 'lucide-react'
import { AllocateTokensDialog } from './allocate-tokens-dialog'
import { AgencyEmptyState, AgencySectionCard } from '@/components/dashboard/agency'

export type AgencyListItem = {
    id: string
    name: string | null
    email: string
    phone_number?: string | null
    tokens_balance: number | null
    is_active_override: boolean | null
    adu_total_pages?: number
    adu_active_pages?: number
    inapp_total_pages?: number
    inapp_active_pages?: number
    combined_total_pages?: number
    combined_active_pages?: number
}

interface AgenciesViewProps {
    agencies: AgencyListItem[]
}

export function AgenciesView({ agencies }: AgenciesViewProps) {
    const payingClients = agencies.filter((agency) => (agency.tokens_balance || 0) > 0)
    const unpaidClients = agencies.filter((agency) => (agency.tokens_balance || 0) <= 0)

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
                        <TableCell className="text-center font-mono font-semibold">
                            {(agency.adu_active_pages ?? 0).toLocaleString()} / {(agency.adu_total_pages ?? 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center font-mono font-semibold">
                            {(agency.inapp_active_pages ?? 0).toLocaleString()} / {(agency.inapp_total_pages ?? 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center font-mono font-semibold">
                            {(agency.combined_active_pages ?? 0).toLocaleString()} / {(agency.combined_total_pages ?? 0).toLocaleString()}
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
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-display text-2xl font-semibold tracking-tight">Agencies management</h2>
                    <p className="text-muted-foreground">View and manage all registered agency accounts and their token balances.</p>
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
