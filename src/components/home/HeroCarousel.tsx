// PromoBanner.tsx — WinBet Africa
// Full-width image carousel — images slotted via SLIDES[].imageSrc
// Colors match WinBet header: #0d1f3c navy, #1d4ed8 / #3b82f6 blue

import { useState, useEffect, useCallback } from 'react';
import image1 from '../../assests/image1.png';
import image2 from '../../assests/image2.png';
import image3 from '../../assests/image3.png';

// ─── Slide data ───────────────────────────────────────────────────────────────
// REPLACE imageSrc with your actual image paths / imports
interface Slide {
  id: number;
  imageSrc: string;       // ← PUT YOUR IMAGE PATH HERE
  imageAlt: string;
}

const SLIDES: Slide[] = [
  {
    id: 0,
    imageSrc: image1,
    imageAlt: 'Live Betting',
  },
  {
    id: 1,
    imageSrc: image2,
    imageAlt: 'Mega Jackpot',
  },
  {
    id: 2,
    imageSrc: image3,
    imageAlt: 'Sports Betting',
  },
];

// ─── Main PromoBanner ─────────────────────────────────────────────────────────
export default function PromoBanner() {
  const [active, setActive]     = useState(0);
  const [animating, setAnimating] = useState(false);

  const goTo = useCallback((idx: number) => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => { setActive(idx); setAnimating(false); }, 250);
  }, [animating]);

  const prev = () => goTo((active - 1 + SLIDES.length) % SLIDES.length);
  const next = useCallback(() => goTo((active + 1) % SLIDES.length), [active, goTo]);

  useEffect(() => {
    const t = setTimeout(next, 5500);
    return () => clearTimeout(t);
  }, [active, next]);

  const slide = SLIDES[active];

  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons"/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,600;0,700;0,800;0,900&display=swap');

        .wb-banner {
          margin: 16px 4px;
          width: calc(100% - 8px);
          border-radius: 16px;
          overflow: hidden;
          position: relative;
          height: clamp(280px, 38vw, 420px);
          background: #060e1c;
          border: 1px solid rgba(59, 130, 246,0.14);
          font-family: 'Inter', sans-serif;
          box-sizing: border-box;
        }

        /* Full-bleed background image */
        .wb-banner-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          display: block;
          z-index: 0;
          opacity: 1;
          transition: opacity 0.25s ease;
        }
        .wb-banner-img.fade { opacity: 0; }

        /* Placeholder shown when imageSrc is empty */
        .wb-banner-placeholder {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: #0a1628;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 1;
          transition: opacity 0.25s ease;
        }
        .wb-banner-placeholder.fade { opacity: 0; }
        .wb-placeholder-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          opacity: 0.20;
        }

        /* Nav arrows */
        .wb-arr {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 10;
          width: 44px; height: 44px;
          border-radius: 50%;
          background: rgba(6,14,28,0.75);
          border: 1px solid rgba(59, 130, 246,0.40);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          outline: none;
        }
        .wb-arr:hover { background: rgba(29, 78, 216,0.70); border-color: #3b82f6; }
        .wb-arr-l { left: 16px; }
        .wb-arr-r { right: 16px; }

        /* Dots */
        .wb-dots {
          position: absolute;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
          z-index: 10;
        }
        .wb-dot {
          height: 8px; width: 8px;
          border-radius: 4px;
          background: rgba(255,255,255,0.30);
          border: none; padding: 0; cursor: pointer;
          transition: background 0.2s, width 0.2s;
        }
        .wb-dot.on { background: #3b82f6; width: 26px; }

        /* ── Mobile: shorter, wider aspect ratio so the banner takes up
             noticeably less vertical space — image is cropped (object-fit: cover)
             to fill this shorter box edge-to-edge ── */
        @media (max-width: 580px) {
          .wb-banner {
            margin: 10px 4px;
            width: calc(100% - 8px);
            height: auto;
            aspect-ratio: 24 / 9;
            border-radius: 12px;
          }
          .wb-arr {
            width: 34px;
            height: 34px;
          }
          .wb-arr-l { left: 8px; }
          .wb-arr-r { right: 8px; }
          .wb-dots { bottom: 10px; gap: 6px; }
          .wb-dot { height: 6px; width: 6px; }
          .wb-dot.on { width: 20px; }
        }

        /* ── Very small phones: keep it compact too (previously taller 4:3,
             now capped at 16:9 so it never grows on tiny screens) ── */
        @media (max-width: 380px) {
          .wb-banner { aspect-ratio: 16 / 9; }
        }
      `}</style>

      <div className="wb-banner">

        {/* ── Background image (or placeholder) ── */}
        {slide.imageSrc ? (
          <img
            key={slide.id}
            src={slide.imageSrc}
            alt={slide.imageAlt}
            className={`wb-banner-img${animating ? ' fade' : ''}`}
          />
        ) : (
          <div className={`wb-banner-placeholder${animating ? ' fade' : ''}`}>
            <div className="wb-placeholder-inner">
              {/* Simple image icon placeholder */}
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none"
                stroke="#3b82f6" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '0.85rem', fontWeight: 600,
                color: '#3b82f6', letterSpacing: '0.10em',
                textTransform: 'uppercase',
              }}>Slide {active + 1} Image</span>
            </div>
          </div>
        )}

        {/* ── Arrow nav ── */}
        <button className="wb-arr wb-arr-l" onClick={prev} aria-label="Previous">
          <span className="material-icons" style={{ fontSize: 22 }}>chevron_left</span>
        </button>
        <button className="wb-arr wb-arr-r" onClick={next} aria-label="Next">
          <span className="material-icons" style={{ fontSize: 22 }}>chevron_right</span>
        </button>

        {/* ── Dot indicators ── */}
        <div className="wb-dots">
          {SLIDES.map((_, i) => (
            <button key={i} className={`wb-dot${i === active ? ' on' : ''}`}
              onClick={() => goTo(i)} aria-label={`Go to slide ${i + 1}`}/>
          ))}
        </div>

      </div>
    </>
  );
}
