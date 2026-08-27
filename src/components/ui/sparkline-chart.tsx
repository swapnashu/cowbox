import React from "react";

interface SparklineChartProps {
  data: number[];
  color: string;
  height?: number;
  label?: string;
}

export function SparklineChart({ data, color, height = 60, label }: SparklineChartProps) {
  if (!data || data.length === 0) {
    return <div style={{ height }} className="flex items-center justify-center text-xs text-slate-400">No data</div>;
  }

  const min = Math.min(...data, 0);
  const max = Math.max(...data, 100); // Assume percentage for now, or normalize
  const range = max - min || 1;

  const width = 200; // SVG viewBox width
  const svgHeight = 60; // SVG viewBox height

  // Normalize data points
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1 || 1)) * width;
    const y = svgHeight - ((val - min) / range) * svgHeight;
    return `${x},${y}`;
  });

  const pathD = `M 0,${svgHeight} L ${points.join(" L ")} L ${width},${svgHeight} Z`;
  const lineD = `M ${points.join(" L ")}`;

  return (
    <div className="w-full relative" style={{ height }}>
      {label && <div className="absolute top-0 left-0 text-[10px] font-bold text-slate-500">{label}</div>}
      <svg
        viewBox={`0 0 ${width} ${svgHeight}`}
        className="w-full h-full preserve-3d"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <path d={pathD} fill={`url(#gradient-${color})`} />
        <path d={lineD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}
