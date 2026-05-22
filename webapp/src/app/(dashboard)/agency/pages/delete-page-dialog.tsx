'use client'

import { useState, useTransition } from 'react'
import { deletePage } from '@/app/(dashboard)/agency/pages/actions'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface DeletePageDialogProps {
  pageId: string
  pageName: string
  redirectToHub?: boolean
  trigger?: React.ReactNode
}

export function DeletePageDialog({
  pageId,
  pageName,
  redirectToHub = false,
  trigger
}: DeletePageDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deletePage(pageId)
      if (result?.success) {
        toast.success('Page deleted', {
          description: `${pageName} has been permanently deleted.`,
        })
        setOpen(false)
        if (redirectToHub) {
          router.push('/agency/pages')
        }
      } else if (result?.error) {
        toast.error('Failed to delete page', {
          description: result.error,
        })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 flex-1">
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Delete
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3 text-destructive mb-2">
            <AlertTriangle className="h-6 w-6" />
            <DialogTitle className="text-xl">Delete Page</DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            This action cannot be undone. This will permanently delete the page
            <span className="font-bold text-foreground"> &quot;{pageName}&quot; </span>
            and remove all of its data from our servers.
            the profile and all associated reel records from our database.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 rounded-md border border-destructive/20 bg-destructive/10 p-3">
          <p className="text-xs font-medium text-destructive/90">
            Warning: This action is irreversible and cannot be undone.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            loading={isPending}
            className="px-6"
          >
            Permanently Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
