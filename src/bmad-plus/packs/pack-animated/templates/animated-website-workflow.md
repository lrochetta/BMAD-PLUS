---
description: Create a luxury animated website from an MP4 video
---

# Animated Website from Video

Converts an MP4 video into a luxury scroll-driven animated website with canvas frame-by-frame animation.

## Pre-requisites

1. FFmpeg installed, with the `libwebp` encoder (`winget install FFmpeg` on Windows, `brew install ffmpeg` on Mac; `ffmpeg -hide_banner -encoders` must list `libwebp`)
2. Python 3 installed (only for the local preview in step 6; any static file server works)
3. Source MP4 video file

This pack ships no extraction script: the frames are extracted with the FFmpeg commands of step 3.

## Steps

1. Ask the user for:
   - Path to the MP4 video file
   - Website concept (product, real estate, portfolio, etc.)
   - Optional: brand colors, section content, target frame count
   - How fonts are loaded in the generated site (see step 5)

2. Analyze the video:
```bash
ffprobe -v quiet -print_format json -show_format -show_streams "VIDEO_PATH"
```

3. Extract the frames with FFmpeg. `DURATION` is the video length in seconds from step 2; create the two output folders first (`mkdir -p OUTPUT_DIR/frames/desktop OUTPUT_DIR/frames/mobile`):
```bash
ffmpeg -i "VIDEO_PATH" -vf "fps=FRAME_COUNT/DURATION,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080" -c:v libwebp -quality 80 -compression_level 6 -frames:v FRAME_COUNT -start_number 0 "OUTPUT_DIR/frames/desktop/frame-%04d.webp"
ffmpeg -i "VIDEO_PATH" -vf "fps=FRAME_COUNT/DURATION,scale=960:540:force_original_aspect_ratio=increase,crop=960:540" -c:v libwebp -quality 80 -compression_level 6 -frames:v FRAME_COUNT -start_number 0 "OUTPUT_DIR/frames/mobile/frame-%04d.webp"
```
Then write `OUTPUT_DIR/frames/manifest.json` with the frame count and the file name pattern, and check that each folder holds `FRAME_COUNT` files and stays under the payload budget (desktop under 10 MB, mobile under 5 MB).

4. Generate the complete index.html following the design system in `animated-website-agent.md` (the agent file of this pack):
   - Canvas frame-by-frame scroll animation
   - Scroll dwell engine with Gaussian density
   - 6 overlay sections (Hero, Vision, Details, Grid, Context, CTA)
   - Ambient effects (particles, film grain, vignette, tint)
   - Glass morphism cards and letter-split animations
   - Custom cursor, chapter markers, branded loader
   - Gallery with parallax

5. Fonts. Use system fonts by default. Self-hosted `.woff2` files are the alternative that sends nothing to a third party. Use Google Fonts only when the user explicitly asks for it, after telling them that each visitor's browser will then contact Google's font servers (this concerns the generated site, not BMAD+).

6. Serve and preview:
```bash
cd OUTPUT_DIR
python3 -m http.server 8080
```

7. Iterate based on user feedback (scroll speed, colors, content, etc.)

## Reference

See `animated-website-agent.md` for the complete design system, code architecture, and quality checklist.
