import { AnalysisResult } from '../types';
import { GoogleGenAI, Type, Modality } from '@google/genai';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export const analyzeImageForScenes = async (base64ImageData: string, subjectDetails: string): Promise<AnalysisResult> => {
  const pureBase64 = base64ImageData.split(',')[1];
  const analysisPrompt = `作為一名AI攝影與場景設計專家，請分析以下提供的「主體」圖片與其屬性。
「主體」屬性："""
${subjectDetails}
"""
您的任務是，以繁體中文，為此「主體」生成三種固定主軸的商業攝影背景建議：「使用情境」、「成果展示」、「靜物擺放」。每種建議都必須包含「指令」、「視覺焦點」與「光線提醒」。

**最高指導原則(1)：場景佈局策略 (Scene Layout Strategy) - 絕對尺寸錨定**
在構思任何場景時，您必須**優先處理尺寸和比例問題**，這是本次生成的首要目標。

- **尺寸與比例強制執行（零容忍規則）**：您必須從上方提供的「主體」屬性中，識別出具體的尺寸描述 (例如: 長度 25 公分)。這是最重要的指令。然後，您**必須**在場景中引入一個**視覺上可識別且尺寸與「主體」具有明確比例關係的參照物**。 **關鍵規則：此參照物必須與「主體」的傳說或功能有直接關聯性。** 例如，如果主體是「用於切結婚紀念日的蛋糕」的蛋糕刀，那麼合適的參照物是「一個香檳杯」或「一塊蛋糕」，**絕對不能**是無關的「智慧型手機」或「書本」。您必須將這種關聯性與相對大小關係在指令中被精確描述出來。
- **常識與物理定律審查**：任何描述都必須符合基本物理邏輯，不得出現尺寸較小的物體承載尺寸遠大於自身的物體等違背常識的情況。使用相對比較詞（例如：兩倍大、三分之一寬）來取代純粹的數字羅列。

**最高指導原則(2)：「主體」傳說/關聯性強制注入**
將「主體」屬性中提供的傳說或任何功能/歷史背景，作為該場景中不可或缺的敘事核心。這條規則的優先級高於一切美學考量。

**關鍵規則：**
1. **指令(prompt)**：必須包含**「主體」尺寸的相對描述**、背景細節、光線和整體氛圍，不需指定拍攝視角。
2. **視覺焦點(focus)**：說明該場景希望引導觀眾注意的重點。
3. **光線提醒(lighting)**：提供具體的光線設定建議，以增強真實感。
4. **場景設計**：場景地點應具備邏輯性，不應強加無關的地理位置。
5. **人物**：若場景中需包含人物，一律預設為台灣人。
6. **物件限制**：除了「主體」和必要的、與傳說/功能直接相關的參照物外，嚴格禁止在「指令」中添加任何不相關的物件。`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [ { text: analysisPrompt }, { inlineData: { mimeType: "image/jpeg", data: pureBase64 } }] },
    config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                usage_scenario: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING }, focus: { type: Type.STRING }, lighting: { type: Type.STRING } } },
                result_display: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING }, focus: { type: Type.STRING }, lighting: { type: Type.STRING } } },
                still_life: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING }, focus: { type: Type.STRING }, lighting: { type: Type.STRING } } }
            }
        }
    }
  });
  
  const textResponse = response.text;
  try {
    return JSON.parse(textResponse);
  } catch(e) {
    throw new Error("AI returned non-JSON response for analysis.");
  }
};

export const enhancePrompt = async (originalPrompt: string): Promise<string> => {
    const systemInstruction = `你是一位詠唱專家，專門微調魔導指令(prompt)。你的任務是接收一個舊的指令，並在不改變其核心主體與意圖的前提下，**只做一個微小的、巧妙的調整**。可以是增加一個小細節、稍微改變光線描述、或替換一個形容詞，目標是讓下一次的生成結果與前一次有些許不同，同時保持快速處理。直接返回微調後的新指令(純文字)，不要包含任何額外說明。語言：繁體中文。`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: originalPrompt,
        config: {
            systemInstruction
        }
    });
    return response.text.trim();
};

const generateSingleImage = async (inputBase64: string, prompt: string, negativePrompt: string): Promise<string> => {
    const cutout = await new Promise<HTMLImageElement>(resolve => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => resolve(i); i.src = inputBase64; });
    
    const W = 1024, H = 1024;
    const apiCanvas = document.createElement('canvas'); apiCanvas.width = W; apiCanvas.height = H;
    const actx = apiCanvas.getContext('2d');
    if (!actx) throw new Error("Could not get canvas context");

    const s = Math.min(W / cutout.naturalWidth, H / cutout.naturalHeight) * 0.9;
    const w = Math.round(cutout.naturalWidth * s), h = Math.round(cutout.naturalHeight * s);
    const x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2);
    actx.drawImage(cutout, x, y, w, h);
    
    const pureBase64 = apiCanvas.toDataURL('image/png').split(',')[1];
    const negativePromptSection = negativePrompt ? `\n【嚴格迴避】\n- ${negativePrompt}` : '';
    
    const generationPrompt = `您將收到一張主圖，其中主體的透明像素（alpha=0）代表可填補的背景，其非透明像素的邊界，等同於四條邊界貼片證據（上/下/左/右），您必須以此為基準進行擴繪，並符合使用者「${prompt}」的指令。\n\n【尺寸與比例（最高優先級）】\n這是一條零容忍的物理定律級規則。使用者指令中任何關於尺寸的描述（例如：長度25公分，直徑8cm）都**不是**建議，而是**必須嚴格、精確遵守的物理現實**。\n\n1. **識別所有錨點**：您必須首先掃描整個使用者指令，識別出**所有**被賦予具體尺寸的物體。例如，在「一個10公分高的探照燈旁邊有一個40公分長的工具箱」中，您有兩個錨點：探照燈(10cm)和工具箱(40cm)。\n\n2. **建立比例尺並強制執行**：您必須在內部建立一個視覺比例尺。根據上一個例子，工具箱的長度**必須**在視覺上呈現為探照灯高度的**四倍**。這種相對大小關係是**不可協商的**。如果因為透視關係導致比例失真，您必須調整構圖（例如，將較大的物體放在更前面）來維持視覺上的邏輯正確性。\n\n3. **執行相對擴繪**：當您擴繪場景中的其他物件時，它們的尺寸都**必須**與您建立的比例尺保持一致，確保整個場景的物理現實感。\n\n4. **最終強制審查**：在輸出最終圖像前，進行一次強制性的比例審查。問自己：「如果物體A是X公分，物體B是Y公分，我的畫面是否忠實地反映了它們的相對大小？」\n    * **重大失敗範例**：如果一個「10公分的探照燈」在擴繪後，看起來比放在它旁邊的「40公分的工具箱」還要大或長，那麼這次生成就是**徹底失敗**。您必須拋棄結果並從頭重新生成，直到比例完全正確為止。\n\n【空間佈局與透視控制（關鍵執行指令）】\n當使用者指令中包含兩個或多個尺寸完全相同的物體時，您的首要任務是確保它們在最終的 2D 圖像中「看起來」也完全一樣大。為了達成此目標，您必須嚴格遵守以下佈局原則：\n1.  **共面放置 (Co-planar Placement)**：您必須將這些尺寸相同的物體想像成放置在同一條無形的線上，並確保它們與虛擬相機的距離完全相等。\n2.  **抑制透視 (Perspective Suppression)**：絕對禁止為了營造「深度感」或「藝術效果」而將其中一個物體放置在另一個物體的前方。任何會導致透視收縮（perspective foreshortening）而改變其視覺大小的佈局都是不被允許的。\n3.  **優先級**：此「佈局鎖定」規則的優先級高於一般的構圖美學。即使犧牲一些畫面的自然感，也必須優先保證尺寸比較的準確性。這是一項技術性指令，而非藝術性建議。\n\n【品質要求（模擬高步數）】\n請將此次生成視為一次需要投入更多運算資源的高品質渲染。目標是達到攝影級的真實感、豐富的紋理細節、以及複雜且自然的光影效果。不接受任何模糊、塗抹感或細節不足的區域。\n\n【特效細節（範圍與強度控制）】\n如果使用者指令中要求了火花、煙霧、粉塵、木屑等粒子特效，您必須**嚴格控制其範圍與強度**。這些效果的範圍應該非常小，視覺強度應為點綴級別，絕不能干擾或遮擋主要物體。目標是產生**少量、精緻**的粒子效果，而非大規模、誇張的特效場景。\n\n【關鍵執行策略：邊緣採樣】\n您必須分析非透明區域邊緣的像素，採樣其顏色、紋理與光照方向，並將這些特徵自然地延伸到新的擴繪区域中。若生成結果與原圖產生「貼圖感」或「拼接感」，將被視為重大失敗。\n\n【禁止與失敗定義（零容忍）】\n- 禁止：將遮罩區生成為與邊界貼片語義無關的新場景（例如室內邊界卻生成戶外天空）。\n- 禁止：忽略邊界貼片的色彩/光向/紋理而憑文字自行創作。\n- 失敗條件（任一即判定失敗）：(a) 邊界 1–2px 內外平均亮度差或梯度差異異常增大；(b) 遮罩區的主色群與邊界貼片的主色群顯著偏離；(c) 遮罩區出現大面積單色或單純漸層。\n\n【自我檢查】\n請你在本次生成內做一次「自我質檢」，特別是檢查「尺寸與比例」、「品質要求」與「特效細節」是否符合要求。若不合格請內部重試最多 2 次。\n\n【輸出格式】\n您的輸出只能是圖片檔案 (Image file ONLY)。禁止輸出任何文字或確認訊息。\n${negativePromptSection}`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [ {text: generationPrompt}, { inlineData: { mimeType: "image/png", data: pureBase64 } } ] },
        config: {
            responseModalities: [Modality.IMAGE]
        }
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (!part || !('inlineData' in part)) {
        throw new Error(`API failed to generate a valid image. Reason: ${response.promptFeedback?.blockReason || 'Unknown'}`);
    }

    const gen = await new Promise<HTMLImageElement>(resolve => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => resolve(i); i.src = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`; });
    const finalJpgCanvas = document.createElement('canvas'); finalJpgCanvas.width = gen.naturalWidth; finalJpgCanvas.height = gen.naturalHeight;
    const jctx = finalJpgCanvas.getContext('2d');
    if (!jctx) throw new Error("Could not get final canvas context");
    jctx.fillStyle = '#ffffff'; jctx.fillRect(0, 0, finalJpgCanvas.width, finalJpgCanvas.height);
    jctx.drawImage(gen, 0, 0);
    return finalJpgCanvas.toDataURL('image/jpeg', 0.95);
}

export const generateImages = async (inputBase64: string, userPrompt: string, negativePrompt: string): Promise<string[]> => {
    const anglePrompts = [
        `生成第一個場景，確保此場景與其他三個不同，且使用**平視角**：${userPrompt}`, 
        `生成第二個場景，確保此場景與其他三個不同，且使用**高視角**：${userPrompt}`,
        `生成第三個場景，確保此場景與其他三個不同，且使用**鳥瞰視角**：${userPrompt}`, 
        `生成第四個場景，確保此場景與其他三個都不同，並由你判斷使用一個**最能突顯主體立體感與場景 atmospheres 的戲劇性視角**：${userPrompt}`
    ];
    
    const MAX_RETRIES = 2;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0) {
                const waitTime = Math.pow(2, attempt) * 1000;
                await sleep(waitTime);
            }
            const imageUrls = await Promise.all(anglePrompts.map(p => generateSingleImage(inputBase64, p, negativePrompt)));
            return imageUrls;
        } catch (error) {
            lastError = error as Error;
            console.error(`Attempt ${attempt + 1} failed:`, error);
        }
    }

    throw lastError || new Error("After multiple retries, the AI could not generate images.");
};


export const inpaintImage = async (inputBase64: string, maskBase64: string, subjectBase64: string | null, prompt: string, negativePrompt: string, subjectName: string): Promise<string> => {
    const inputPureBase64 = inputBase64.split(',')[1];
    const maskPureBase64 = maskBase64.split(',')[1];
    const subjectPureBase64 = subjectBase64 ? subjectBase64.split(',')[1] : null;
    const negativePromptSection = negativePrompt ? `\n【嚴格迴避】\n- ${negativePrompt}` : '';

    const generationPrompt = `這是一項高優先級的「主體注入」內繪任務。
【任務目標】
您的核心目標是將一個特定的「主體」物件，精確地繪製到使用者指定的區域內。

【輸入資料】
1.  **原始圖像 (背景)**: 這是背景。
2.  **遮罩圖像 (位置與大小)**: **白色區域**代表了「主體」應該被放置的**精確位置和縮放比例**。這個區域就是一個邊界框。
3.  **主體圖像 (要繪製的物件)**: 這是您必須繪製到場景中的具體物件。
4.  **使用者指令**: """${prompt}"""
5.  **「主體」身份**: 使用者指令中提到的「主體」，指的是一個「${subjectName || '指定的物件'}」，其視覺外觀由**主體圖像**決定。

【執行步驟 - 嚴格遵守】
1.  **識別主體**: 根據**主體圖像**，理解你要繪製的核心物件是什麼。
2.  **匹配遮罩**: **此為最高優先級規則。** 您必須將這個**主體圖像**的內容完整地繪製在**遮罩圖像**的白色區域內。白色區域的形狀、大小和位置定義了主體最終在畫面上的視覺大小和位置。如果使用者畫了一個大圈，主體就應該畫得大；如果畫了小圈，主體就應該畫得小。
3.  **無縫融合**: 在將「主體」繪製完成後，您的第二任務是確保其邊緣與周圍的背景（原始圖像的黑色遮罩區域）完美融合。這包括匹配光線方向、生成逼真的陰影、以及協調紋理和色彩。目標是讓新加入的「主體」看起來完全不突兀，彷彿本來就在那裡。
4.  **移除 vs. 新增**: 如果指令是移除物件，您必須**忽略主體圖像**，並將遮罩區域用符合周圍環境的背景填補。如果指令是新增或替換成「主體」，則嚴格執行上述步驟1-3。

【輸出格式】
您的輸出只能是圖片檔案 (Image file ONLY)。禁止輸出任何文字或確認訊息。
${negativePromptSection}`;
    
    const parts: any[] = [
      { text: generationPrompt },
      { inlineData: { mimeType: "image/png", data: inputPureBase64 } }, // Background
      { inlineData: { mimeType: "image/png", data: maskPureBase64 } }    // Mask
    ];

    const isRemoval = prompt.includes('移除') || prompt.includes('remove');
    if (subjectPureBase64 && !isRemoval) {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: subjectPureBase64 } }); // Subject
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT]
        }
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => 'inlineData' in p);

    if (!imagePart || !('inlineData' in imagePart)) {
        const textResponse = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResponse) throw new Error(`AI failed to generate image, responded with text: ${textResponse}`);
        throw new Error(`API failed to generate a valid image. Reason: ${response.promptFeedback?.blockReason || 'Unknown'}`);
    }

    const base64Image = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    const gen = await new Promise<HTMLImageElement>(resolve => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => resolve(i); i.src = base64Image; });
    
    const finalJpgCanvas = document.createElement('canvas');
    finalJpgCanvas.width = gen.naturalWidth;
    finalJpgCanvas.height = gen.naturalHeight;
    const jctx = finalJpgCanvas.getContext('2d');
    if (!jctx) throw new Error("Could not get final canvas context");

    jctx.fillStyle = '#ffffff';
    jctx.fillRect(0, 0, finalJpgCanvas.width, finalJpgCanvas.height);
    jctx.drawImage(gen, 0, 0);

    return finalJpgCanvas.toDataURL('image/jpeg', 0.95);
};
