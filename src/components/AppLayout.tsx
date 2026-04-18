import { ReactNode } from 'react';
import AppSidebar from './AppSidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="md:ml-56 min-h-screen p-3 md:p-5">
        <div className="max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
