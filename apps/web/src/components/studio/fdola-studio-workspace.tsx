'use client';

import React from 'react';
import { Card } from '@/components/shared/ui/card';
import { EmptyState } from '@/components/shared/ui/empty-state';

export interface FdolaStudioWorkspaceProps {
  subdomain: string;
}

export function FdolaStudioWorkspace({ subdomain: _subdomain }: Readonly<FdolaStudioWorkspaceProps>) {
  return (
    <div
      data-slot="fdola-studio-workspace"
      data-testid="fdola-studio-workspace"
      className="flex flex-col items-center justify-center px-6 py-12"
    >
      <Card className="w-full max-w-120">
        <EmptyState
          type="cleared"
          title="Fdola Studio"
          description="Desktop Workspace"
          data-testid="fdola-desktop-workspace-empty"
        />
      </Card>
    </div>
  );
}
