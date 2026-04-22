/**
 * Single source of truth for the card-name crop region.
 * Both the image processor and the viewfinder guide box read from here.
 *
 * All values are fractions of the video frame's native dimensions.
 */
export const CROP = {
  marginX: 0.02, // 2% clipped from each side
  top: 0.105, // start ~10.5% from the top
  height: 0.18, // wider scan band to capture name even if card isn't perfectly aligned
} as const
