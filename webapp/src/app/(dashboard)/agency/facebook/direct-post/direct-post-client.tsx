'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { uploadViaPresign } from '@/features/facebook/shared/media-upload'
import { AgencyInlineStatus } from '@/components/dashboard/agency'
import { 
  Send, Type, Image as ImageIcon, Video, AlertCircle, 
  UploadCloud, FileImage, FileVideo, Trash2, Link as LinkIcon, ChevronDown, ChevronUp,
  Search, Loader2, ArrowRight, Layers, Facebook, ChevronLeft, RefreshCw, CheckCircle2
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import Image from 'next/image'

type Account = { id: string; fb_user_name?: string | null; fb_user_image?: string | null; fb_user_id?: string | null }
type FbPage = { id: string; name: string; picture?: string | null }
type PostHistoryItem = {
  id: string
  fb_page_name: string
  fb_page_id: string
  media_type: 'text' | 'image' | 'video'
  status: 'published' | 'failed'
  error_message: string | null
  created_at: string
  tokens_charged: number
  graph_post_id?: string | null
}

const USER_MEDIA_MAX_BYTES = {
  image: 10 * 1024 * 1024, // 10MB
  video: 10 * 1024 * 1024 * 1024, // 10GB
}

const POST_TYPES = [
  { id: 'text', label: 'Text', icon: Type },
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'video', label: 'Video', icon: Video },
] as const

const MAX_CAPTION_LENGTH = 63206

export function DirectPostClient() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [hasLoadedAccounts, setHasLoadedAccounts] = useState(false)

  const [pages, setPages] = useState<FbPage[]>([])
  const [loadingPages, setLoadingPages] = useState(false)

  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [selectedPage, setSelectedPage] = useState<FbPage | null>(null)
  
  const [accountSearch, setAccountSearch] = useState('')
  const [pageSearch, setPageSearch] = useState('')

  const [history, setHistory] = useState<PostHistoryItem[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  
  // Composer state
  const [mediaType, setMediaType] = useState<'text' | 'image' | 'video'>('text')
  const [caption, setCaption] = useState('')
  const [firstComment, setFirstComment] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadedObjectKey, setUploadedObjectKey] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [expandedErrors, setExpandedErrors] = useState<Record<string, boolean>>({})

  // History filtering
  const [historyFilterType, setHistoryFilterType] = useState<string>('all')
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>('all')

  const HISTORY_PAGE_SIZE = 10

  const loadHistory = async (page = 1) => {
    const offset = (page - 1) * HISTORY_PAGE_SIZE
    const res = await fetch(`/api/v1/agency/facebook/direct-post?limit=${HISTORY_PAGE_SIZE}&offset=${offset}`)
    if (res.ok) {
      const data = await res.json()
      setHistory(data.posts || [])
      setHistoryTotal(data.totalCount || 0)
    }
  }

  useEffect(() => {
    void loadHistory(historyPage)
  }, [historyPage])

  const loadAccounts = async () => {
    setLoadingAccounts(true)
    try {
      const response = await fetch('/api/v1/agency/facebook/accounts')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load accounts')
      setAccounts(data.accounts || [])
      setHasLoadedAccounts(true)
    } catch (error) {
      toast.error('Unable to load Facebook accounts', {
        description: error instanceof Error ? error.message : 'Unexpected error',
      })
    } finally {
      setLoadingAccounts(false)
    }
  }

  useEffect(() => {
    void loadAccounts()
  }, [])

  const loadPagesForAccount = async (accountId: string) => {
    if (!accountId) return
    setLoadingPages(true)
    try {
      const response = await fetch(`/api/v1/agency/facebook/accounts/${accountId}/pages`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load pages')
      setPages(data.pages || [])
    } catch {
      toast.error('Unable to load managed pages')
      setPages([])
    } finally {
      setLoadingPages(false)
    }
  }

  const handleSelectAccount = (account: Account) => {
    setSelectedAccount(account)
    setSelectedPage(null)
    setPages([])
    void loadPagesForAccount(account.id)
  }

  const handleSelectPage = (page: FbPage) => {
    setSelectedPage(page)
  }

  // Handle file preview cleanup
  useEffect(() => {
    if (file && mediaType === 'image') {
      const url = URL.createObjectURL(file)
      setFilePreview(url)
      return () => URL.revokeObjectURL(url)
    }
    setFilePreview(null)
  }, [file, mediaType])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) {
      setFile(null)
      return
    }

    if (mediaType === 'image' && selectedFile.size > USER_MEDIA_MAX_BYTES.image) {
      toast.error('Image is too large', { description: 'Maximum allowed image size is 10MB.' })
      e.target.value = ''
      return
    }

    if (mediaType === 'video' && selectedFile.size > USER_MEDIA_MAX_BYTES.video) {
      toast.error('Video is too large', { description: 'Maximum allowed video size is 10GB.' })
      e.target.value = ''
      return
    }

    setFile(selectedFile)
    setUploadProgress(0)
    setUploadStatus('uploading')
    setUploadedObjectKey(null)

    uploadViaPresign({ 
      file: selectedFile, 
      feature: 'direct-post',
      onProgress: (pct) => setUploadProgress(pct)
    }).then(key => {
      setUploadedObjectKey(key)
      setUploadStatus('success')
    }).catch(err => {
      toast.error('Upload failed', { description: err.message })
      setUploadStatus('error')
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const onSubmit = async () => {
    if (!selectedAccount || !selectedPage) {
      toast.error('Select an account and page')
      return
    }
    if (mediaType !== 'text' && !file) {
      toast.error(`Upload a ${mediaType} file`)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/agency/facebook/direct-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facebookAccountId: selectedAccount.id,
          fbPageId: selectedPage.id,
          mediaType,
          caption,
          firstComment: firstComment || undefined,
          mediaObjectKey: uploadedObjectKey || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Publish failed')
      }

      toast.success('Successfully published to Facebook')
      setCaption('')
      setFirstComment('')
      setFile(null)
      setUploadProgress(0)
      setUploadStatus('idle')
      setUploadedObjectKey(null)
      if (historyPage === 1) {
        await loadHistory(1)
      } else {
        setHistoryPage(1)
      }
    } catch (e) {
      toast.error('Publish failed', { description: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setSubmitting(false)
    }
  }

  const toggleError = (id: string) => {
    setExpandedErrors(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const matchType = historyFilterType === 'all' || item.media_type === historyFilterType
      const matchStatus = historyFilterStatus === 'all' || item.status === historyFilterStatus
      return matchType && matchStatus
    })
  }, [history, historyFilterType, historyFilterStatus])

  const filteredAccounts = useMemo(() => {
    const needle = accountSearch.trim().toLowerCase()
    if (!needle) return accounts
    return accounts.filter((item) => String(item.fb_user_name || '').toLowerCase().includes(needle))
  }, [accountSearch, accounts])

  const filteredPages = useMemo(() => {
    const needle = pageSearch.trim().toLowerCase()
    if (!needle) return pages
    return pages.filter((item) => item.name.toLowerCase().includes(needle))
  }, [pageSearch, pages])

  return (
    <div className="w-full relative pb-32">
      {/* SELECTION WIZARD */}
      <AnimatePresence mode="wait">
        {!selectedPage ? (
          <motion.div 
            key="selection-wizard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            className="flex-1 flex flex-col items-center justify-center py-20"
          >
            <div className="w-full max-w-2xl space-y-8">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary ring-1 ring-primary/20 shadow-[0_0_40px_-10px_rgba(var(--primary),0.3)]">
                  <Send size={32} />
                </div>
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/50 bg-clip-text text-transparent">Direct Post</h1>
                <p className="text-lg text-muted-foreground">Select a Facebook account and page to begin publishing.</p>
              </div>

              {!selectedAccount ? (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative bg-card/40 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-2xl">
                      <div className="flex items-center gap-3 mb-6">
                        <Facebook className="text-blue-500" />
                        <h2 className="text-xl font-semibold">Select Account</h2>
                      </div>
                      <div className="relative mb-6">
                        <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                          className="pl-11 h-12 bg-background/50 border-border/50 rounded-xl" 
                          placeholder="Search accounts..." 
                          value={accountSearch} 
                          onChange={(e) => setAccountSearch(e.target.value)} 
                        />
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {!hasLoadedAccounts ? (
                          <div className="flex flex-col items-center justify-center p-8 gap-4">
                            <p className="text-sm text-muted-foreground text-center">Loading your connected accounts...</p>
                            <Loader2 className="animate-spin text-muted-foreground" />
                          </div>
                        ) : loadingAccounts ? (
                          <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                        ) : filteredAccounts.length === 0 ? (
                          <div className="text-center p-8 text-muted-foreground">No accounts found</div>
                        ) : (
                          filteredAccounts.map((acc) => (
                            <button
                              key={acc.id}
                              onClick={() => handleSelectAccount(acc)}
                              className="w-full flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-border hover:bg-muted/30 transition-all text-left group"
                            >
                              {acc.fb_user_image ? (
                                <Image src={acc.fb_user_image} alt={acc.fb_user_name || ''} width={48} height={48} className="rounded-full shadow-sm ring-2 ring-transparent group-hover:ring-primary/20 transition-all" unoptimized />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                  <Facebook size={24} className="text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-lg">{acc.fb_user_name}</p>
                                <p className="text-sm text-muted-foreground font-mono">{acc.fb_user_id || acc.id}</p>
                              </div>
                              <ArrowRight className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                   <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative bg-card/40 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-2xl">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <Layers className="text-primary" />
                          <h2 className="text-xl font-semibold">Select Page</h2>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedAccount(null)} className="text-muted-foreground hover:text-foreground">
                          <ChevronLeft className="mr-1 h-4 w-4" /> Back
                        </Button>
                      </div>
                      <div className="relative mb-6">
                        <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                          className="pl-11 h-12 bg-background/50 border-border/50 rounded-xl" 
                          placeholder="Search pages..." 
                          value={pageSearch} 
                          onChange={(e) => setPageSearch(e.target.value)} 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {loadingPages ? (
                          <div className="col-span-2 flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                        ) : filteredPages.length === 0 ? (
                          <div className="col-span-2 text-center p-8 text-muted-foreground">No pages found</div>
                        ) : (
                          filteredPages.map((page) => (
                            <button
                              key={page.id}
                              onClick={() => handleSelectPage(page)}
                              className="flex flex-col items-start p-4 rounded-xl border border-border/50 bg-background/30 hover:bg-muted/50 hover:border-primary/50 transition-all text-left group"
                            >
                              {page.picture ? (
                                <Image src={page.picture} alt={page.name} width={40} height={40} className="rounded-lg mb-3 shadow-sm" unoptimized />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-3">
                                  <Layers size={20} className="text-muted-foreground" />
                                </div>
                              )}
                              <p className="font-semibold line-clamp-1">{page.name}</p>
                              <p className="text-xs text-muted-foreground font-mono mt-1">{page.id}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="active-composer"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-8"
          >
            {/* ACTIVE CONNECTION HEADER */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b pb-4 pt-6 -mx-6 px-6 sm:-mx-8 sm:px-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
              <div className="flex items-center gap-4">
                <div className="flex items-center">
                  {selectedAccount?.fb_user_image ? (
                    <Image src={selectedAccount.fb_user_image} alt="" width={32} height={32} className="rounded-full ring-2 ring-background z-10 shadow-sm" unoptimized />
                  ) : <div className="w-8 h-8 rounded-full bg-muted z-10 ring-2 ring-background" />}
                  
                  {selectedPage?.picture ? (
                    <Image src={selectedPage.picture} alt="" width={40} height={40} className="rounded-lg -ml-3 ring-2 ring-background z-20 shadow-md" unoptimized />
                  ) : <div className="w-10 h-10 rounded-lg bg-muted -ml-3 ring-2 ring-background z-20" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-lg leading-tight">{selectedPage?.name}</h2>
                    <Badge variant="outline" className="bg-primary/5 text-primary text-[10px] uppercase tracking-wider py-0 px-1.5 h-5">Selected</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-tight mt-0.5">via {selectedAccount?.fb_user_name}</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setSelectedPage(null); setSelectedAccount(null); }}
                className="rounded-full bg-background/50 backdrop-blur-md border-border/50 shadow-sm"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Change Page
              </Button>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] items-start pt-2">
              {/* COMPOSER PANEL */}
              <motion.section 
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative group"
              >
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/10 to-blue-500/10 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" aria-hidden />
                <div className="relative rounded-3xl border border-border/50 bg-card/40 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Composer</h2>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                      Cost: Free
                    </Badge>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label>Post Type</Label>
                      <div className="flex flex-wrap gap-2">
                        {POST_TYPES.map((type) => {
                          const Icon = type.icon
                          const isActive = mediaType === type.id
                          return (
                            <Button
                              key={type.id}
                              type="button"
                              variant="outline"
                              className={cn(
                                'h-11 flex-1 rounded-xl border-border/50 bg-background/30 transition-all',
                                isActive && 'border-primary/50 bg-primary/10 text-primary shadow-sm hover:bg-primary/20'
                              )}
                              onClick={() => {
                                setMediaType(type.id)
                                setFile(null)
                                setFilePreview(null)
                                setUploadStatus('idle')
                                setUploadedObjectKey(null)
                              }}
                            >
                              <Icon className={cn('mr-2 h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                              {type.label}
                            </Button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Caption</Label>
                        <span className={cn("text-xs", caption.length > MAX_CAPTION_LENGTH ? "text-destructive" : "text-muted-foreground")}>
                          {caption.length.toLocaleString()} / {MAX_CAPTION_LENGTH.toLocaleString()}
                        </span>
                      </div>
                      <Textarea 
                        value={caption} 
                        onChange={(e) => setCaption(e.target.value)} 
                        rows={5} 
                        className="resize-none rounded-xl bg-background/50"
                        placeholder="What's on your mind?"
                      />
                    </div>

                    <AnimatePresence mode="popLayout">
                      {mediaType !== 'text' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2 overflow-hidden"
                        >
                          <Label>Media File</Label>
                          {!file ? (
                            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 bg-background/30 p-8 transition-colors hover:border-primary/50 hover:bg-primary/5">
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <UploadCloud className="h-6 w-6" />
                              </div>
                              <p className="mt-4 text-sm font-medium">Click to upload {mediaType}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {mediaType === 'image' ? 'JPEG, PNG up to 10MB' : 'MP4, MOV up to 10GB'}
                              </p>
                              <input 
                                type="file" 
                                className="hidden" 
                                accept={mediaType === 'image' ? 'image/*' : 'video/*'} 
                                onChange={handleFileChange} 
                              />
                            </label>
                          ) : (
                            <div className="relative flex items-center gap-4 rounded-2xl border border-border/50 bg-background/50 p-4">
                              {mediaType === 'image' && filePreview ? (
                                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/50">
                                  <Image src={filePreview} alt="Preview" fill className="object-cover" unoptimized />
                                </div>
                              ) : (
                                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/30">
                                  <FileVideo className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                              
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{file.name}</p>
                                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                                
                                {uploadStatus === 'uploading' && uploadProgress > 0 && uploadProgress < 100 && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                      <div 
                                        className="h-full bg-primary transition-all duration-300 ease-out" 
                                        style={{ width: `${uploadProgress}%` }} 
                                      />
                                    </div>
                                    <span className="text-[10px] font-medium text-muted-foreground">
                                      {Math.round(uploadProgress)}%
                                    </span>
                                  </div>
                                )}
                                {uploadStatus === 'uploading' && uploadProgress === 100 && (
                                  <p className="mt-1 text-xs text-primary animate-pulse">Processing...</p>
                                )}
                                {uploadStatus === 'success' && (
                                  <p className="mt-1 text-xs text-green-500 font-medium flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Upload complete
                                  </p>
                                )}
                              </div>
                              
                              {uploadStatus !== 'uploading' && (
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="icon" 
                                  className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => { 
                                    setFile(null); 
                                    setFilePreview(null); 
                                    setUploadStatus('idle'); 
                                    setUploadedObjectKey(null);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="space-y-2">
                      <Label>First comment (optional)</Label>
                      <Input 
                        value={firstComment} 
                        onChange={(e) => setFirstComment(e.target.value)} 
                        className="h-11 rounded-xl bg-background/50"
                        placeholder="Write a comment..."
                      />
                    </div>
                    
                    <Button 
                      className="h-12 w-full rounded-xl text-base font-semibold shadow-xl shadow-primary/20"
                      onClick={onSubmit} 
                      disabled={submitting || (mediaType !== 'text' && uploadStatus !== 'success') || caption.length > MAX_CAPTION_LENGTH}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Publishing...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-5 w-5" />
                          Publish Now
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.section>

              {/* HISTORY PANEL */}
              <motion.section 
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative group h-full"
              >
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-muted/50 to-muted/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" aria-hidden />
                <div className="relative flex h-full max-h-[800px] flex-col overflow-hidden rounded-3xl border border-border/50 bg-card/40 shadow-2xl backdrop-blur-xl">
                  <div className="border-b border-border/50 p-5">
                    <h2 className="text-lg font-semibold">Publish History</h2>
                    
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Select value={historyFilterType} onValueChange={setHistoryFilterType}>
                        <SelectTrigger className="h-9 rounded-lg bg-background/50 text-xs">
                          <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="image">Image</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={historyFilterStatus} onValueChange={setHistoryFilterStatus}>
                        <SelectTrigger className="h-9 rounded-lg bg-background/50 text-xs">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3">
                    {filteredHistory.length === 0 ? (
                      <div className="flex h-40 flex-col items-center justify-center text-center">
                        <Send className="mb-2 h-8 w-8 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">No posts found</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredHistory.map((item, i) => (
                          <motion.div 
                            key={item.id} 
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="rounded-xl border border-border/50 bg-background/40 p-4 transition-all hover:bg-background/60"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-medium leading-none">{item.fb_page_name || item.fb_page_id}</p>
                                <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                                  {item.media_type === 'text' && <Type className="h-3.5 w-3.5" />}
                                  {item.media_type === 'image' && <FileImage className="h-3.5 w-3.5" />}
                                  {item.media_type === 'video' && <FileVideo className="h-3.5 w-3.5" />}
                                  <span className="capitalize">{item.media_type}</span>
                                  <span>•</span>
                                  <span>{format(new Date(item.created_at), 'MMM d, h:mm a')}</span>
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <AgencyInlineStatus 
                                  label={item.status} 
                                  tone={item.status === 'published' ? 'default' : 'destructive'} 
                                  className="capitalize text-[10px]"
                                />
                              </div>
                            </div>

                            {item.status === 'failed' && item.error_message && (
                              <div className="mt-3">
                                <button 
                                  onClick={() => toggleError(item.id)}
                                  className="flex items-center gap-1 text-xs font-medium text-destructive hover:underline"
                                >
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  View Error {expandedErrors[item.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                </button>
                                <AnimatePresence>
                                  {expandedErrors[item.id] && (
                                    <motion.div 
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="mt-2 rounded-lg bg-destructive/10 p-2.5 text-[11px] font-mono text-destructive/80 break-words">
                                        {item.error_message}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}

                            {item.status === 'published' && item.graph_post_id && (
                              <div className="mt-3 flex items-center justify-between">
                                <Badge variant="outline" className="bg-transparent text-[10px] font-normal text-muted-foreground border-border/50">
                                  {item.tokens_charged} token{item.tokens_charged !== 1 ? 's' : ''}
                                </Badge>
                                <a 
                                  href={`https://facebook.com/${item.graph_post_id}`} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                                >
                                  View Post <LinkIcon className="h-3 w-3" />
                                </a>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pagination controls for history */}
                  {historyTotal > HISTORY_PAGE_SIZE && (
                    <div className="border-t border-border/50 bg-background/20 p-3 flex items-center justify-between text-xs">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 rounded-lg"
                        disabled={historyPage === 1}
                        onClick={() => setHistoryPage(p => p - 1)}
                      >
                        Previous
                      </Button>
                      <span className="text-muted-foreground">
                        Page {historyPage} of {Math.ceil(historyTotal / HISTORY_PAGE_SIZE)}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 rounded-lg"
                        disabled={historyPage >= Math.ceil(historyTotal / HISTORY_PAGE_SIZE)}
                        onClick={() => setHistoryPage(p => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              </motion.section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
