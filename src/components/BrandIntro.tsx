import { useEffect, useRef, useState, type ReactNode } from 'react';
import { claimIntroSession, INTRO_REPLAY_EVENT, markIntroSessionPlayed } from './introSession';
import heroDish from '../assets/images/hero_nigerian_jollof_feast_1792169660639-optimized.jpg';
import riceDishes from '../assets/images/category_rice_dishes_1792169660991-optimized.jpg';
import swallowMeals from '../assets/images/category_swallow_soups_1792169661810-optimized.jpg';
import grilledFood from '../assets/images/category_grills_shawarma_1792169662635-optimized.jpg';

const INTRO_DURATION_MS = 18_000;
const REDUCED_REPLAY_DURATION_MS = 800;
const INTRO_ASSET_TIMEOUT_MS = 5_000;
const INTRO_ASSET_COUNT = 7;

function canPlayIntro(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return claimIntroSession(window.sessionStorage, reducedMotion);
  } catch {
    return false;
  }
}

export function BrandIntro({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(canPlayIntro);
  const [reducedMotionReplay, setReducedMotionReplay] = useState(false);
  const skipRef = useRef<HTMLButtonElement>(null);
  const loadedAssetCountRef = useRef(0);

  useEffect(() => {
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    skipRef.current?.focus();

    const finish = () => setVisible(false);
    const timer = window.setTimeout(finish, reducedMotionReplay ? REDUCED_REPLAY_DURATION_MS : INTRO_DURATION_MS);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
      if (event.key === 'Tab') {
        event.preventDefault();
        skipRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [visible, reducedMotionReplay]);

  useEffect(() => {
    const replay = () => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      try { markIntroSessionPlayed(window.sessionStorage); } catch { /* The replay remains available when storage is blocked. */ }
      setReducedMotionReplay(reducedMotion);
      setVisible(true);
    };
    window.addEventListener(INTRO_REPLAY_EVENT, replay);
    return () => window.removeEventListener(INTRO_REPLAY_EVENT, replay);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => {
      if (loadedAssetCountRef.current < INTRO_ASSET_COUNT) setVisible(false);
    }, INTRO_ASSET_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [visible]);

  const finishOnAssetError = () => setVisible(false);
  const recordAssetLoad = () => { loadedAssetCountRef.current += 1; };

  return (
    <>
      <div inert={visible} aria-hidden={visible || undefined}>
        {children}
      </div>
      {visible && (
        <section className={`brand-intro${reducedMotionReplay ? ' brand-intro--reduced' : ''}`} role="dialog" aria-modal="true" aria-label="wá jẹun introduction">
          <button ref={skipRef} type="button" className="brand-intro__skip" onClick={() => setVisible(false)}>
            Skip intro
          </button>
          <p className="sr-only">A celebration of Nigerian food and local discovery in Ijebu Ode and Ijagun. wá jẹun. Your City. Your Food.</p>
          <div className="brand-intro__stage" aria-live="off" aria-hidden="true">
            <section className="brand-intro__scene brand-intro__scene--hero">
              <div className="brand-intro__steam"><i /><i /><i /></div>
              <figure className="brand-intro__hero-dish">
                <img src={heroDish} alt="" fetchPriority="high" decoding="async" onLoad={recordAssetLoad} onError={finishOnAssetError} />
              </figure>
              <p className="brand-intro__hero-caption">A taste of home, made for your city.</p>
            </section>

            <section className="brand-intro__scene brand-intro__scene--food">
              <p className="brand-intro__eyebrow">Flavours that bring us together</p>
              <div className="brand-intro__food-row">
                <figure><img src={riceDishes} alt="" decoding="async" onLoad={recordAssetLoad} onError={finishOnAssetError} /><figcaption>Rice dishes</figcaption></figure>
                <figure><img src={swallowMeals} alt="" decoding="async" onLoad={recordAssetLoad} onError={finishOnAssetError} /><figcaption>Swallows &amp; soups</figcaption></figure>
                <figure><img src={grilledFood} alt="" decoding="async" onLoad={recordAssetLoad} onError={finishOnAssetError} /><figcaption>Grills &amp; more</figcaption></figure>
              </div>
            </section>

            <section className="brand-intro__scene brand-intro__scene--identity">
              <img className="brand-intro__wordmark" src="/brand/wa-jeun-logo.webp" alt="" onLoad={recordAssetLoad} onError={finishOnAssetError} />
              <p className="brand-intro__brand-tagline">Your City. Your Food.</p>
            </section>

            <section className="brand-intro__scene brand-intro__scene--discovery">
              <p className="brand-intro__eyebrow">Discover food in your city</p>
              <div className="brand-intro__discovery-cards">
                <article><img src={riceDishes} alt="" decoding="async" onLoad={recordAssetLoad} onError={finishOnAssetError} /><span>Find local dishes</span></article>
                <article><img src={swallowMeals} alt="" decoding="async" onLoad={recordAssetLoad} onError={finishOnAssetError} /><span>Browse menus</span></article>
                <article className="brand-intro__area-card"><span className="brand-intro__pin" aria-hidden="true">⌖</span><span>Ijebu Ode<br />&amp; Ijagun</span></article>
              </div>
              <p className="brand-intro__invitation">Discover what’s cooking around you.</p>
            </section>
          </div>
        </section>
      )}
    </>
  );
}
