---
description: Create a luxury animated website from an MP4 video
---

# Animated Website from Video

Converts an MP4 video into a luxury scroll-driven animated website with canvas frame-by-frame animation.

## Pre-requisites

1. FFmpeg installed (`winget install FFmpeg` on Windows, `brew install ffmpeg` on Mac)
2. Python 3 installed
3. Source MP4 video file

## Steps

1. Ask the user for:
   - Path to the MP4 video file
   - Website concept (product, real estate, portfolio, etc.)
   - Optional: brand colors, section content, target frame count

2. Analyze the video:
```bash
ffprobe -v quiet -print_format json -show_format -show_streams "VIDEO_PATH"
```

3. Extract frames using the script:
```bash
python3 scripts/extract_frames.py \
  --input "VIDEO_PATH" \
  --output "OUTPUT_DIR/frames" \
  --frames FRAME_COUNT \
  --quality 80
```

4. Generate the complete index.html following the design system in `agent/animated-website-agent.md`:
   - Canvas frame-by-frame scroll animation
   - Scroll dwell engine with Gaussian density
   - 6 overlay sections (Hero, Vision, Details, Grid, Context, CTA)
   - Ambient effects (particles, film grain, vignette, tint)
   - Glass morphism cards and letter-split animations
   - Custom cursor, chapter markers, branded loader
   - Gallery with parallax

5. Serve and preview:
```bash
cd OUTPUT_DIR
python3 -m http.server 8080
```

6. Iterate based on user feedback (scroll speed, colors, content, etc.)

## Reference

See `agent/animated-website-agent.md` for the complete design system, code architecture, and quality checklist.
