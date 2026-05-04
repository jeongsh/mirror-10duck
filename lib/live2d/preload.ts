type Live2DModelSettings = {
  FileReferences?: {
    Moc?: string;
    Textures?: string[];
    Physics?: string;
    Pose?: string;
    DisplayInfo?: string;
    Expressions?: { File?: string }[];
    Motions?: Record<string, { File?: string }[]>;
  };
};

const warmedModelPaths = new Set<string>();

const idle = (task: () => void) => {
  if (typeof window === "undefined") return;

  const requestIdle: (callback: IdleRequestCallback) => number =
    window.requestIdleCallback ?? ((callback) => window.setTimeout(callback, 300));
  requestIdle(() => task());
};

const toAssetUrl = (file: string | undefined, modelPath: string): string | null => {
  if (!file) return null;

  if (/^(https?:|blob:|data:)/i.test(file) || file.startsWith("/")) {
    try {
      return new URL(file, window.location.origin).toString();
    } catch {
      return null;
    }
  }

  try {
    return new URL(file, new URL(modelPath, window.location.origin)).toString();
  } catch {
    return null;
  }
};

const preloadFetch = (url: string) => {
  void fetch(url, { cache: "force-cache" }).catch(() => {
    // Preload is opportunistic; Live2DModel.from will surface real load failures.
  });
};

const preloadImage = (url: string) => {
  const img = new Image();
  img.decoding = "async";
  img.loading = "eager";
  img.src = url;
};

const collectReferencedFiles = (settings: Live2DModelSettings): string[] => {
  const refs = settings.FileReferences;
  if (!refs) return [];

  const files = [
    refs.Moc,
    refs.Physics,
    refs.Pose,
    refs.DisplayInfo,
    ...(refs.Textures ?? []),
    ...(refs.Expressions ?? []).map((exp) => exp.File),
    ...Object.values(refs.Motions ?? {}).flatMap((motions) => motions.map((motion) => motion.File)),
  ];

  return files.filter((file): file is string => Boolean(file));
};

export function preloadLive2DModel(modelPath: string | null) {
  if (typeof window === "undefined" || !modelPath || warmedModelPaths.has(modelPath)) return;
  warmedModelPaths.add(modelPath);

  idle(() => {
    void import("pixi.js");
    void import("@naari3/pixi-live2d-display");

    const settingsUrl = toAssetUrl(modelPath, window.location.href);
    if (!settingsUrl) return;

    void fetch(settingsUrl, { cache: "force-cache" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as Live2DModelSettings;
      })
      .then((settings) => {
        if (!settings) return;

        for (const file of collectReferencedFiles(settings)) {
          const assetUrl = toAssetUrl(file, settingsUrl);
          if (!assetUrl) continue;

          if (/\.(png|jpe?g|webp|avif)(\?|#|$)/i.test(assetUrl)) {
            preloadImage(assetUrl);
          } else {
            preloadFetch(assetUrl);
          }
        }
      })
      .catch(() => {
        warmedModelPaths.delete(modelPath);
      });
  });
}
