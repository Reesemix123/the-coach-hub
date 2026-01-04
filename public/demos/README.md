# Demo Assets for Homepage Feature Modals

This folder contains demo videos and images displayed in the homepage feature modals.

## Required Assets

Each feature needs the following assets (video preferred, image as fallback):

| Feature | Video Files | Fallback Image |
|---------|------------|----------------|
| Digital Playbook | `digital-playbook.mp4`, `digital-playbook.webm` | `digital-playbook.png` |
| Pro-Level Analytics | `pro-analytics.mp4`, `pro-analytics.webm` | `pro-analytics.png` |
| AI Film Tagging | `ai-film-tagging.mp4`, `ai-film-tagging.webm` | `ai-film-tagging.png` |
| Game-Day Preparation | `game-day-prep.mp4`, `game-day-prep.webm` | `game-day-prep.png` |

## Recommended Video Export Settings

### Format
- **Primary**: MP4 (H.264) - widest browser support
- **Alternative**: WebM (VP9) - smaller file size, good quality

### Dimensions
- **Resolution**: 1280x720 (720p) recommended
- **Aspect Ratio**: 16:9 (matches the modal player)

### Duration
- **Target**: 10-40 seconds per video
- **Maximum**: 60 seconds (keep it focused)

### Compression Settings

**FFmpeg (recommended for MP4):**
```bash
ffmpeg -i input.mov -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k -movflags +faststart digital-playbook.mp4
```

**FFmpeg (for WebM):**
```bash
ffmpeg -i input.mov -c:v libvpx-vp9 -crf 30 -b:v 0 -c:a libopus -b:a 128k digital-playbook.webm
```

**Handbrake preset:**
- Preset: Fast 720p30
- Video Codec: H.264 (x264)
- Quality: RF 22-24
- Audio: AAC, 128kbps

### File Size Guidelines
- Target: < 5MB per video for fast loading
- Maximum: 10MB (will impact mobile load times)

## Creating Demo Videos with Playwright

You can capture real UI interactions using Playwright:

```typescript
// scripts/capture-demo.ts
import { chromium } from '@playwright/test';

async function captureDemo() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    recordVideo: { dir: './public/demos/', size: { width: 1280, height: 720 } }
  });

  const page = await context.newPage();

  // Navigate and perform actions
  await page.goto('http://localhost:3000/teams/demo-team-id/playbook');
  await page.waitForTimeout(1000);

  // Perform demo actions...
  await page.click('[data-testid="create-play-button"]');
  await page.waitForTimeout(2000);

  // Close and save
  await context.close();
  await browser.close();
}

captureDemo();
```

## Fallback Image Guidelines

If video isn't available, the system falls back to static images:

- **Format**: PNG or JPEG
- **Dimensions**: 1280x720 (same as video)
- **Content**: Key screenshot showing the feature's main value

## Graceful Degradation

The modal handles missing assets gracefully:
1. If video exists → plays autoplay, muted, looped video
2. If video fails → shows fallback image
3. If both missing → shows placeholder with "Demo video coming soon"

## Testing Locally

1. Add your demo files to this folder
2. Run the dev server: `npm run dev`
3. Click a feature card on the homepage
4. Verify video loads and plays smoothly

## Performance Notes

- Videos use `preload="metadata"` to avoid loading until modal opens
- Lazy loading ensures videos don't impact initial page load
- WebM provides ~30% smaller files than MP4 with similar quality
