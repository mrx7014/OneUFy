import React, { useState, useEffect } from 'react';
import { Sparkles, X, Info } from 'lucide-react';

interface CompatibilityBannerProps {
  oneUiVersion: string;
}

const STORAGE_KEY = 'oneufy_legacy_banner_dismissed';

export const CompatibilityBanner: React.FC<CompatibilityBannerProps> = ({ oneUiVersion }) => {
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    try {
      const isAlreadyDismissed = localStorage.getItem(STORAGE_KEY) === 'true';
      setDismissed(isAlreadyDismissed);
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
    setDismissed(true);
  };

  if (dismissed) {
    return null;
  }

  return (
    <div className="compatibility-banner" role="status">
      <div className="compat-banner-left">
        <div className="compat-icon-badge">
          <Sparkles size={15} />
        </div>
        <div className="compat-banner-text">
          <span className="compat-title">{oneUiVersion || 'One UI 7+'} Mode Active</span>
          <span className="compat-desc">
            Showing exclusive One UI 7+ status overlays. Older legacy elements are hidden.
          </span>
        </div>
      </div>

      <button
        className="compat-dismiss-btn"
        onClick={handleDismiss}
        title="Dismiss notice"
        aria-label="Dismiss notice"
      >
        <X size={15} />
      </button>
    </div>
  );
};
