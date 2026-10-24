import { Skeleton } from '@/components/shared/ui';

export default function TenantPromptLibraryLoading() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading prompts">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
