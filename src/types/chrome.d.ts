declare namespace chrome {
  namespace runtime {
    const lastError: { message?: string } | undefined;
    function sendMessage(message: unknown, callback?: (response: unknown) => void): void;
    const onMessage: {
      addListener(
        callback: (
          message: any,
          sender: { tab?: tabs.Tab },
          sendResponse: (response?: any) => void
        ) => boolean | void
      ): void;
    };
    function openOptionsPage(callback?: () => void): void;
    function getURL(path: string): string;
  }

  namespace storage {
    const local: {
      get(keys: string[] | string | null, callback: (items: Record<string, any>) => void): void;
      set(items: Record<string, any>, callback?: () => void): void;
    };
  }

  namespace tabs {
    interface Tab {
      id?: number;
      windowId?: number;
      url?: string;
      title?: string;
    }

    function query(queryInfo: Record<string, any>, callback: (tabs: Tab[]) => void): void;
    function get(tabId: number, callback: (tab: Tab) => void): void;
    function sendMessage(tabId: number, message: unknown, callback?: (response: unknown) => void): void;
  }

  namespace windows {
    interface Window {
      id?: number;
    }

    function create(
      createData: {
        url?: string;
        type?: "normal" | "popup";
        width?: number;
        height?: number;
        focused?: boolean;
      },
      callback?: (window?: Window) => void
    ): void;
  }

  namespace scripting {
    function executeScript(
      injection: { target: { tabId: number }; files: string[] },
      callback?: () => void
    ): void;
  }

  namespace downloads {
    function download(options: { url: string; filename?: string; saveAs?: boolean }, callback?: (downloadId: number) => void): void;
  }
}
