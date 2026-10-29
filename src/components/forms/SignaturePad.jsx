import { useCallback, useEffect, useRef, useState } from 'react';

const INK_COLORS = [
  { value: '#111827', label: 'Black' },
  { value: '#1d4ed8', label: 'Blue' },
  { value: '#0f8b3d', label: 'Green' },
];

function drawStroke(context, stroke) {
  const { points, color, width } = stroke;
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = width;
  if (points.length === 1) {
    context.beginPath();
    context.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
    context.fill();
    return;
  }
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length - 1; index += 1) {
    const midX = (points[index].x + points[index + 1].x) / 2;
    const midY = (points[index].y + points[index + 1].y) / 2;
    context.quadraticCurveTo(points[index].x, points[index].y, midX, midY);
  }
  const last = points[points.length - 1];
  context.lineTo(last.x, last.y);
  context.stroke();
}

// Reports the drawn signature as a transparent PNG Blob (or null when empty) through onChange.
export default function SignaturePad({ onChange, disabled = false }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const strokesRef = useRef([]);
  const currentRef = useRef(null);
  const [color, setColor] = useState(INK_COLORS[0].value);
  const [width, setWidth] = useState(3);
  const [strokeCount, setStrokeCount] = useState(0);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.scale(ratio, ratio);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    strokesRef.current.forEach((stroke) => drawStroke(context, stroke));
    if (currentRef.current) drawStroke(context, currentRef.current);
  }, []);

  const emit = useCallback(() => {
    if (strokesRef.current.length === 0) {
      onChange(null);
      return;
    }
    canvasRef.current.toBlob((blob) => onChange(blob), 'image/png');
  }, [onChange]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    const observer = new ResizeObserver(() => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(wrapper.clientWidth * ratio);
      canvas.height = Math.round(wrapper.clientHeight * ratio);
      redraw();
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [redraw]);

  function pointFromEvent(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function handlePointerDown(event) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    currentRef.current = { color, width, points: [pointFromEvent(event)] };
    redraw();
  }

  function handlePointerMove(event) {
    if (!currentRef.current) return;
    currentRef.current.points.push(pointFromEvent(event));
    redraw();
  }

  function finishStroke() {
    if (!currentRef.current) return;
    strokesRef.current.push(currentRef.current);
    currentRef.current = null;
    setStrokeCount(strokesRef.current.length);
    redraw();
    emit();
  }

  function undo() {
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redraw();
    emit();
  }

  function clear() {
    strokesRef.current = [];
    setStrokeCount(0);
    redraw();
    emit();
  }

  return (
    <div className="rounded-2xl border border-[#dfe8e1] bg-[#f9fbfa] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2" role="radiogroup" aria-label="Ink color">
          {INK_COLORS.map((ink) => (
            <button
              key={ink.value}
              type="button"
              role="radio"
              aria-checked={color === ink.value}
              aria-label={ink.label}
              title={ink.label}
              onClick={() => setColor(ink.value)}
              style={{ backgroundColor: ink.value }}
              className={`h-7 w-7 rounded-full border-2 transition ${color === ink.value ? 'border-[#0f8b3d] ring-2 ring-[#bfe5ca]' : 'border-white shadow'}`}
            />
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-[#5d6d68]">
          Pen size
          <input type="range" min="1" max="8" step="1" value={width} onChange={(event) => setWidth(Number(event.target.value))} className="h-1 w-24 accent-[#0f8b3d]" />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={undo} disabled={disabled || strokeCount === 0} className="rounded-lg border border-[#dfe8e1] bg-white px-3 py-1.5 text-xs font-semibold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-40">Undo</button>
          <button type="button" onClick={clear} disabled={disabled || strokeCount === 0} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40">Clear</button>
        </div>
      </div>

      <div ref={wrapperRef} className="relative h-52 w-full overflow-hidden rounded-xl border-2 border-dashed border-[#c9dccf] bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          className="absolute inset-0 h-full w-full cursor-crosshair"
          style={{ touchAction: 'none' }}
          aria-label="Signature drawing area"
        />
        {strokeCount === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[#9bb0a7]">Sign here using mouse, pen or touch</div>
        )}
        <div className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-[#e3ebea]" />
      </div>
    </div>
  );
}
