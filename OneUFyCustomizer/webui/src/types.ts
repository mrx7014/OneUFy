export type OverlayCategory = 'wifi' | 'signal' | 'icons';

export interface OverlayItem {
  id: string;
  name: string;
  category: OverlayCategory;
  filename: string;
  folderName: 'Wifi-Icons' | 'Signal-Icons' | 'Icon-Packs' | 'OneUI-7';
  description?: string;
  badge?: string;
  previewVariant: string;
  isOneUi7Only?: boolean;
}

export interface SectionConfig {
  category: OverlayCategory;
  title: string;
  subtitle: string;
  folderName: 'Wifi-Icons' | 'Signal-Icons' | 'Icon-Packs' | 'OneUI-7';
  icon: string;
  defaultItemId: string;
  minOneUiVersion?: number;
  maxOneUiVersion?: number;
}

export interface SectionState {
  category: OverlayCategory;
  enabled: boolean;
  selectedId: string | null;
  selectedName: string | null;
  selectedFilename: string | null;
  itemCount: number;
}

export type ModuleStatus = 'ready' | 'working' | 'idle' | 'error';

export type ThemeMode = 'system' | 'light' | 'dark' | 'monet';

export interface DeviceInfo {
  model: string;
  brand: string;
  androidVersion: string;
  oneUiVersion: string;
  oneUiNumeric?: number;
  moduleVersion?: string;
  isSamsung: boolean;
  rootBackend: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
  actionLabel?: string;
  onAction?: () => void;
}
