import { Skeleton } from '@/components/shared/ui/skeleton';

export default function DownloaderLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-260 flex-col gap-6 p-6"
      aria-busy="true"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-160" />
      </div>
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
