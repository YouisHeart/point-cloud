import { useCallback, useEffect } from 'react';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';


export const useViewer= ({ scene }) => {
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
  }, [scene]);

  useEffect(() => {
    init();
  }, []);
};
