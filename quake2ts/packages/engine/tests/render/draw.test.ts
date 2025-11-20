
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as draw from '../../src/render/draw';
import { PakArchive } from '../../src/assets/pak.js';
import { createCanvas, Image } from 'canvas';

describe('draw', () => {
  beforeEach(() => {
    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext('2d');
    draw.Draw_Init(800, 600);
    (draw as any).canvas = canvas;
    (draw as any).ctx = ctx;

    global.Image = Image;
  });

  it('should register a pic', async () => {
    const pak = PakArchive.fromArrayBuffer('test.pak', new ArrayBuffer(0));
    const pic = await draw.Draw_RegisterPic(pak, 'test.png');
    expect(pic).toBe(-1);
  });

  it('should draw a pic', async () => {
    const pak = PakArchive.fromArrayBuffer('test.pak', new ArrayBuffer(0));
    await draw.Draw_RegisterPic(pak, 'test.png');
    const spy = vi.spyOn((draw as any).ctx, 'drawImage');
    draw.Draw_Pic(10, 20, 0);
    expect(spy).toHaveBeenCalled();
  });

  it('should draw a string', () => {
    const spy = vi.spyOn((draw as any).ctx, 'drawImage');
    draw.Draw_String(10, 20, 'test');
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it('should draw a char', () => {
    const spy = vi.spyOn((draw as any).ctx, 'drawImage');
    draw.Draw_Char(10, 20, 65);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should get the pic size', async () => {
    const pak = PakArchive.fromArrayBuffer('test.pak', new ArrayBuffer(0));
    const pic = await draw.Draw_RegisterPic(pak, 'test.png');
    const size = draw.Draw_GetPicSize(pic);
    expect(size).toEqual([0, 0]);
  });
});
