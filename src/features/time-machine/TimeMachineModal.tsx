import { useMemo } from 'react';
import { useT } from '../../content/i18n';
import { Modal } from '../../components/Modal';
import { END_YEAR } from '../../state/store';
import type { PlaceRef } from '../../state/url';
import { TimeMachine } from './TimeMachine';

/** Time Machine for any place: ±2° box, user-editable dates (default: same July day, 2001 vs last full year). */
export default function TimeMachineModal({ place, name, onClose }: { place: PlaceRef; name: string; onClose: () => void }) {
  const t = useT();
  const bbox = useMemo(() => {
    const dLon = Math.min(8, 2 / Math.max(0.25, Math.cos((place.lat * Math.PI) / 180)));
    return {
      latMin: Math.max(-90, place.lat - 2),
      latMax: Math.min(90, place.lat + 2),
      lonMin: Math.max(-180, place.lon - dLon),
      lonMax: Math.min(180, place.lon + dLon),
    };
  }, [place.lat, place.lon]);
  return (
    <Modal title={`${t.timeMachine.title} — ${name}`} onClose={onClose} wide>
      <TimeMachine bbox={bbox} dates={['2001-07-15', `${END_YEAR}-07-15`]} editable />
    </Modal>
  );
}
