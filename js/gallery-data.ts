export type GalleryPhoto = {
  alt: string;
  caption: string;
  id: string;
  orientation: "portrait" | "landscape";
};

export const galleryPhotos = [
  { id: "1534528741775-53994a69daeb", alt: "Woman standing near a wall", caption: "Portrait, blue hour", orientation: "portrait" },
  { id: "1500530855697-b586d89ba3ee", alt: "Person outdoors in warm light", caption: "Somewhere outside", orientation: "landscape" },
  { id: "1529139574466-a303027c1d8b", alt: "Editorial fashion portrait", caption: "An afternoon in red", orientation: "portrait" },
  { id: "1501785888041-af3ef285b470", alt: "Mountain landscape", caption: "The long road", orientation: "landscape" },
  { id: "1504593811423-6dd665756598", alt: "Portrait of a man", caption: "Passing faces", orientation: "portrait" },
  { id: "1470770841072-f978cf4d019e", alt: "Lake and mountain cabin", caption: "Still water", orientation: "landscape" },
  { id: "1488426862026-3ee34a7d66df", alt: "Portrait in natural light", caption: "Window light", orientation: "portrait" },
  { id: "1490730141103-6cac27aaab94", alt: "Silhouette at sunset", caption: "Last light", orientation: "landscape" },
  { id: "1518173946687-a4c8892bbd9f", alt: "Portrait of a woman", caption: "A quiet morning", orientation: "portrait" },
  { id: "1500534623283-312aade485b7", alt: "Coastal landscape", caption: "Where the road ends", orientation: "landscape" },
  { id: "1524504388940-b1c1722653e1", alt: "Studio portrait", caption: "In the studio", orientation: "portrait" },
  { id: "1441974231531-c6227db76b6e", alt: "Forest in daylight", caption: "Into the trees", orientation: "landscape" },
  { id: "1517841905240-472988babdf9", alt: "Woman in soft daylight", caption: "Sunday light", orientation: "portrait" },
  { id: "1507003211169-0a1dd7228f2d", alt: "Portrait against a dark background", caption: "After dark", orientation: "portrait" },
  { id: "1531123897727-8f129e1688ce", alt: "Woman standing outside", caption: "Out for a walk", orientation: "portrait" },
  { id: "1492562080023-ab3db95bfbce", alt: "Man in a city street", caption: "City afternoon", orientation: "portrait" },
  { id: "1500648767791-00dcc994a43e", alt: "Portrait of a man outdoors", caption: "On the way", orientation: "portrait" },
  { id: "1529626455594-4ff0802cfb7e", alt: "Woman under warm light", caption: "Late afternoon", orientation: "portrait" },
  { id: "1521119989659-a83eee488004", alt: "Editorial portrait", caption: "A passing thought", orientation: "portrait" },
  { id: "1488161628813-04466f872be2", alt: "Portrait in a city", caption: "Around the corner", orientation: "portrait" },
  { id: "1520813792240-56fc4a3765a7", alt: "Person near a window", caption: "Waiting", orientation: "portrait" },
  { id: "1460661419201-fd4cecdf8a8b", alt: "Artist at work", caption: "Making things", orientation: "landscape" },
  { id: "1500534314209-a25ddb2bd429", alt: "Open desert landscape", caption: "A long way out", orientation: "landscape" },
  { id: "1443632864897-14973fa006cf", alt: "Clouds over a mountain", caption: "Weather coming in", orientation: "landscape" },
  { id: "1470246973918-29a93221c455", alt: "Road through a valley", caption: "Keep going", orientation: "landscape" },
  { id: "1433086966358-54859d0ed716", alt: "Mountain lake", caption: "Cold water", orientation: "landscape" },
  { id: "1470252649378-9c29740c9fa8", alt: "Green hills under clouds", caption: "After the rain", orientation: "landscape" },
] satisfies GalleryPhoto[];
