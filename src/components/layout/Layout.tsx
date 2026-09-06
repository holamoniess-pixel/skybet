import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppStore } from '../../store';
import Header, { type SportTab } from './Header';
import BottomNav from './BottomNav';
import Toast from '../common/Toast';

export default function Layout() {
  const theme = useAppStore((s) => s.theme);
  const [activeSport, setActiveSport] = useState<SportTab>('football');

  return (
    <div data-theme={theme}>
      <div className="flex flex-col min-h-screen bg-[var(--bg-page)] transition-colors">
        <Header activeSport={activeSport} onSportChange={setActiveSport} />

        <div className="flex flex-1 max-w-[1440px] mx-auto w-full">
          <main className="flex-1 min-w-0 pb-32 mb-16 lg:pb-6 lg:mb-0">
            <Outlet />
          </main>
        </div>

        <BottomNav />
        <Toast />
      </div>
    </div>
  );
}