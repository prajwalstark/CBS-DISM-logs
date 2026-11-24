import { Bloom, EffectComposer, N8AO, Vignette, DepthOfField } from '@react-three/postprocessing';
import type { Quality } from '@/lib/webgl';
import { useApp } from '@/store/app';

/** Selective post-processing: bloom only catches emissive >1 (toneMapped=false) materials. */
export function Effects({ quality, dof }: { quality: Quality; dof?: boolean }) {
  const bloom = useApp((s) => s.settings.bloom);
  if (quality === 'low') return null;
  const high = quality === 'high';
  return (
    <EffectComposer multisampling={high ? 4 : 0} enableNormalPass={high}>
      {high ? <N8AO aoRadius={1.2} intensity={1.4} distanceFalloff={0.6} halfRes /> : <></>}
      {bloom ? <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.2} intensity={high ? 0.9 : 0.7} radius={0.7} /> : <></>}
      {high && dof ? <DepthOfField focusDistance={0.02} focalLength={0.06} bokehScale={1.6} /> : <></>}
      <Vignette eskil={false} offset={0.25} darkness={0.7} />
    </EffectComposer>
  );
}
