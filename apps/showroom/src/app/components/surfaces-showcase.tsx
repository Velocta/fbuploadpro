'use client';

import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Input,
} from '@web/components/ui';

export function SurfacesShowcase() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const tableRows = [
    { id: '1', title: 'Summer Campaign Reel 01', page: 'Primary Brand Page', views: '2,491,200', reach: '1,830,400', date: '2026-10-08 14:00' },
    { id: '2', title: 'Behind the Scenes EP 4', page: 'Global Media Network', views: '840,110', reach: '620,000', date: '2026-10-08 15:30' },
    { id: '3', title: 'Product Launch Keynote', page: 'Primary Brand Page', views: '4,102,900', reach: '3,210,000', date: '2026-10-08 18:00' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* 1. Card Container Suite */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 600,
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '8px',
            color: 'var(--text-main)',
          }}
        >
          Structural Card Containers (1px Hairlines & 8px Radii)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          <Card>
            <CardHeader>
              <CardTitle>Automated Queue Engine</CardTitle>
              <CardDescription>Recurring slot scheduler configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-sub)', lineHeight: 1.5 }}>
                Processes queued media assets and executes Facebook Graph API v26.0 mutations via Cloudflare Workers edge runtime isolates.
              </p>
            </CardContent>
            <CardFooter>
              <Button size="sm" variant="secondary">
                View Logs
              </Button>
              <Button size="sm" variant="primary">
                Configure Slots
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Storage Quota Allocation</CardTitle>
              <CardDescription>Cloudflare R2 Bucket utilization</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-sub)' }}>Used Space</span>
                  <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    42.8 GB / 100 GB
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    backgroundColor: 'var(--bg-hover)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: '42.8%',
                      backgroundColor: 'var(--primary)',
                    }}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button size="sm" variant="ghost">
                Inspect Bucket
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* 2. Modal Dialog Overlay */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 600,
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '8px',
            color: 'var(--text-main)',
          }}
        >
          Modal Dialog (Focus Trap, Backdrop Blur, Escape Key)
        </h3>

        <div>
          <Button variant="primary" onClick={() => setIsDialogOpen(true)}>
            Open Confirmation Dialog
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Immediate Publishing</DialogTitle>
                <DialogDescription>
                  This action bypasses scheduled queue slots and dispatches directly to Facebook Graph API.
                </DialogDescription>
              </DialogHeader>
              <DialogBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <Input
                    label="Confirmation Code"
                    placeholder="Type PUBLISH to confirm"
                    helperText="Dispatched to target page immediately"
                  />
                </div>
              </DialogBody>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={() => setIsDialogOpen(false)}>
                  Publish Now
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {/* 3. Tabbed Navigation */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 600,
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '8px',
            color: 'var(--text-main)',
          }}
        >
          Tabbed Section Navigation (Active Peru Indicator & Arrow Keys)
        </h3>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance Analytics</TabsTrigger>
            <TabsTrigger value="settings">Worker Configuration</TabsTrigger>
            <TabsTrigger value="disabled" disabled>
              Restricted Vault
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-panel)', borderRadius: '6px' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-sub)' }}>
                Active workspace tenant overview. All scheduled publishing slots are operational.
              </p>
            </div>
          </TabsContent>
          <TabsContent value="performance">
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-panel)', borderRadius: '6px' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-sub)' }}>
                Real-time Facebook Graph v26.0 impressions, video retention curve, and CTR breakdowns.
              </p>
            </div>
          </TabsContent>
          <TabsContent value="settings">
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-panel)', borderRadius: '6px' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-sub)' }}>
                Edge cron triggers set to */1 * * * * with isolated compound tenant authentication.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* 4. Data Table Suite */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 600,
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '8px',
            color: 'var(--text-main)',
          }}
        >
          Dense Financial-Precision Data Table
        </h3>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset Title</TableHead>
              <TableHead>Target Page</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Video Views</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Total Reach</TableHead>
              <TableHead>Scheduled Slot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell style={{ fontWeight: 500 }}>{row.title}</TableCell>
                <TableCell style={{ color: 'var(--text-sub)' }}>{row.page}</TableCell>
                <TableCell tabular style={{ textAlign: 'right' }}>
                  {row.views}
                </TableCell>
                <TableCell tabular style={{ textAlign: 'right' }}>
                  {row.reach}
                </TableCell>
                <TableCell tabular style={{ color: 'var(--text-dim)' }}>
                  {row.date}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
