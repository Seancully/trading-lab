import { useEffect, useRef } from 'react';

// Lightweight inline sparkline. Pass an array of numbers.
// Color flips to bear when the last point is below zero.
export default function Sparkline({ data, width = 84, height = 24, stroke }) {
  const ref = useRef();

  useEffect(() => {
    const c = ref.current;
    if (!c || !data?.length) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr; c.height = height * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    if (data.length < 2) return;
    const min = Math.min(...data, 0);
    const max = Math.max(...data, 0);
    const range = (max - min) || 1;
    const last = data[data.length - 1];
    const style = getComputedStyle(document.body);
    const resolveVar = (s) => {
      if (typeof s !== 'string') return null;
      const m = s.match(/^var\((--[^)]+)\)$/);
      return m ? style.getPropertyValue(m[1]).trim() : s;
    };
    const color = resolveVar(stroke) || (last >= 0
      ? style.getPropertyValue('--bullStroke').trim() || '#22C55E'
      : style.getPropertyValue('--bearStroke').trim() || '#EF4444');

    const xOf = (i) => (i / (data.length - 1)) * (width - 2) + 1;
    const yOf = (v) => height - 2 - ((v - min) / range) * (height - 4);

    // Soft fill
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(data[0]));
    for (let i = 1; i < data.length; i++) ctx.lineTo(xOf(i), yOf(data[i]));
    ctx.lineTo(xOf(data.length - 1), height);
    ctx.lineTo(xOf(0), height);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, color + '33');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(data[0]));
    for (let i = 1; i < data.length; i++) ctx.lineTo(xOf(i), yOf(data[i]));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Last-point dot
    ctx.beginPath();
    ctx.arc(xOf(data.length - 1), yOf(last), 1.8, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }, [data, width, height, stroke]);

  return <canvas ref={ref} style={{ width, height, display: 'block' }} aria-hidden />;
}
