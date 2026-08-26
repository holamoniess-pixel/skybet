export type HeroAssetSlot = {
  id: string;
  label: string;
  recommendedAspectRatio: "16:9";
  textSafeArea: "left-third";
  status: "awaiting-approved-asset";
};

/**
 * The ten distinct assets required for the homepage rotation. Each slot is
 * intentionally source-free until brand-approved artwork is supplied.
 */
export const HERO_ASSET_MANIFEST: HeroAssetSlot[] = [
  "stadium-night", "tunnel-arrival", "floodlit-pitch", "goal-net-detail", "crowd-lightscape",
  "match-ball", "training-ground", "city-stadium", "court-action", "trophy-room",
].map((id, index) => ({
  id,
  label: `Hero scene ${index + 1}`,
  recommendedAspectRatio: "16:9",
  textSafeArea: "left-third",
  status: "awaiting-approved-asset",
}));
