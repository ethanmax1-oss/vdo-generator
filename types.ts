export interface PlayerProfile {
  id: string;
  name: string;
  team: string;
  visual_tokens: string;
}

export interface NewsCandidate {
  id: string;
  title: string;
  date: string;
  competition: string;
  opponent: string;
  scoreline: string;
  minute: string;
  goal_type: string; // Header, penalty, etc.
  kit_colors: { shirt: string; shorts: string; socks: string };
  action_description: string;
  sources: { title: string; url: string }[];
}

export interface NewsResolutionResult {
  needs_disambiguation: boolean;
  candidates?: NewsCandidate[];
  selected_event?: EventFactSheet; // If no disambiguation needed
}

export interface EventFactSheet {
  title: string;
  specific_action_moment: string;
  match_context: string;
  kit_colors: { shirt: string; shorts: string; socks: string };
  what_happened: string;
  sources: { title: string; url: string }[];
}

export interface KitSpec {
  shirt: string;
  shorts: string;
  socks: string;
  accent: string;
  number_style: string;
}

export interface CharacterBible {
  character_id: string;
  anchor_images: {
    id: string;
    base64Data: string;
    mimeType: string;
    label: string;
  }[];
  face_lock: string[]; // Bullet points: "Sharp jaw", "Long neck"
  motion_bible: string[]; // "Siuu celebration", "Angry shrug"
  style_lock: string;
  negative_prompt: string;
}

export interface StoryboardSegment {
  clip_id: string;
  purpose: 'hook' | 'setup' | 'action' | 'replay' | 'punchline';
  seconds: number;
  camera_angle: 'Close-up' | 'Medium Shot' | 'Wide Shot' | 'Low Angle' | 'Bird Eye';
  camera_movement: 'Static' | 'Pan' | 'Zoom In' | 'Tracking' | 'Shake';
  keyframe_prompt: string;
  video_prompt: string;
  overlay_text: string;
  continuity_notes: string;
}

export interface VeoSettings {
  resolution: "720p";
  aspectRatio: "9:16"; // Strict 9:16
}

export interface ComplianceReport {
  no_real_names_in_public_output: boolean;
  parody_included: boolean;
  safe_to_post: boolean;
  notes: string;
}

export interface TrollPlan {
  event_fact_sheet: EventFactSheet;
  character_bible: CharacterBible;
  kit_spec: KitSpec;
  storyboard: StoryboardSegment[]; // Exactly 5 clips
  render_config: VeoSettings;
  compliance_report: ComplianceReport;
}

// Helper for the App state to track progress of each clip
export interface ProductionAsset {
  clipIndex: number;
  label: string;
  status: 'pending' | 'generating_image' | 'generating_video' | 'completed' | 'failed';
  imageUrl?: string;
  videoUrl?: string;
  error?: string;
  retryCount?: number;
}

export interface UploadedImage {
  id: string;
  url: string;
  base64Data: string;
  mimeType: string;
  name: string;
}