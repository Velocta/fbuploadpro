'use client'

import { useRef, useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddTokensDialog } from './add-tokens-dialog'
import { useBrand } from '@/components/brand-provider'

export function DashboardActionsClient() {
  const [isDownloading, setIsDownloading] = useState(false)
  const downloadLockRef = useRef(false)
  const brand = useBrand()

  const handleDownload = async () => {
    if (downloadLockRef.current) return
    downloadLockRef.current = true
    setIsDownloading(true)
    
    try {
      const res = await fetch('/api/v1/agency/usage/export.csv')
      if (!res.ok) throw new Error('Download failed')
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `token-usage-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error exporting usage CSV:', err)
    } finally {
      // Small timeout to keep visual feedback visible and prevent double clicks
      setTimeout(() => {
        setIsDownloading(false)
        downloadLockRef.current = false
      }, 500)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button 
        variant="outline" 
        onClick={handleDownload} 
        disabled={isDownloading}
        className="gap-2 shrink-0"
      >
        {isDownloading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <FileDown className="h-4 w-4 text-muted-foreground" />
        )}
        {isDownloading ? 'Downloading...' : 'Download usage CSV'}
      </Button>
      {!brand.hideAddTokens && <AddTokensDialog />}
    </div>
  )
}
