interface Window {
  electronAPI?: {
    platform: string;
    setTitle: (title: string) => void;
  };
}
