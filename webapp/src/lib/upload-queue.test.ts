import assert from 'node:assert/strict'
import { test } from 'vitest'
import { AsyncUploadQueue } from './upload-queue'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

test('AsyncUploadQueue never exceeds specified concurrency limit', async () => {
  const queue = new AsyncUploadQueue(3)
  let peakRunning = 0
  let currentRunning = 0
  const completed: number[] = []

  const tasks = Array.from({ length: 9 }, (_, i) => async () => {
    currentRunning++
    peakRunning = Math.max(peakRunning, currentRunning)
    await sleep(20)
    completed.push(i)
    currentRunning--
  })

  tasks.forEach((task, i) => queue.add(`item-${i}`, task))

  await sleep(150)

  assert.equal(completed.length, 9)
  assert.ok(peakRunning <= 3, `Peak running (${peakRunning}) exceeded concurrency limit 3`)
})

test('AsyncUploadQueue continues processing when a task errors', async () => {
  const queue = new AsyncUploadQueue(2)
  const completed: string[] = []

  queue.add('1', async () => {
    await sleep(10)
    completed.push('1')
  })

  queue.add('2', async () => {
    await sleep(10)
    throw new Error('Upload failed')
  })

  queue.add('3', async () => {
    await sleep(10)
    completed.push('3')
  })

  await sleep(80)

  assert.deepEqual(completed, ['1', '3'])
  assert.equal(queue.runningCount, 0)
  assert.equal(queue.pendingCount, 0)
})

test('AsyncUploadQueue supports canceling a queued task before it runs', async () => {
  const queue = new AsyncUploadQueue(1)
  const executed: string[] = []

  queue.add('task-1', async () => {
    await sleep(40)
    executed.push('task-1')
  })

  queue.add('task-2', async () => {
    await sleep(20)
    executed.push('task-2')
  })

  // Cancel task-2 while task-1 is still running
  queue.cancel('task-2')

  await sleep(100)

  assert.deepEqual(executed, ['task-1'])
  assert.equal(queue.pendingCount, 0)
})

test('AsyncUploadQueue provides abort signal to active task on cancel', async () => {
  const queue = new AsyncUploadQueue(1)
  let receivedAbort = false

  queue.add('task-1', async (signal) => {
    signal.addEventListener('abort', () => {
      receivedAbort = true
    })
    await sleep(100)
  })

  await sleep(10)
  queue.cancel('task-1')

  await sleep(20)
  assert.equal(receivedAbort, true)
})

test('AsyncUploadQueue clear() aborts all pending and active tasks', async () => {
  const queue = new AsyncUploadQueue(2)
  let abortCount = 0

  Array.from({ length: 6 }, (_, i) => {
    queue.add(`item-${i}`, async (signal) => {
      signal.addEventListener('abort', () => {
        abortCount++
      })
      await sleep(100)
    })
  })

  await sleep(10)
  queue.clear()

  assert.equal(queue.runningCount, 0)
  assert.equal(queue.pendingCount, 0)
  assert.ok(abortCount >= 2, 'Active tasks should have received abort signals')
})
