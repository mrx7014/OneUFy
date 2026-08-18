import React, { useState, useEffect } from 'react';
import { OverlayItem } from '../types';
import { Check } from 'lucide-react';
import { getVectorForOverlay, ExtractedVector } from '../services/dynamicVectorParser';

interface OverlayItemCardProps {
  item: OverlayItem;
  isSelected: boolean;
  isSectionEnabled?: boolean;
  onSelect: (item: OverlayItem) => void;
}

export const OverlayItemCard: React.FC<OverlayItemCardProps> = ({
  item,
  isSelected,
  onSelect,
}) => {
  const [vectorData, setVectorData] = useState<ExtractedVector | null>(null);

  useEffect(() => {
    let isMounted = true;
    getVectorForOverlay(item).then((data) => {
      if (isMounted && data) {
        setVectorData(data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [item]);

  return (
    <div
      className={`overlay-item-pill ${isSelected ? 'pill-selected' : ''}`}
      onClick={() => onSelect(item)}
      role="button"
      tabIndex={0}
    >
      <div className="pill-icon-container">
        {vectorData && vectorData.paths && vectorData.paths.length > 0 ? (
          <svg
            viewBox={vectorData.viewBox || '0 0 24 24'}
            preserveAspectRatio="xMidYMid meet"
            className="pill-vector-svg"
          >
            {vectorData.paths.map((p, idx) => (
              <path
                key={idx}
                d={p.d}
                fill={p.fill || 'currentColor'}
                stroke={p.stroke || 'none'}
                strokeWidth={p.strokeWidth}
                strokeLinecap={p.strokeLineCap || 'round'}
                strokeLinejoin={p.strokeLineJoin || 'round'}
                fillOpacity={p.fillOpacity}
                strokeOpacity={p.strokeOpacity}
              />
            ))}
          </svg>
        ) : (
          <ItemIconFallback category={item.category} filename={item.filename} />
        )}
      </div>

      <div className="pill-text-content">
        <div className="pill-name" title={item.name}>
          {item.name}
        </div>
        {item.description && (
          <div className="pill-desc" title={item.description}>
            {item.description}
          </div>
        )}
      </div>

      {isSelected && (
        <div className="pill-check-badge">
          <Check size={11} strokeWidth={3} />
        </div>
      )}
    </div>
  );
};

const ItemIconFallback: React.FC<{ category: string; filename?: string }> = ({ category, filename = '' }) => {
  const isWifi = category === 'wifi' || filename.toLowerCase().includes('wifi');
  const isSignal = category === 'signal' || filename.toLowerCase().includes('signal');

  if (isWifi) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M5 8.5C9.2 4.5 14.8 4.5 19 8.5" />
        <path d="M8.5 12.5C10.8 10.2 13.2 10.2 15.5 12.5" />
        <circle cx="12" cy="17.5" r="1.5" fill="currentColor" />
      </svg>
    );
  }

  if (isSignal) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="16" width="3" height="5" rx="1" />
        <rect x="9" y="12" width="3" height="9" rx="1" />
        <rect x="14" y="8" width="3" height="13" rx="1" />
        <rect x="19" y="4" width="3" height="17" rx="1" />
      </svg>
    );
  }

  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <circle cx="18" cy="5" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
};
