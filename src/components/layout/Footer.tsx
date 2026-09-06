// Bet360 — Footer.jsx
// Dark Ghana-market sports betting footer
// Fonts: Open Sans + Oswald | Icons: Google Material Symbols Rounded

import { Link } from 'react-router-dom';

// ─── Bet360 Logo ─────────────────────────────────────────────────────────────
function Bet360Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, userSelect: 'none' }} aria-label="Bet360">
      {/* Orange shield SVG — no external font dependency */}
      <svg width="28" height="32" viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M14 1L2 6.5v9c0 8.5 5.2 14.7 12 16.5C20.8 30.2 26 24 26 15.5v-9L14 1z"
          fill="#FF6B00"
        />
        <path
          d="M14 5L5.5 9v7.5c0 6.5 3.8 11.2 8.5 12.8C18.7 27.7 22.5 23 22.5 16.5V9L14 5z"
          fill="none"
          stroke="rgba(255,255,255,0.20)"
          strokeWidth="1"
        />
        <text
          x="14" y="20"
          textAnchor="middle"
          fontFamily="'Oswald', 'Arial Narrow', sans-serif"
          fontWeight="800"
          fontSize="9.5"
          fill="#ffffff"
          letterSpacing="-0.3"
        >
          360
        </text>
      </svg>

      {/* Wordmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', lineHeight: 1 }}>
        <span style={{
          fontFamily: "'Oswald', sans-serif",
          fontWeight: 700,
          fontSize: '1.35rem',
          letterSpacing: '0.03em',
          color: '#ffffff',
          textTransform: 'uppercase',
        }}>BET</span>
        <span style={{
          fontFamily: "'Oswald', sans-serif",
          fontWeight: 700,
          fontSize: '1.35rem',
          letterSpacing: '0.03em',
          color: '#FF6B00',
          textTransform: 'uppercase',
        }}>360</span>
      </div>
    </div>
  );
}

// Simple SVG icon components to avoid Material Symbols loading issues
type IconName =
  | 'home' | 'live_tv' | 'sports_soccer' | 'casino' | 'videogame_asset'
  | 'emoji_events' | 'payments' | 'account_balance_wallet' | 'gavel' | 'lock'
  | 'health_and_safety' | 'info' | 'help' | 'support_agent' | 'bolt'
  | 'apartment' | 'contact_support' | 'call' | 'mail' | 'send'
  | 'location_on' | 'facebook' | 'twitter' | 'photo_camera' | 'telegram'
  | 'youtube' | 'shield';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

function Icon({ name, size = 16, color = '#FF6B00' }: IconProps) {
  const icons: Record<IconName, JSX.Element> = {
    home: <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />,
    live_tv: <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zM9 10l5 3-5 3z" />,
    sports_soccer: <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm4.24 14.6L12 14.3l-4.23 2.3 1.12-4.81-3.73-3.23 4.92-.42L12 3.8l1.92 4.34 4.92.42-3.73 3.23 1.12 4.81z" />,
    casino: <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM8 17c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm0-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm0-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm4 8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm4 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm0-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm0-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />,
    videogame_asset: <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H9v2H7v-2H5v-2h2V9h2v2h2v2zm4.5 1c-.83 0-1.5-.67-1.5-1.5S14.67 11 15.5 11s1.5.67 1.5 1.5S16.33 14 15.5 14zm3-3c-.83 0-1.5-.67-1.5-1.5S17.67 8 18.5 8s1.5.67 1.5 1.5S19.33 11 18.5 11z" />,
    emoji_events: <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />,
    payments: <path d="M19 14V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-9-1c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-6v11c0 1.1-.9 2-2 2H4v-2h17V7h2z" />,
    account_balance_wallet: <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />,
    gavel: <path d="m1 21 8-8-1.5-1.5L9 10l4.5 4.5-1.5 1.5L10.5 17.5l8-8-8-8-1.5 1.5 6.5 6.5-1.5 1.5-5-5L7.5 7 6 8.5 10.5 13 9 14.5 7.5 13 1 19.5V21h2.5l8-8 1.5 1.5z" />,
    lock: <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />,
    health_and_safety: <path d="M10.5 13H8v-3h2.5V7.5h3V10H16v3h-2.5v2.5h-3V13zM12 2 4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />,
    info: <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />,
    help: <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />,
    support_agent: <path d="M21 12.22C21 6.73 16.74 3 12 3c-4.69 0-9 3.65-9 9.28-.6.34-1 .98-1 1.72v2c0 1.1.9 2 2 2h1v-6.1c0-3.87 3.13-7 7-7s7 3.13 7 7V19h-8v2h8c1.1 0 2-.9 2-2v-1.22c.59-.31 1-.92 1-1.64v-2.3c0-.7-.41-1.31-1-1.62z" />,
    bolt: <path d="M7 2v11h3v9l7-12h-4l4-8z" />,
    apartment: <path d="M17 11V3H7v4H3v14h8v-4h2v4h8V11h-4zM7 19H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5v-2h2v2zm4 4H9v-2h2v2zm0-4H9v-2h2v2zm0-4H9V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2z" />,
    contact_support: <path d="M11.5 2C6.81 2 3 5.81 3 10.5S6.81 19 11.5 19h.5v3c4.86-2.34 8-7 8-11.5C20 5.81 16.19 2 11.5 2zm1 14.5h-2v-2h2v2zm0-4h-2c0-3.25 3-3 3-5 0-1.1-.9-2-2-2s-2 .9-2 2h-2c0-2.21 1.79-4 4-4s4 1.79 4 4c0 2.5-3 2.75-3 5z" />,
    call: <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />,
    mail: <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />,
    send: <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />,
    location_on: <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />,
    facebook: <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />,
    twitter: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />,
    photo_camera: <path d="M12 15.2c-1.77 0-3.2-1.43-3.2-3.2S10.23 8.8 12 8.8s3.2 1.43 3.2 3.2-1.43 3.2-3.2 3.2zM9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />,
    telegram: <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-2.012 9.486c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.48 14.697l-2.95-.924c-.64-.204-.654-.64.136-.95l11.57-4.461c.535-.194 1.002.13.826.886z" />,
    youtube: <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />,
    shield: <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      {icons[name] || icons.bolt}
    </svg>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────
export default function Footer() {
  const year = new Date().getFullYear();

  const quickLinks: { to: string; label: string; icon: IconName }[] = [
    { to: '/',            label: 'Home',         icon: 'home' },
    { to: '/live',        label: 'Live Betting',  icon: 'live_tv' },
    { to: '/sports',      label: 'Sports',        icon: 'sports_soccer' },
    { to: '/casino',      label: 'Casino',        icon: 'casino' },
    { to: '/virtuals',    label: 'Virtuals',      icon: 'videogame_asset' },
    { to: '/jackpot',     label: 'Jackpot',       icon: 'emoji_events' },
    { to: '/deposit',     label: 'Deposit',       icon: 'payments' },
    { to: '/withdraw',    label: 'Withdraw',      icon: 'account_balance_wallet' },
  ];

  const legalLinks: { to: string; label: string; icon: IconName }[] = [
    { to: '/terms',       label: 'Terms & Conditions',  icon: 'gavel' },
    { to: '/privacy',     label: 'Privacy Policy',       icon: 'lock' },
    { to: '/responsible', label: 'Responsible Gambling', icon: 'health_and_safety' },
    { to: '/about',       label: 'About Us',             icon: 'info' },
    { to: '/faq',         label: 'FAQ',                  icon: 'help' },
    { to: '/contact',     label: 'Contact Us',           icon: 'support_agent' },
  ];

  const socials: { icon: IconName; label: string; href: string }[] = [
    { icon: 'facebook',      label: 'Facebook',   href: 'https://facebook.com' },
    { icon: 'twitter',       label: 'Twitter/X',  href: 'https://twitter.com' },
    { icon: 'photo_camera',  label: 'Instagram',  href: 'https://instagram.com' },
    { icon: 'telegram',      label: 'Telegram',   href: 'https://t.me' },
    { icon: 'youtube',       label: 'YouTube',    href: 'https://youtube.com' },
  ];

  const contacts: { icon: IconName; label: string; href: string | null; hideMobile: boolean }[] = [
    { icon: 'call',        label: '+233 200 000 000',       href: 'tel:+233200000000',            hideMobile: false },
    { icon: 'mail',        label: 'support@bet360.com.gh',  href: 'mailto:support@bet360.com.gh', hideMobile: false },
    { icon: 'send',        label: '@bet360gh on Telegram',  href: 'https://t.me/bet360gh',        hideMobile: true },
    { icon: 'location_on', label: 'Accra, Ghana',           href: null,                           hideMobile: true },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&family=Oswald:wght@400;600;700&display=swap');

        .bet360-footer {
          background: #0a0c10;
          color: rgba(255,255,255,0.70);
          font-family: 'Open Sans', sans-serif;
          position: relative;
          z-index: 1;
        }

        .bet360-footer-link {
          font-family: 'Open Sans', sans-serif;
          font-size: 0.82rem;
          font-weight: 500;
          color: rgba(255,255,255,0.52);
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 0;
          transition: color 0.15s;
        }
        .bet360-footer-link:hover { color: #FF6B00; }

        .bet360-footer-heading {
          font-family: 'Oswald', sans-serif;
          font-weight: 700;
          font-size: 0.72rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #FF6B00;
          margin-bottom: 14px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255,107,0,0.25);
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .bet360-social-btn {
          width: 38px; height: 38px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.10);
          cursor: pointer; text-decoration: none;
          transition: background 0.15s, border-color 0.15s, transform 0.15s;
        }
        .bet360-social-btn:hover {
          background: rgba(255,107,0,0.18);
          border-color: rgba(255,107,0,0.45);
          transform: translateY(-2px);
        }

        .bet360-contact-item {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          font-size: 0.80rem;
          color: rgba(255,255,255,0.48);
          font-family: 'Open Sans', sans-serif;
          text-decoration: none;
          transition: color 0.15s;
          line-height: 1.45;
          font-weight: 400;
        }
        .bet360-contact-item:hover { color: #FF6B00; }

        /* Mobile responsive */
        @media (max-width: 600px) {
          .hide-mobile { display: none !important; }
          .bet360-main-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 24px 16px !important;
            padding: 28px 16px 24px !important;
          }
          .bet360-brand-col {
            grid-column: span 2 !important;
          }
          .bet360-paybill { font-size: 1.8rem !important; letter-spacing: 0.12em !important; }
        }
      `}</style>

      <footer className="bet360-footer">

        {/* ── Mobile Money / PayBill ── */}
        <div style={{
          background: '#0d0f14',
          borderTop: '2px solid rgba(255,107,0,0.40)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '20px 20px',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 600,
            fontSize: '0.68rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.40)',
            marginBottom: 6,
          }}>
            Mobile Money · PayBill Number
          </div>
          <div className="bet360-paybill" style={{
            fontFamily: "'Oswald', monospace",
            fontWeight: 700,
            fontSize: '2.4rem',
            letterSpacing: '0.18em',
            color: '#ffffff',
            lineHeight: 1,
          }}>
            004092
          </div>

          {/* Payment logos — hidden on mobile */}
          <div className="hide-mobile" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginTop: 14,
            flexWrap: 'wrap',
          }}>
            <div style={{ background: '#FFCC00', borderRadius: 8, padding: '7px 18px' }}>
              <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '0.78rem', color: '#333' }}>MTN MoMo</span>
            </div>
            <div style={{ background: '#e8000f', borderRadius: 8, padding: '7px 18px' }}>
              <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: '0.78rem', color: '#fff' }}>telecel</span>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #e8000f 50%, #0066CC 50%)', borderRadius: 8, padding: '7px 18px' }}>
              <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: '0.75rem', color: '#fff' }}>AirtelTigo</span>
            </div>
          </div>
        </div>

        {/* ── MAIN GRID ── */}
        <div className="bet360-main-grid" style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '40px 20px 32px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 32,
        }}>

          {/* Brand col */}
          <div className="bet360-brand-col" style={{ gridColumn: 'span 1' }}>
            <div style={{ marginBottom: 14 }}>
              <Bet360Logo />
            </div>
            <p style={{
              fontSize: '0.80rem',
              lineHeight: 1.75,
              color: 'rgba(255,255,255,0.42)',
              fontFamily: "'Open Sans', sans-serif",
              fontWeight: 400,
              maxWidth: 230,
              marginBottom: 16,
            }}>
              Ghana's trusted sports betting platform. Fast payouts, live odds, and secure mobile money deposits.
            </p>
            {/* Socials */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {socials.map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bet360-social-btn"
                  aria-label={s.label}
                  title={s.label}
                >
                  <Icon name={s.icon} size={18} color="rgba(255,255,255,0.65)" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <div className="bet360-footer-heading">
              <Icon name="bolt" size={14} color="#FF6B00" />
              Quick Links
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {quickLinks.map(l => (
                <li key={l.to}>
                  <Link to={l.to} className="bet360-footer-link">
                    <Icon name={l.icon} size={14} color="#FF6B00" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company / Legal */}
          <div>
            <div className="bet360-footer-heading">
              <Icon name="apartment" size={14} color="#FF6B00" />
              Company
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {legalLinks.map(l => (
                <li key={l.to}>
                  <Link to={l.to} className="bet360-footer-link">
                    <Icon name={l.icon} size={14} color="#FF6B00" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <div className="bet360-footer-heading">
              <Icon name="contact_support" size={14} color="#FF6B00" />
              Contact Us
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {contacts.map(c => {
                const content = (
                  <>
                    <Icon name={c.icon} size={15} color="#FF6B00" />
                    <span>{c.label}</span>
                  </>
                );
                return c.href ? (
                  <a
                    key={c.label}
                    href={c.href}
                    target={c.href.startsWith('http') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className={`bet360-contact-item${c.hideMobile ? ' hide-mobile' : ''}`}
                  >
                    {content}
                  </a>
                ) : (
                  <div
                    key={c.label}
                    className={`bet360-contact-item${c.hideMobile ? ' hide-mobile' : ''}`}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Responsible Gaming Banner ── */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          background: '#0d0f14',
          padding: '18px 20px',
        }}>
          <div style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 20,
            flexWrap: 'wrap',
          }}>
            {/* 18+ + disclaimer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                border: '2.5px solid rgba(255,255,255,0.38)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Oswald', sans-serif", fontWeight: 900,
                fontSize: '0.88rem', color: 'rgba(255,255,255,0.70)',
              }}>
                18+
              </div>
              <p style={{
                fontSize: '0.73rem',
                lineHeight: 1.7,
                color: 'rgba(255,255,255,0.38)',
                fontFamily: "'Open Sans', sans-serif",
                fontWeight: 400,
                maxWidth: 460,
                margin: 0,
              }}>
                Age 18 and above only. Play responsibly. Gambling can be harmful if not controlled.
                Bet360 Ghana operates under applicable gaming regulations.
              </p>
            </div>

            {/* License badge — desktop only */}
            <div className="hide-mobile" style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.09)',
              background: 'rgba(255,255,255,0.025)',
            }}>
              <Icon name="shield" size={28} color="#FF6B00" />
              <div>
                <div style={{
                  fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                  fontSize: '0.72rem', color: 'rgba(255,255,255,0.58)',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>Licensed &amp; Regulated</div>
                <div style={{
                  fontSize: '0.68rem', color: 'rgba(255,255,255,0.32)',
                  fontFamily: "'Open Sans', sans-serif", marginTop: 2,
                }}>Ghana Gaming Commission · GGC-2024-0360</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          background: '#080a0e',
          padding: '12px 20px',
        }}>
          <div style={{
            maxWidth: 1200, margin: '0 auto',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap',
          }}>
            <p style={{
              fontSize: '0.70rem',
              color: 'rgba(255,255,255,0.28)',
              fontFamily: "'Open Sans', sans-serif",
              fontWeight: 400,
              margin: 0,
            }}>
              © {year} Bet360 Ghana. All rights reserved.
            </p>
            <div className="hide-mobile" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'Terms & Conditions', to: '/terms' },
                { label: 'Privacy Policy', to: '/privacy' },
                { label: 'About Us', to: '/about' },
              ].map(t => (
                <Link
                  key={t.label}
                  to={t.to}
                  style={{
                    fontSize: '0.70rem',
                    color: 'rgba(255,255,255,0.35)',
                    textDecoration: 'underline',
                    fontFamily: "'Open Sans', sans-serif",
                    fontWeight: 400,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#FF6B00'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

      </footer>
    </>
  );
}