# Observation stills

The camera strip uses four distinct bundled scenes: wetland perimeter, north paddock, service access and coastal lookout. These are illustrations with simulated display effects, not video or live feeds. Mapping and captions are centralized in lib/camera-stills.ts.

The two additional scenes were generated with the built-in image-generation tool for this project:

- Service access: misty research outpost and access gate with a Triceratops; wide photoreal composition in desaturated olive and charcoal, without baked-in text or HUD.
- Coastal lookout: coastal monitoring pier and lagoon with a perched Pteranodon; matching wide photoreal palette, without text or HUD.

Original PNGs are retained as public/service-access.png and public/coastal-lookout.png (1672×941). The app serves WebP encodings at quality85, approximately202KB and177KB respectively, with no crop or content edits. The original wetland.png and paddock.png remain unchanged; the app now serves quality85 WebP encodings (156102 and152110 bytes) instead of the original4485486 combined PNG bytes. Camera selection waits for decoding before switching the scene and caption.
