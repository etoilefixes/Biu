interface Window {
  electronAPI?: {
    platform: string;
    autoLoginToken: string;
    setTitle: (title: string) => void;
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    isMaximized: () => Promise<boolean>;
    onMaximizedChanged: (callback: (maximized: boolean) => void) => void;
  };
}
