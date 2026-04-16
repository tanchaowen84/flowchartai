import type { ReactNode } from 'react';
import { MobileNav } from './mobile-nav';
import { TopBar } from './topbar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="infogiph-home relative min-h-screen bg-background">
      <div className="flex flex-col h-screen overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            <TopBar />
            <div className="flex-1 overflow-auto pb-20 md:pb-0">
              {children}
            </div>
          </div>
        </div>
        <MobileNav />
      </div>
    </div>
  );
}
