/**
 * Shared geometry utilities for both WebGL and WebGPU renderers
 */

import { VisibleFace } from '../bspTraversal.js';

// Re-export existing utilities
export { extractFrustumPlanes } from '../culling.js';
export { gatherVisibleFaces, findLeafForPoint, isClusterVisible } from '../bspTraversal.js';

/**
 * Sort visible faces front-to-back for optimal depth testing
 * (render nearest objects first to maximize early-z rejection)
 */
export function sortFrontToBack(faces: readonly VisibleFace[]): VisibleFace[] {
  return [...faces].sort((a, b) => b.sortKey - a.sortKey);
}

/**
 * Sort visible faces back-to-front for correct alpha blending
 * (render farthest objects first so transparency composites correctly)
 */
export function sortBackToFront(faces: readonly VisibleFace[]): VisibleFace[] {
  return [...faces].sort((a, b) => a.sortKey - b.sortKey);
}
