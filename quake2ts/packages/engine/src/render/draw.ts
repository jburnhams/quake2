
import { PakArchive } from '../assets/pak.js';
import { parsePcx, pcxToRgba } from '../assets/pcx.js';

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
const pics: (HTMLImageElement | ImageBitmap)[] = [];

let conchars: ImageBitmap | null = null;
const charWidth = 8;
const charHeight = 8;


export const Draw_Init = (width: number, height: number) => {
  canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d')!;
};

export const Draw_InitFont = async (pak: PakArchive) => {
    try {
        const data = pak.readFile('pics/conchars.pcx');
        const pcx = parsePcx(data.buffer.slice(0) as ArrayBuffer);
        const rgba = pcxToRgba(pcx);
        const imageData = new ImageData(new Uint8ClampedArray(rgba), pcx.width, pcx.height);
        conchars = await createImageBitmap(imageData);
    } catch (e) {
        console.error('Failed to load font:', e);
    }
}

export const Draw_RegisterPic = async (pak: PakArchive, name: string) => {
  try {
    const data = pak.readFile(name);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(data.buffer, data.byteOffset, data.byteLength)));
    const url = `data:image/png;base64,${base64}`;
    const img = new Image();
    const promise = new Promise<number>((resolve) => {
      img.onload = () => {
        pics.push(img);
        resolve(pics.length - 1);
      };
      img.onerror = () => {
        resolve(-1);
      };
    });
    img.src = url;
    return await promise;
  } catch (e) {
    return -1;
  }
};

export const Draw_Pic = (x: number, y: number, pic: number) => {
  if (pic < 0 || pic >= pics.length) {
    return;
  }
  const img = pics[pic];
  ctx.drawImage(img, x, y);
};

export const Draw_GetPicSize = (pic: number): [number, number] => {
  if (pic < 0 || pic >= pics.length) {
    return [0, 0];
  }
  const img = pics[pic];
  return [img.width, img.height];
};

export const Draw_String = (x: number, y: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
        Draw_Char(x + i * charWidth, y, text.charCodeAt(i));
    }
};

export const Draw_Char = (x: number, y: number, char: number) => {
    if (!conchars) {
        return;
    }
    const charIndex = char & 255;
    const srcX = (charIndex % 16) * charWidth;
    const srcY = Math.floor(charIndex / 16) * charHeight;
    ctx.drawImage(
        conchars,
        srcX,
        srcY,
        charWidth,
        charHeight,
        x,
        y,
        charWidth,
        charHeight
    );
};
