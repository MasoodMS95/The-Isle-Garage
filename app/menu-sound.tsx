'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
export default function MenuSound() {
  const [enabled, setEnabled] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const tone = useCallback(() => {
    const ctx = context.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.11);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  }, []);
  useEffect(
    () => () => {
      document.removeEventListener('click', tone);
      void context.current?.close();
    },
    [tone],
  );
  async function toggle() {
    if (enabled) {
      document.removeEventListener('click', tone);
      setEnabled(false);
      return;
    }
    try {
      context.current ??= new AudioContext();
      await context.current.resume();
      tone();
      document.addEventListener('click', tone);
      setEnabled(true);
    } catch {
      setEnabled(false);
    }
  }
  return (
    <button
      className="motion-control"
      aria-pressed={enabled}
      onClick={toggle}
      title="Original synthesized menu feedback"
    >
      {enabled ? <Volume2 size={14} /> : <VolumeX size={14} />}Sound{' '}
      {enabled ? 'on' : 'off'}
    </button>
  );
}
