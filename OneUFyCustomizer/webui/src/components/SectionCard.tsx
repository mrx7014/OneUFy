import React, { useState, useEffect } from 'react';
import { SectionConfig, SectionState, OverlayItem } from '../types';
import { ALL_OVERLAYS } from '../data/overlayData';
import { OverlayItemCard } from './OverlayItemCard';
import { Wifi, Signal, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface SectionCardProps {
  config: SectionConfig;
  state: SectionState;
  items?: OverlayItem[];
  onToggle: (category: SectionConfig['category'], enabled: boolean) => void;
  onSelectItem: (item: OverlayItem) => void;
  disabled?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  config,
  state,
  items,
  onToggle,
  onSelectItem,
  disabled = false,
}) => {
  const displayItems = items && items.length > 0 ? items : ALL_OVERLAYS[config.category];
  const [isExpanded, setIsExpanded] = useState<boolean>(state.enabled);

  // Auto-expand when user enables the master toggle
  useEffect(() => {
    if (state.enabled) {
      setIsExpanded(true);
    }
  }, [state.enabled]);

  const renderIcon = () => {
    switch (config.icon) {
      case 'Wifi':
        return <Wifi size={20} />;
      case 'Signal':
        return <Signal size={20} />;
      case 'Sparkles':
        return <Sparkles size={20} />;
      default:
        return <Sparkles size={20} />;
    }
  };

  const handleToggle = (checked: boolean) => {
    onToggle(config.category, checked);
    if (checked) {
      setIsExpanded(true);
    }
  };

  return (
    <div className={`section-card ${state.enabled ? 'section-enabled' : ''}`}>
      <div className="section-header">
        <div
          className="section-title-wrap"
          onClick={() => setIsExpanded((prev) => !prev)}
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer', flex: 1 }}
        >
          <div className="section-icon-bubble">{renderIcon()}</div>
          <div className="section-text-group">
            <h3>{config.title}</h3>
            <p>
              {state.enabled && state.selectedName ? (
                <span className="active-tag">
                  Active: <strong>{state.selectedName}</strong>
                </span>
              ) : (
                <span>
                  {displayItems.length} styles • Selected: <strong>{state.selectedName || 'Default'}</strong>
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Material 3 Expressive Master Toggle Switch */}
        <label className="m3e-switch">
          <input
            type="checkbox"
            checked={state.enabled}
            disabled={disabled}
            onChange={(e) => handleToggle(e.target.checked)}
          />
          <div className="m3e-switch-track">
            <div className="m3e-switch-thumb" />
          </div>
        </label>
      </div>

      {/* Expandable Grid Container */}
      {isExpanded ? (
        <div className="section-expandable-body">
          <div className="overlay-items-grid">
            {displayItems.map((item) => (
              <OverlayItemCard
                key={item.id}
                item={item}
                isSelected={state.selectedId === item.id}
                onSelect={onSelectItem}
              />
            ))}
          </div>

          <button
            className="section-collapse-btn"
            onClick={() => setIsExpanded(false)}
            aria-label="Collapse section"
          >
            <span>Hide styles</span>
            <ChevronUp size={16} />
          </button>
        </div>
      ) : (
        <button
          className="section-expand-btn"
          onClick={() => setIsExpanded(true)}
          aria-label="Expand section"
        >
          <span>Show all {displayItems.length} styles</span>
          <ChevronDown size={16} />
        </button>
      )}
    </div>
  );
};
