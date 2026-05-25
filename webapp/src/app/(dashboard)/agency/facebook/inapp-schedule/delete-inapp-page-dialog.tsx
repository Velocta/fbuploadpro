'use client'

import { useState, useTransition } from 'react'
import { motion } from 'framer-motion'
import { deleteInappPageAction } from './actions'
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

interface DeleteInappPageDialogProps {
  pageId: string
  pageName: string
  redirectToHub?: boolean
  trigger?: React.ReactNode
}

export function DeleteInappPageDialog({
  pageId,
  pageName,
  redirectToHub = false,
  trigger,
}: DeleteInappPageDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteInappPageAction(pageId)
      if (result?.success) {
        toast.success('Page deleted', {
          description: `${pageName} has been removed from InApp Schedule.`,
        })
        setOpen(false)
        if (redirectToHub) {
          router.push('/agency/facebook/inapp-schedule')
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
          <Button
            variant="outline"
            size="sm"
            className="rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="border-0 bg-transparent p-0 shadow-none sm:max-w-[440px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden rounded-3xl border border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl"
        >
          <DialogHeader className="space-y-4 border-b border-border/50 px-6 py-5 text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/20">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <DialogTitle className="font-display text-xl">Delete Page</DialogTitle>
              <DialogDescription className="mt-2 text-muted-foreground">
                This will remove{' '}
                <strong className="text-foreground">&quot;{pageName}&quot;</strong> from InApp Schedule.
                Scheduled posts that haven't been published yet will no longer be visible here.
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="mx-6 mt-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-xs font-medium text-destructive/90">
              Warning: This action is irreversible.
            </p>
          </div>
          <DialogFooter className="gap-2 px-6 py-5 sm:justify-end">
            <Button
              variant="ghost"
              className="rounded-xl"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              loading={isPending}
              className="rounded-xl px-6"
            >
              Remove
            </Button>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
