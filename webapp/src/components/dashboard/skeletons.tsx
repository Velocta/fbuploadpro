import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function DashboardOverviewSkeleton() {
    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="border-border bg-card/50 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-5 w-5 rounded-full" />
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <Skeleton className="h-10 w-32" />
                        <div className="space-y-2">
                            <Skeleton className="h-2 w-full" />
                            <Skeleton className="h-3 w-16 ml-auto" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

export function SuperAdminOverviewSkeleton() {
    return (
        <div className="space-y-6">
            <div className="h-10 w-56 rounded-xl border border-border bg-muted/40" />
            <div className="grid gap-4 md:grid-cols-2">
                {[1, 2].map((i) => (
                    <Card key={i} className="agency-surface-card">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-4 w-4 rounded-full" />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Skeleton className="h-8 w-20" />
                            <Skeleton className="h-3 w-40" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <Card className="agency-surface-card">
                <CardHeader>
                    <Skeleton className="h-4 w-40" />
                </CardHeader>
                <CardContent className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}

export function TableSkeleton() {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-[250px]" />
                <Skeleton className="h-8 w-[100px]" />
            </div>
            <div className="rounded-md border">
                <div className="p-4">
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                            <div key={i} className="flex items-center justify-between gap-4">
                                <Skeleton className="h-12 w-full" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
