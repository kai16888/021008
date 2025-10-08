export enum Screen {
  Selection = 'selection',
  Creation = 'creation',
  Loading = 'loading',
  Result = 'result',
}

export enum Mode {
  AddBackground = 'add-background',
  Inpainting = 'inpainting',
}

export interface Suggestion {
  prompt: string;
  focus: string;
  lighting: string;
}

export interface AnalysisResult {
  usage_scenario: Suggestion;
  result_display: Suggestion;
  still_life: Suggestion;
}

export interface InpaintingInstruction {
  [color: string]: string;
}

export interface AppState {
  screen: Screen;
  mode: Mode | null;
  uploadedImage: string | null;
  optimizedImage: string | null;
  generatedImages: string[];
  lastUserPrompt: string;
  lastNegativePrompt: string;
  inpaintingBaseImage: string | null;
  error: string | null;
  loadingMessage: string;
  loadingSubtext: string;
}
