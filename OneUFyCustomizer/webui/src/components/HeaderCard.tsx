import React from 'react';
import { ModuleStatus, DeviceInfo, SectionState, OverlayCategory } from '../types';
import { Smartphone, Layers, CheckCircle2, Loader2, Sparkles, Wifi, Signal } from 'lucide-react';

interface HeaderCardProps {
  status: ModuleStatus;
  deviceInfo: DeviceInfo | null;
  sectionsState: Record<OverlayCategory, SectionState>;
  availableCategories?: OverlayCategory[];
  onToggleVersion?: () => void;
}

export const HeaderCard: React.FC<HeaderCardProps> = ({
  status,
  deviceInfo,
  sectionsState,
  availableCategories = ['wifi', 'signal', 'icons'],
  onToggleVersion,
}) => {
  const activeSections = availableCategories.filter(
    (key) => sectionsState[key]?.enabled
  );
  const activeCount = activeSections.length;
  const totalCount = availableCategories.length;

  const isWorking = status === 'working';

  return (
    <div
      className={`header-status-card ${
        isWorking ? 'status-working' : 'status-ready'
      }`}
    >
      <div className="header-main-row">
        <div className="header-status-indicator">
          <div className="status-dot-pulse" />
          <div className="header-status-text">
            <h2>{isWorking ? 'Applying Overlays...' : 'OneUI Customizer Ready'}</h2>
            <p>
              {isWorking
                ? 'Updating overlay files & refreshing SystemUI'
                : activeCount === 0
                ? 'No overlays currently active'
                : `${activeCount} custom overlay${activeCount > 1 ? 's' : ''} applied to SystemUI`}
            </p>
          </div>
        </div>

        <div className="status-count-badge">
          {isWorking ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Syncing</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={14} />
              <span>{activeCount} / {totalCount} Active</span>
            </>
          )}
        </div>
      </div>

      {/* Active Overlays Badges */}
      {activeCount > 0 && (
        <div className="active-overlays-pills">
          {sectionsState.wifi?.enabled && (
            <span className="active-pill">
              <Wifi size={12} />
              <span>Wifi: {sectionsState.wifi.selectedName || 'Active'}</span>
            </span>
          )}
          {sectionsState.signal?.enabled && (
            <span className="active-pill">
              <Signal size={12} />
              <span>Signal: {sectionsState.signal.selectedName || 'Active'}</span>
            </span>
          )}
          {sectionsState.icons?.enabled && (
            <span className="active-pill">
              <Sparkles size={12} />
              <span>Icons: {sectionsState.icons.selectedName || 'Active'}</span>
            </span>
          )}
        </div>
      )}

      {/* Device Specifications Info Chips */}
      {deviceInfo && (
        <div className="device-specs-bar">
          {/* Badge 1: Exact Device Name / Model with Smartphone Icon */}
          <span className="spec-chip">
            <Smartphone size={12} />
            <span>{deviceInfo.model}</span>
          </span>

          {/* Badge 2: One UI Version highlighted (Interactive in preview mode) */}
          {onToggleVersion ? (
            <button
              className="spec-chip oneui-badge spec-chip-interactive"
              onClick={onToggleVersion}
              title="Click to toggle One UI version in preview mode"
            >
              <span>{deviceInfo.oneUiVersion}</span>
              <span className="chip-switch-hint">⇄</span>
            </button>
          ) : (
            <span className="spec-chip oneui-badge">
              <span>{deviceInfo.oneUiVersion}</span>
            </span>
          )}

          {/* Badge 3: Android Version */}
          <span className="spec-chip">
            <span>Android {deviceInfo.androidVersion}</span>
          </span>

          {/* Badge 4: Root Environment Backend */}
          <span className="spec-chip">
            <Layers size={12} />
            <span>{deviceInfo.rootBackend}</span>
          </span>
        </div>
      )}
    </div>
  );
};
