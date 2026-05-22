import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function DashboardSkeleton() {
    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
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
