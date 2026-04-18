import { ReactNode } from 'react';
import AppSidebar from './AppSidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="md:ml-64 min-h-screen p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
