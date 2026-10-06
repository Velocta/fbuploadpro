/**
 * Async upload concurrency queue.
 * Limits concurrent active network uploads to prevent connection saturation,
 * gateway timeouts (504s), and socket starvation.
 */

export const DEFAULT_UPLOAD_CONCURRENCY = 4

interface QueueEntry {
  id: string
  task: (signal: AbortSignal) => Promise<void>
  abortController: AbortController
}

export class AsyncUploadQueue {
  private concurrency: number
  private running = new Map<string, AbortController>()
  private queue: QueueEntry[] = []

  constructor(concurrency: number = DEFAULT_UPLOAD_CONCURRENCY) {
    this.concurrency = Math.max(1, concurrency)
  }

  /**
   * Enqueue a new upload task. If active uploads < concurrency, execution starts immediately.
   */
  add(id: string, task: (signal: AbortSignal) => Promise<void>): void {
    const abortController = new AbortController()
    this.queue.push({ id, task, abortController })
    this.processNext()
  }

  /**
   * Cancel an upload by item ID, either removing it from the pending queue
   * or aborting its active in-flight request.
   */
  cancel(id: string): void {
    // If waiting in queue, remove it
    const index = this.queue.findIndex((entry) => entry.id === id)
    if (index !== -1) {
      const [removed] = this.queue.splice(index, 1)
      removed?.abortController.abort()
      return
    }

    // If currently running, abort it and advance the queue
    const activeController = this.running.get(id)
    if (activeController) {
      activeController.abort()
      this.running.delete(id)
      this.processNext()
    }
  }

  /**
   * Clear and abort all pending and running upload tasks.
   */
  clear(): void {
    for (const entry of this.queue) {
      entry.abortController.abort()
    }
    this.queue = []

    for (const controller of this.running.values()) {
      controller.abort()
    }
    this.running.clear()
  }

  get runningCount(): number {
    return this.running.size
  }

  get pendingCount(): number {
    return this.queue.length
  }

  private processNext(): void {
    while (this.running.size < this.concurrency && this.queue.length > 0) {
      const entry = this.queue.shift()
      if (!entry) break

      if (entry.abortController.signal.aborted) {
        continue
      }

      this.running.set(entry.id, entry.abortController)

      entry
        .task(entry.abortController.signal)
        .catch(() => {
          // Task errors are handled by caller in task implementation
        })
        .finally(() => {
          this.running.delete(entry.id)
          this.processNext()
        })
    }
  }
}
