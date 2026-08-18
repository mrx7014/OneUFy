import React, { useState, useEffect } from 'react';
import {
  OverlayCategory,
  SectionState,
  ModuleStatus,
  ThemeMode,
  DeviceInfo,
  OverlayItem,
  ToastMessage,
} from './types';
import { SECTION_CONFIGS, getItemsForOneUiVersion } from './data/overlayData';
import {
  getDeviceInfo,
  loadCategoryItems,
  getSectionsState,
  toggleSection,
  selectOverlayItem,
  rebootDevice,
} from './services/overlayManager';
import { initWindowInsets, isKsuEnvironment } from './services/ksuBridge';
import { HeaderCard } from './components/HeaderCard';
import { SectionCard } from './components/SectionCard';
import { ThemeToggle } from './components/ThemeToggle';
import { CompatibilityBanner } from './components/CompatibilityBanner';
import { StatusToast } from './components/StatusToast';
import { BrandLogo } from './components/BrandLogo';
import { Power } from 'lucide-react';

export const App: React.FC = () => {
  const [status, setStatus] = useState<ModuleStatus>('idle');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Default to One UI 7+ dataset initially
  const initialData = getItemsForOneUiVersion(true);
  const [categoryItems, setCategoryItems] = useState<Record<OverlayCategory, OverlayItem[]>>(initialData);
  const [sectionsState, setSectionsState] = useState<Record<OverlayCategory, SectionState>>({
    wifi: {
      category: 'wifi',
      enabled: false,
      selectedId: initialData.wifi[0]?.id || 'wifi5',
      selectedName: initialData.wifi[0]?.name || 'WIFI 5 OneUI 7+',
      selectedFilename: initialData.wifi[0]?.filename || 'wifi5.apk',
      itemCount: initialData.wifi.length,
    },
    signal: {
      category: 'signal',
      enabled: false,
      selectedId: initialData.signal[0]?.id || 'signal8-5-5',
      selectedName: initialData.signal[0]?.name || 'Signal 8.5 5 OneUI 7+',
      selectedFilename: initialData.signal[0]?.filename || 'signal8.5-5.apk',
      itemCount: initialData.signal.length,
    },
    icons: {
      category: 'icons',
      enabled: false,
      selectedId: null,
      selectedName: null,
      selectedFilename: null,
      itemCount: 0,
    },
  });

  // Helper to add toast messages
  const addToast = (
    title: string,
    message: string,
    type: ToastMessage['type'] = 'info',
    actionLabel?: string,
    onAction?: () => void
  ) => {
    const newToast: ToastMessage = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      message,
      type,
      timestamp: Date.now(),
      actionLabel,
      onAction,
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, actionLabel ? 6500 : 3800);
  };

  // Initialize theme, insets, and dynamic overlay scan on mount
  useEffect(() => {
    initWindowInsets();

    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme: ThemeMode = prefersDark ? 'dark' : 'light';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);

    const initializeData = async () => {
      try {
        setStatus('working');
        const devInfo = await getDeviceInfo();
        setDeviceInfo(devInfo);

        // Determine if device is One UI 7.0+
        const isOneUi7Plus =
          !devInfo.isSamsung ||
          devInfo.oneUiNumeric === undefined ||
          devInfo.oneUiNumeric >= 7.0;

        const scannedItems = await loadCategoryItems(isOneUi7Plus);
        setCategoryItems(scannedItems);

        const states = await getSectionsState(scannedItems);
        setSectionsState(states);
        setStatus('ready');
      } catch (e) {
        console.error('Initialization error:', e);
        setStatus('idle');
      }
    };

    initializeData();
  }, []);

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Device Reboot Handler
  const handleReboot = async () => {
    addToast('Rebooting...', 'Initiating device reboot sequence', 'info');
    await rebootDevice();
  };

  // Preview Mode One UI Version Switcher
  const handleTogglePreviewOneUiVersion = async () => {
    if (!deviceInfo) return;
    const isCurrently7Plus = deviceInfo.oneUiNumeric !== undefined && deviceInfo.oneUiNumeric >= 7.0;
    const targetIs7Plus = !isCurrently7Plus;
    const newVersion = targetIs7Plus ? 'One UI 7.0' : 'One UI 6.1';
    const newNumeric = targetIs7Plus ? 7.0 : 6.1;

    const updatedDevInfo: DeviceInfo = {
      ...deviceInfo,
      oneUiVersion: newVersion,
      oneUiNumeric: newNumeric,
    };
    setDeviceInfo(updatedDevInfo);

    const scannedItems = await loadCategoryItems(targetIs7Plus);
    setCategoryItems(scannedItems);

    const states = await getSectionsState(scannedItems);
    setSectionsState(states);

    addToast(
      'Preview Version Switched',
      `Switched preview environment to ${newVersion}`,
      'info'
    );
  };

  // Master Section Toggle Handler
  const handleToggleSection = async (category: OverlayCategory, enabled: boolean) => {
    try {
      setStatus('working');
      const res = await toggleSection(category, enabled, sectionsState, categoryItems);
      setSectionsState(res.updatedStates);
      setStatus('ready');

      const selectedName = res.updatedStates[category].selectedName || 'Overlay';
      if (enabled) {
        addToast(
          'Overlay Enabled',
          `Applied '${selectedName}'. Reboot device to activate.`,
          'success',
          'Reboot Now',
          handleReboot
        );
      } else {
        addToast(
          'Overlay Disabled',
          `Turned off overlay. Reboot device to restore default.`,
          'info',
          'Reboot Now',
          handleReboot
        );
      }
    } catch (err) {
      console.error('Toggle error:', err);
      setStatus('error');
      addToast('Error', 'Failed to toggle section overlay', 'error');
    }
  };

  // Item Selection Handler
  const handleSelectItem = async (item: OverlayItem) => {
    try {
      setStatus('working');
      const res = await selectOverlayItem(item, sectionsState, categoryItems);
      setSectionsState(res.updatedStates);
      setStatus('ready');

      const isEnabled = sectionsState[item.category]?.enabled;
      if (isEnabled) {
        addToast(
          'Overlay Switched',
          `Selected '${item.name}'. Reboot your device to apply changes.`,
          'success',
          'Reboot Now',
          handleReboot
        );
      } else {
        addToast(
          'Selection Saved',
          `'${item.name}' selected. Enable the toggle & reboot to apply.`,
          'info'
        );
      }
    } catch (err) {
      console.error('Item selection error:', err);
      setStatus('error');
      addToast('Error', 'Failed to select overlay', 'error');
    }
  };

  // Filter sections: Hide legacy Icon Packs on One UI 7+
  const isOneUi7Plus =
    !deviceInfo ||
    !deviceInfo.isSamsung ||
    deviceInfo.oneUiNumeric === undefined ||
    deviceInfo.oneUiNumeric >= 7.0;

  const visibleConfigs = SECTION_CONFIGS.filter((config) => {
    if (isOneUi7Plus && config.maxOneUiVersion !== undefined && config.maxOneUiVersion < 7.0) {
      return false; // Hide legacy Icon Packs on One UI 7+
    }
    return true;
  });

  const availableCategories = visibleConfigs.map((c) => c.category);

  return (
    <div className="app-container">
      {/* Top Application Bar */}
      <header className="top-app-bar">
        <div className="brand-section">
          <BrandLogo size={38} />
          <div className="brand-title-group">
            <div className="brand-title-row">
              <h1 className="brand-title">
                <span>One</span>
                <span className="brand-highlight">UFy</span>
              </h1>
              <span className="brand-version-chip">{deviceInfo?.moduleVersion || 'v1.0.0'}</span>
            </div>
            <span className="brand-subtitle">OneUI Status Customizer</span>
          </div>
        </div>

        <div className="top-bar-actions">
          <button
            className="icon-button reboot-btn"
            onClick={handleReboot}
            title="Reboot Device"
            disabled={status === 'working'}
            aria-label="Reboot Device"
          >
            <Power size={18} />
          </button>
          <ThemeToggle currentTheme={theme} onThemeChange={handleThemeChange} />
        </div>
      </header>

      {/* Header Status Card */}
      <HeaderCard
        status={status}
        deviceInfo={deviceInfo}
        sectionsState={sectionsState}
        availableCategories={availableCategories}
        onToggleVersion={!isKsuEnvironment() ? handleTogglePreviewOneUiVersion : undefined}
      />

      {/* Dismissable One UI 7+ Compatibility Notice */}
      {isOneUi7Plus && (
        <CompatibilityBanner oneUiVersion={deviceInfo?.oneUiVersion || 'One UI 7.0'} />
      )}

      {/* Categorized Sections: Wi-Fi, Signal, (Icon Packs on legacy) */}
      {visibleConfigs.map((config) => (
        <SectionCard
          key={config.category}
          config={config}
          items={categoryItems[config.category]}
          state={sectionsState[config.category]}
          onToggle={handleToggleSection}
          onSelectItem={handleSelectItem}
          disabled={status === 'working'}
        />
      ))}

      {/* Toast Notification Shelf */}
      <StatusToast
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
};
