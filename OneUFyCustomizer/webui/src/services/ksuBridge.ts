import * as ksu from 'kernelsu';
import * as ksuAlt from 'kernelsu-alt';

export interface ExecResult {
  errno: number;
  stdout: string;
  stderr: string;
}

// Check if running in a real KernelSU / APatch / Magisk WebUI WebView environment
export function isKsuEnvironment(): boolean {
  return typeof (window as unknown as { ksu?: unknown }).ksu !== 'undefined';
}

// Execute a root shell command with fallback and error handling
export async function execCommand(command: string): Promise<ExecResult> {
  // In native KernelSU WebView environment
  if (isKsuEnvironment()) {
    try {
      // Try kernelsu-alt first for enhanced stderr preservation
      if (typeof ksuAlt.exec === 'function') {
        const res = await ksuAlt.exec(command);
        return {
          errno: res.errno ?? (res as unknown as { code?: number }).code ?? 0,
          stdout: res.stdout || '',
          stderr: res.stderr || '',
        };
      }
      // Fallback to standard kernelsu exec
      if (typeof ksu.exec === 'function') {
        const res = await ksu.exec(command);
        return {
          errno: res.errno ?? (res as unknown as { code?: number }).code ?? 0,
          stdout: res.stdout || '',
          stderr: res.stderr || '',
        };
      }
      // Fallback to direct window.ksu.exec
      const rawKsu = (window as unknown as { ksu: { exec: (cmd: string) => Promise<ExecResult> | string } }).ksu;
      if (rawKsu && typeof rawKsu.exec === 'function') {
        const res = await rawKsu.exec(command);
        if (typeof res === 'string') {
          return { errno: 0, stdout: res, stderr: '' };
        }
        return res;
      }
    } catch (err: unknown) {
      console.error('[OneUFy Bridge] Root exec failed:', err);
      return {
        errno: 1,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Browser Simulation Mode (for testing and development UI preview)
  console.log('[OneUFy Mock Bridge] Executing command:', command);
  return mockExec(command);
}

// Display a system toast notification
export function showSystemToast(message: string): void {
  if (isKsuEnvironment()) {
    try {
      if (typeof ksuAlt.toast === 'function') {
        ksuAlt.toast(message);
        return;
      }
      if (typeof ksu.toast === 'function') {
        ksu.toast(message);
        return;
      }
      const rawKsu = (window as unknown as { ksu?: { toast?: (msg: string) => void } }).ksu;
      if (rawKsu?.toast) {
        rawKsu.toast(message);
        return;
      }
    } catch (err) {
      console.warn('[OneUFy Bridge] Toast call failed:', err);
    }
  }
  console.log('[OneUFy Mock Bridge] Toast:', message);
}

// Request edge-to-edge layout mode in KernelSU Manager
export function initWindowInsets(): void {
  if (isKsuEnvironment()) {
    try {
      const rawKsu = window as unknown as {
        ksu?: {
          enableEdgeToEdge?: () => void;
          enableInsets?: () => void;
          fullScreen?: (val: boolean) => void;
        };
      };
      if (rawKsu.ksu?.enableEdgeToEdge) {
        rawKsu.ksu.enableEdgeToEdge();
      } else if (rawKsu.ksu?.enableInsets) {
        rawKsu.ksu.enableInsets();
      }
      if (rawKsu.ksu?.fullScreen) {
        rawKsu.ksu.fullScreen(true);
      }
    } catch (e) {
      console.warn('[OneUFy Bridge] Inset initialization warning:', e);
    }
  }
}

// In-memory simulation state for browser previews
const mockStorage: Record<string, string> = {
  'Wifi-Icons/.on': 'true',
  'Wifi-Icons/.selected': 'ios-wifi.apk',
  'system/product/overlay/ios-wifi.apk': 'present',
};

async function mockExec(command: string): Promise<ExecResult> {
  await new Promise((r) => setTimeout(r, 120));

  if (command.includes('getprop ro.product.model')) {
    return { errno: 0, stdout: 'SM-S928B (Galaxy S24 Ultra)\n', stderr: '' };
  }
  if (command.includes('getprop ro.product.brand')) {
    return { errno: 0, stdout: 'Samsung\n', stderr: '' };
  }
  if (command.includes('getprop ro.build.version.release')) {
    return { errno: 0, stdout: '14\n', stderr: '' };
  }
  if (command.includes('getprop ro.build.version.sep')) {
    return { errno: 0, stdout: '150100\n', stderr: '' };
  }
  if (command.includes('getprop ro.build.version.oneui')) {
    return { errno: 0, stdout: '6.1\n', stderr: '' };
  }

  // Check file exists
  if (command.startsWith('[ -f') || command.startsWith('test -f')) {
    const match = command.match(/(?:assets|overlay|modules\/OneUFy)\/([^'"]+)/);
    const key = match ? match[1] : '';
    const exists = Object.keys(mockStorage).some((k) => k.includes(key));
    return { errno: exists ? 0 : 1, stdout: '', stderr: '' };
  }

  // Directory listing
  if (command.includes('ls') && command.includes('system/product/overlay')) {
    const applied = Object.keys(mockStorage)
      .filter((k) => k.startsWith('system/product/overlay/'))
      .map((k) => k.replace('system/product/overlay/', ''))
      .join('\n');
    return { errno: 0, stdout: applied, stderr: '' };
  }

  // Touch .on or write .selected
  if (command.includes('touch') || command.includes('echo')) {
    if (command.includes('.on')) {
      if (command.includes('Wifi-Icons')) mockStorage['Wifi-Icons/.on'] = 'true';
      if (command.includes('Signal-Icons')) mockStorage['Signal-Icons/.on'] = 'true';
      if (command.includes('Icon-Packs')) mockStorage['Icon-Packs/.on'] = 'true';
    }
    return { errno: 0, stdout: '', stderr: '' };
  }

  // Remove .on or rm file
  if (command.includes('rm -f') || command.includes('rm -rf')) {
    if (command.includes('Wifi-Icons/.on')) delete mockStorage['Wifi-Icons/.on'];
    if (command.includes('Signal-Icons/.on')) delete mockStorage['Signal-Icons/.on'];
    if (command.includes('Icon-Packs/.on')) delete mockStorage['Icon-Packs/.on'];
    return { errno: 0, stdout: '', stderr: '' };
  }

  // SystemUI restart mock
  if (command.includes('systemui') || command.includes('killall')) {
    return { errno: 0, stdout: 'SystemUI restarted\n', stderr: '' };
  }

  return { errno: 0, stdout: 'OK\n', stderr: '' };
}
