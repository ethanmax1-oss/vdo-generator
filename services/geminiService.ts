import { GoogleGenAI, Type, VideoGenerationReferenceImage, VideoGenerationReferenceType } from "@google/genai";
import { PlayerProfile, TrollPlan, ProductionAsset, UploadedImage, NewsResolutionResult, EventFactSheet, NewsCandidate } from "../types";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// --- Helpers for Rate Limiting & Validation ---

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryOn429<T>(fn: () => Promise<T>, retries = 3, initialDelay = 10000): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    const msg = e.message || JSON.stringify(e);
    if (retries > 0 && (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED"))) {
      console.warn(`Quota hit (429). Retrying in ${initialDelay/1000}s...`);
      await wait(initialDelay);
      // Exponential backoff: 10s -> 30s -> 60s
      const nextDelay = initialDelay === 10000 ? 30000 : 60000;
      return retryOn429(fn, retries - 1, nextDelay);
    }
    throw e;
  }
}

// Browser-side validation for 9:16 aspect ratio (Images)
const validateImageAspectRatio = (base64Data: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      // 9:16 is 0.5625.
      const target = 9 / 16;
      const isValid = Math.abs(ratio - target) < 0.05; // Allow slight variance
      resolve(isValid);
    };
    img.onerror = () => resolve(false);
    img.src = `data:image/png;base64,${base64Data}`; // Mimetype guess for validation
  });
};

// Browser-side validation for 9:16 aspect ratio (Videos)
const validateVideoAspectRatio = (blob: Blob): Promise<boolean> => {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            const ratio = video.videoWidth / video.videoHeight;
            // 9:16 is 0.5625. Allow small tolerance (0.02).
            const target = 9 / 16;
            const isValid = Math.abs(ratio - target) < 0.02;
            if (!isValid) console.warn(`Video validation failed: ${video.videoWidth}x${video.videoHeight} (${ratio})`);
            resolve(isValid);
        };
        video.onerror = () => resolve(false); // Fail safe
        video.src = window.URL.createObjectURL(blob);
    });
};

// --- FFmpeg Stitching ---

export const stitchVideoClips = async (videoUrls: string[]): Promise<string> => {
    console.log("Starting stitch for", videoUrls.length, "clips");
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    
    // Load ffmpeg with core from CDN
    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    const inputNames: string[] = [];
    
    // Write individual files to memory
    for (let i = 0; i < videoUrls.length; i++) {
        const name = `clip${i}.mp4`;
        inputNames.push(name);
        await ffmpeg.writeFile(name, await fetchFile(videoUrls[i]));
    }

    // Create list.txt for concat demuxer
    // Format: file 'clip0.mp4'
    const listContent = inputNames.map(n => `file '${n}'`).join('\n');
    await ffmpeg.writeFile('list.txt', listContent);

    // Run concat command
    // -safe 0: allow reading filenames
    // -c copy: stream copy (super fast, no re-encoding quality loss)
    await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', 'final.mp4']);

    // Read result
    const data = await ffmpeg.readFile('final.mp4');
    const blob = new Blob([data], { type: 'video/mp4' });
    return URL.createObjectURL(blob);
};

// --- 1. News Resolver ---

const RESOLVER_SYSTEM_PROMPT = `
You are the News Resolver for the Football Troll AI.
Your job is to find SPECIFIC match details to ground a parody video.

Rules:
1. Use Google Search to find recent matches involving the player.
2. Return exactly 3 candidates.
3. You MUST extract kit colors (Shirt/Shorts/Socks) for the specific match date.
4. "action_description" must be vivid: "Towering header in 89th minute" or "Missed penalty sent into orbit".
`;

export const resolveNewsContext = async (
  player: PlayerProfile,
  query: string
): Promise<NewsResolutionResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await retryOn429(() => ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [{ text: `Player: ${player.name}\nUser Query: ${query}\nFind recent matches, kit colors, and specific dramatic moments.` }],
    },
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction: RESOLVER_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          needs_disambiguation: { type: Type.BOOLEAN },
          candidates: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                date: { type: Type.STRING },
                competition: { type: Type.STRING },
                opponent: { type: Type.STRING },
                scoreline: { type: Type.STRING },
                minute: { type: Type.STRING },
                goal_type: { type: Type.STRING },
                kit_colors: { 
                    type: Type.OBJECT, 
                    properties: { shirt: { type: Type.STRING }, shorts: { type: Type.STRING }, socks: { type: Type.STRING } }
                },
                action_description: { type: Type.STRING },
                sources: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: {type: Type.STRING}, url: {type: Type.STRING} } } }
              }
            }
          }
        }
      }
    }
  }));

  const text = response.text || "{}";
  return JSON.parse(text) as NewsResolutionResult;
};

// --- 2. Story Planner ---

const PLANNER_SYSTEM_PROMPT = `
You are the "Football Troll AI" (Veo 3.1 Pro Cartoon Pipeline).
Objective: Generate a 5-clip parody cartoon storyboard (Strict 9:16 Vertical).

**VISUAL STYLE LOCK:**
- 2D hand-drawn cartoon, thick clean black outlines, flat shading, bold colors. 
- NO photorealism, NO 3D, NO blurred backgrounds.
- Caricature style: Exaggerated features (neck, jaw, teeth) based on the Character Bible.

**STRUCTURE:**
1. Hook (0-3s): High energy, establishes context.
2. Setup (3-6s): Tension building.
3. Action (6-9s): The specific moment (Goal/Miss/Fall).
4. Replay (9-12s): Exaggerated slow-mo or reaction.
5. Punchline (12-15s): The joke/troll conclusion.

**KIT RULES:**
- Use the provided kit_colors from the event.
- NO official logos (Nike/Adidas). Use generic stripes/shapes.

**OUTPUT SCHEMA:**
Return JSON with strictly 5 clips.
`;

export const createStoryPlan = async (
  player: PlayerProfile,
  eventContext: EventFactSheet,
  anchorImages: UploadedImage[]
): Promise<TrollPlan> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Prepare input payload
  const inputPayload = {
    target_player: player.name,
    verified_event: eventContext,
    style_guide: "Thick outlines, flat shading, 2D cartoon.",
    has_anchors: anchorImages.length > 0
  };

  const textPart = { text: JSON.stringify(inputPayload) };
  // We don't necessarily need to send images to the *Planner* (text model), 
  // but sending them helps it describe the visual_tokens accurately.
  const imageParts = anchorImages.map(img => ({
    inlineData: { mimeType: img.mimeType, data: img.base64Data }
  }));

  const response = await retryOn429(() => ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [textPart, ...imageParts] },
    config: {
      systemInstruction: PLANNER_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["event_fact_sheet", "character_bible", "kit_spec", "storyboard", "render_config", "compliance_report"],
        properties: {
          event_fact_sheet: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                specific_action_moment: { type: Type.STRING },
                match_context: { type: Type.STRING },
                what_happened: { type: Type.STRING },
                kit_colors: { type: Type.OBJECT, properties: { shirt: { type: Type.STRING }, shorts: { type: Type.STRING }, socks: { type: Type.STRING } } },
                sources: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: {type: Type.STRING}, url: {type: Type.STRING} } } }
              }
          },
          character_bible: {
            type: Type.OBJECT,
            properties: {
              character_id: { type: Type.STRING },
              // Note: Anchors are handled client-side but we define the slot here
              anchor_images: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: {type: Type.STRING}, base64Data: {type: Type.STRING}, mimeType: {type: Type.STRING}, label: {type: Type.STRING} } } },
              face_lock: { type: Type.ARRAY, items: { type: Type.STRING } },
              motion_bible: { type: Type.ARRAY, items: { type: Type.STRING } },
              style_lock: { type: Type.STRING },
              negative_prompt: { type: Type.STRING }
            }
          },
          kit_spec: {
            type: Type.OBJECT,
            properties: { shirt: { type: Type.STRING }, shorts: { type: Type.STRING }, socks: { type: Type.STRING }, accent: { type: Type.STRING }, number_style: { type: Type.STRING } }
          },
          storyboard: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                clip_id: { type: Type.STRING },
                purpose: { type: Type.STRING, enum: ['hook', 'setup', 'action', 'replay', 'punchline'] },
                seconds: { type: Type.NUMBER },
                camera_angle: { type: Type.STRING },
                camera_movement: { type: Type.STRING },
                keyframe_prompt: { type: Type.STRING },
                video_prompt: { type: Type.STRING },
                overlay_text: { type: Type.STRING },
                continuity_notes: { type: Type.STRING }
              }
            }
          },
          render_config: {
            type: Type.OBJECT,
            properties: { resolution: { type: Type.STRING }, aspectRatio: { type: Type.STRING } }
          },
          compliance_report: {
            type: Type.OBJECT,
            properties: { no_real_names_in_public_output: { type: Type.BOOLEAN }, parody_included: { type: Type.BOOLEAN }, safe_to_post: { type: Type.BOOLEAN }, notes: { type: Type.STRING } }
          }
        }
      }
    }
  }));

  const plan = JSON.parse(response.text || "{}") as TrollPlan;
  
  // Inject the raw anchor data into the bible so it travels with the plan
  plan.character_bible.anchor_images = anchorImages.map(img => ({
      id: img.id,
      base64Data: img.base64Data,
      mimeType: img.mimeType,
      label: img.name
  }));
  
  // Force 9:16
  plan.render_config.aspectRatio = "9:16";

  return plan;
};

// --- 3. Production Pipeline ---

async function generateKeyframeImage(
    ai: GoogleGenAI,
    prompt: string,
    bible: { anchor_images: { base64Data: string; mimeType: string }[] }
  ): Promise<{ data: string; mimeType: string }> {
    
    // Construct payload with Anchor Images for conditioning
    const parts: any[] = [{ text: prompt }];
    
    // Add anchors to parts (conditioning)
    if (bible.anchor_images && bible.anchor_images.length > 0) {
        bible.anchor_images.forEach(img => {
            parts.push({
                inlineData: { mimeType: img.mimeType, data: img.base64Data }
            });
        });
        parts[0].text = `(REFERENCE IMAGES PROVIDED: COPY CHARACTER STYLE EXACTLY)\n${prompt}`;
    }

    // Retry logic specifically for image generation
    const response = await retryOn429(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: parts },
      config: { imageConfig: { aspectRatio: "9:16" } } // Force 9:16
    }));
  
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return {
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/jpeg'
        };
      }
    }
    throw new Error("No image data generated from keyframe step.");
}

async function generateClipVideo(
    ai: GoogleGenAI,
    prompt: string,
    imageAsset: { data: string; mimeType: string },
    bible: { anchor_images: { base64Data: string; mimeType: string }[] },
    clipLabel: string
): Promise<string> {
    
    let attempts = 0;
    const MAX_ATTEMPTS = 2;

    while (attempts < MAX_ATTEMPTS) {
        attempts++;
        try {
            // Prepare Reference Images for Veo
            // Veo 3.1 supports referenceImages in config
            const refImages: VideoGenerationReferenceImage[] = bible.anchor_images.slice(0, 3).map(img => ({
                image: { imageBytes: img.base64Data, mimeType: img.mimeType },
                referenceType: VideoGenerationReferenceType.ASSET
            }));

            // Attempt with Reference Images (Preferred)
            let useReferenceImages = refImages.length > 0;
            
            // Inner Retry for API Call
            let operation = await retryOn429(async () => {
                try {
                     return await ai.models.generateVideos({
                        model: 'veo-3.1-generate-preview', // Or veo-3.1-generate-preview if available
                        prompt: prompt,
                        image: { imageBytes: imageAsset.data, mimeType: imageAsset.mimeType },
                        config: { 
                            numberOfVideos: 1, 
                            resolution: '720p', 
                            aspectRatio: '9:16', // Strict 9:16
                            // Only include reference images if we have them and it's the first attempt type
                            referenceImages: useReferenceImages ? refImages : undefined
                        }
                    });
                } catch (e: any) {
                    // Fallback: If Veo rejects referenceImages (feature flagging), try without
                    if (useReferenceImages) {
                        console.warn("Veo rejected referenceImages, falling back to keyframe-only.");
                        useReferenceImages = false;
                        return await ai.models.generateVideos({
                            model: 'veo-3.1-generate-preview',
                            prompt: prompt,
                            image: { imageBytes: imageAsset.data, mimeType: imageAsset.mimeType },
                            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '9:16' }
                        });
                    }
                    throw e;
                }
            }, 3, 20000); // 20s initial wait for Veo 429s

            // Poll
            const TIMEOUT_MS = 8 * 60 * 1000;
            const startTime = Date.now();
            while (!operation.done) {
                if (Date.now() - startTime > TIMEOUT_MS) throw new Error("Video generation timed out");
                await new Promise(resolve => setTimeout(resolve, 8000));
                operation = await retryOn429(() => ai.operations.getVideosOperation({ operation }), 3, 5000);
            }

            if (operation.error) throw new Error(String(operation.error.message));
            const result = operation.response || (operation as any).result;
            const uri = result?.generatedVideos?.[0]?.video?.uri;
            if (!uri) throw new Error("No video URI returned.");

            const downloadUrl = `${uri}&key=${process.env.API_KEY}`;
            const videoResponse = await fetch(downloadUrl);
            if (!videoResponse.ok) throw new Error("Failed to download video bytes");
            
            const blob = await videoResponse.blob();

            // Validate Dimensions (Strict 9:16)
            const isValid = await validateVideoAspectRatio(blob);
            if (!isValid) {
                if (attempts < MAX_ATTEMPTS) {
                    console.log(`Clip ${clipLabel} failed 9:16 check. Retrying...`);
                    continue; // Retry loop
                } else {
                    throw new Error("Generated video failed 9:16 aspect ratio validation after retries.");
                }
            }

            return URL.createObjectURL(blob);

        } catch (e) {
            if (attempts >= MAX_ATTEMPTS) throw e;
            console.warn(`Attempt ${attempts} failed for ${clipLabel}:`, e);
            await wait(2000);
        }
    }
    throw new Error("Generation failed.");
}

export const executeProductionPipeline = async (
  plan: TrollPlan,
  onAssetUpdate: (asset: ProductionAsset) => void
): Promise<string[]> => {
    const aistudio = (window as any).aistudio;
    if (aistudio && aistudio.hasSelectedApiKey) {
        const hasKey = await aistudio.hasSelectedApiKey();
        if (!hasKey) await aistudio.openSelectKey();
    }
  
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const bible = plan.character_bible;
    const kit = plan.kit_spec;
    
    // Store collected URLs in order
    const collectedVideoUrls: string[] = new Array(plan.storyboard.length).fill('');

    // Strict Style Prompt
    const styleString = `STYLE: ${bible.style_lock}. FACE: ${bible.face_lock.join(", ")}. KIT: ${kit.shirt} shirt, ${kit.shorts} shorts, ${kit.socks} socks.`;

    for (let i = 0; i < plan.storyboard.length; i++) {
        const clip = plan.storyboard[i];
        const label = clip.purpose.toUpperCase();
        
        // Cooldown between clips to avoid hammering Veo/Flash
        if (i > 0) await wait(3000); 

        onAssetUpdate({ clipIndex: i, label, status: 'generating_image' });

        try {
            // 1. Image (Keyframe)
            const imgPrompt = `Full 9:16 Frame. ${clip.camera_angle}, ${clip.camera_movement}. ${styleString}. ACTION: ${clip.keyframe_prompt}. ${bible.negative_prompt}`;
            const imageAsset = await generateKeyframeImage(ai, imgPrompt, bible);
            
            // Validate Image Aspect Ratio locally
            const isImageRatioValid = await validateImageAspectRatio(imageAsset.data);
            if (!isImageRatioValid) {
                 // Simple one-time retry if the model ignored the aspect ratio
                 console.warn("Image ratio mismatch. Retrying keyframe...");
                 const retryAsset = await generateKeyframeImage(ai, imgPrompt + " (MUST BE VERTICAL 9:16 ASPECT RATIO)", bible);
                 imageAsset.data = retryAsset.data;
                 imageAsset.mimeType = retryAsset.mimeType;
            }

            const imageUrl = `data:${imageAsset.mimeType};base64,${imageAsset.data}`;
            onAssetUpdate({ clipIndex: i, label, status: 'generating_video', imageUrl });

            // 2. Video (Veo)
            const videoPrompt = `Cartoon Animation. ${clip.camera_movement}. ${styleString}. ACTION: ${clip.video_prompt}`;
            const videoUrl = await generateClipVideo(ai, videoPrompt, imageAsset, bible, label);
            
            collectedVideoUrls[i] = videoUrl;
            onAssetUpdate({ clipIndex: i, label, status: 'completed', imageUrl, videoUrl });

        } catch (err: any) {
            console.error(`Clip ${i} Failed:`, err);
            onAssetUpdate({ clipIndex: i, label, status: 'failed', error: err.message });
            break; 
        }
    }
    
    // Filter out empties if pipeline broke
    return collectedVideoUrls.filter(u => u !== '');
};