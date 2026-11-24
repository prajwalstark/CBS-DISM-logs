import { lazy } from 'react';

// Each 3D scene is code-split so three.js only loads when a scene is shown.
export const OverviewScene = lazy(() => import('./OverviewScene'));
export const ErrorField = lazy(() => import('./ErrorField'));
export const CorrelationScene = lazy(() => import('./CorrelationScene'));
export const RepairPipeline = lazy(() => import('./RepairPipeline'));
export const SystemMapGraph = lazy(() => import('./SystemMapGraph'));
export const Canvas3D = lazy(() => import('./Canvas3D').then((m) => ({ default: m.Canvas3D })));
