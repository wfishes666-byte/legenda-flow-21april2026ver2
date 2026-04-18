import { ReactNode } from 'react';
import AppSidebar from './AppSidebar';
import macanBg from '@/assets/macan-bg.png';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="relative md:ml-64 min-h-screen px-3 py-16 sm:px-4 sm:py-6 md:p-8 max-w-full overflow-x-hidden">
        <img
          src={macanBg}
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none fixed bottom-0 right-0 w-[30vw] opacity-25 z-0"
        />
        <div className="relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
