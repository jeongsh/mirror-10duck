"use client";

import { Rectangle } from "pixi.js";
import { LIVE2D_VIEWPORT } from "@/lib/live2d/viewport";
import type { CharacterViewConfig } from "@/types/character";

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

function verticallyFlipCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = source.width;
  output.height = source.height;

  const context = output.getContext("2d");
  if (!context) return source;

  context.translate(0, output.height);
  context.scale(1, -1);
  context.drawImage(source, 0, 0);

  return output;
}

function patchCore6RenderOrders(model: any) {
  try {
    const core = (
      model.internalModel as {
        coreModel?: {
          _model?: {
            drawables?: { renderOrders?: Int32Array };
            renderOrders?: Int32Array;
          };
        };
      }
    ).coreModel?._model;
    if (core?.drawables && !core.drawables.renderOrders && core.renderOrders) {
      core.drawables.renderOrders = core.renderOrders;
    }
  } catch (e) {
    console.warn("[thumbnailCapture] core6 compat patch warning:", e);
  }
}

export async function extractRendererThumbnail(
  app: any,
  fallbackCanvas: HTMLCanvasElement,
): Promise<Blob | null> {
  try {
    const maybeCanvas = app.renderer?.extract?.canvas?.({
      target: app.stage,
      frame: new Rectangle(0, 0, LIVE2D_VIEWPORT.width, LIVE2D_VIEWPORT.height),
      resolution: 1,
      clearColor: [0, 0, 0, 0],
      antialias: true,
    });
    const extractedCanvas =
      typeof maybeCanvas?.then === "function" ? await maybeCanvas : maybeCanvas;
    if (extractedCanvas instanceof HTMLCanvasElement) {
      const blob = await canvasToPngBlob(verticallyFlipCanvas(extractedCanvas));
      if (blob) return blob;
    }
  } catch (e) {
    console.warn("[thumbnailCapture] renderer extract warning:", e);
  }

  return canvasToPngBlob(fallbackCanvas);
}

export async function captureLive2DThumbnail(
  modelUrl: string,
  view: CharacterViewConfig,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = LIVE2D_VIEWPORT.width;
  canvas.height = LIVE2D_VIEWPORT.height;

  let app: any = null;
  let model: any = null;
  const previousApp = window.app;

  try {
    const [{ Application, Ticker }, { Live2DModel }] = await Promise.all([
      import("pixi.js"),
      import("@naari3/pixi-live2d-display"),
    ]);

    app = new Application();
    await app.init({
      canvas,
      preference: "webgl",
      antialias: true,
      backgroundAlpha: 0,
      resolution: 1,
      autoDensity: false,
      width: LIVE2D_VIEWPORT.width,
      height: LIVE2D_VIEWPORT.height,
    });

    Live2DModel.registerTicker(Ticker);
    window.app = app;

    model = await Live2DModel.from(modelUrl, {
      autoHitTest: false,
      autoFocus: false,
    });
    patchCore6RenderOrders(model);

    try {
      (model as { setRenderer?: (renderer: unknown) => void }).setRenderer?.(app.renderer);
    } catch (e) {
      console.warn("[thumbnailCapture] setRenderer warning:", e);
    }

    model.scale.set(view.scale);
    model.x = view.x;
    model.y = view.y;
    app.stage.addChild(model);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    app.render?.();

    return extractRendererThumbnail(app, canvas);
  } finally {
    if (model) {
      try {
        model.destroy({ children: true, texture: true, baseTexture: true });
      } catch (e) {
        console.warn("[thumbnailCapture] model destroy warning:", e);
      }
    }
    if (app) {
      try {
        app.destroy(true, {
          children: true,
          texture: true,
          baseTexture: true,
          textureSource: true,
        });
      } catch (e) {
        console.warn("[thumbnailCapture] app destroy warning:", e);
      }
    }
    if (window.app === app) {
      window.app = previousApp;
    }
  }
}
