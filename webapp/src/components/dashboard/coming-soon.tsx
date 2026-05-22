import { Construction } from 'lucide-react'

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <section className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-8 py-16 text-center">
      <div className="mb-4 rounded-full border border-primary/20 bg-primary/10 p-4">
        <Construction className="h-8 w-8 text-primary" />
      </div>
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {description ?? 'This feature is coming soon. Check back later.'}
      </p>
    </section>
  )
}
