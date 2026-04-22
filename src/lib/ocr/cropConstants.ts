/**
 * Single source of truth for the card-name crop region.
 * Both the image processor and the viewfinder guide box read from here.
 *
 * All values are fractions of the video frame's native dimensions.
 */
export const CROP = {
  marginX: 0.05,      // 5% clipped from each side
  top: 0.015,         // start 1.5% from the top (skip card border)
  height: 0.11,       // name bar is ~11% tall
} as const;
