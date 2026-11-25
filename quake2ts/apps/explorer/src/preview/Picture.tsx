// A decoded picture drawn into a canvas at a whole-number zoom with square pixels, since Quake's
// textures are small (32 to 256 pixels) and a smoothed upscale hides what the artist drew.
import * as React from 'react';
import type { Picture as PictureData } from './decode';

export function Picture({ picture, label, maxSize = 512 }: { picture: PictureData; label: string; maxSize?: number }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const context = ref.current?.getContext('2d');
    if (!context) return; // jsdom has no canvas
    const image = context.createImageData(picture.width, picture.height);
    image.data.set(picture.rgba);
    context.putImageData(image, 0, 0);
  }, [picture]);
  const zoom = Math.max(1, Math.floor(maxSize / Math.max(picture.width, picture.height)));
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      width={picture.width}
      height={picture.height}
      className="block max-w-full"
      style={{ width: picture.width * zoom, imageRendering: 'pixelated' }}
    />
  );
}
