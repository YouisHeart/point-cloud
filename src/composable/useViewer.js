import { useCallback, useEffect,useRef } from 'react';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';


export const useViewer= ({ scene }) => {
  const viewerRef = useRef(null);

  const init = useCallback(() => {
    const viewer = new GaussianSplats3D.DropInViewer();
    viewer.addSplatScenes(
      [
        {
          path: './models/city.ply',
          splatAlphaRemovalThreshold: 20
        }
      ],
      true
    );
    scene.add(viewer);
    viewerRef.current = viewer;
  }, [scene]);

  useEffect(() => {
    init();
  }, [init]);

  return viewerRef.current;
};
