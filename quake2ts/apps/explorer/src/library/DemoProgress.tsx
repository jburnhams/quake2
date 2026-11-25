import { Meter, format } from 'strata-react';
import { useDemoProgress } from './context';

/** The demo archive's download, while it arrives (nothing otherwise); then "Unpacking" while pak0.pak is taken out. */
export function DemoProgress() {
  const progress = useDemoProgress();
  if (!progress) return null;
  const { received, total } = progress;
  return (
    <Meter
      label="Downloading the Quake 2 demo"
      value={received}
      max={total ?? received}
      valueText={total === received ? 'Unpacking' : total ? format.share(received / total) : format.bytes(received)}
      detail={total ? `${format.bytes(received)} of ${format.bytes(total)}, once; later visits read it from this browser` : undefined}
    />
  );
}
