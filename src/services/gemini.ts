import { GoogleGenAI, Type } from "@google/genai";
import { LearnedPreference } from "@/types";

// Use the correct initialization pattern
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AssistantResponse {
  text: string;
  action?: {
    type: 'create_reminder' | 'create_task' | 'summarize' | 'suggest';
    data: any;
  };
}

export const processUserMessage = async (
  message: string, 
  context: string = "", 
  learnedPreferences: LearnedPreference[] = [],
  file?: { data: string; type: string }
): Promise<AssistantResponse> => {
  const preferencesContext = learnedPreferences.length > 0 
    ? `\nUser Preferences you have learned:\n${learnedPreferences.map(p => `- ${p.content}`).join('\n')}`
    : "";

  const parts: any[] = [{ text: message }];
  
  if (file) {
    parts.push({
      inlineData: {
        data: file.data,
        mimeType: file.type
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: `Bạn là Linh, một trợ lý cá nhân AI thông minh và thân thiện.
        Mục tiêu của bạn là giúp người dùng quản lý cuộc sống hiệu quả.
        Bạn có khả năng:
        1. Tạo nhắc nhở (ví dụ: "Nhắc tôi gọi cho mẹ lúc 6h tối")
        2. Tạo lịch trình/công việc (ví dụ: "Thêm lịch tập Gym vào sáng mai lúc 8h")
        3. Tóm tắt thông tin người dùng cung cấp.
        4. Đưa ra gợi ý cá nhân hóa dựa trên thói quen.
        
        Bối cảnh người dùng: ${context}${preferencesContext}
        
        Hãy trả lời bằng giọng điệu thân thiện, lễ phép và hữu ích.
        Nếu người dùng muốn thực hiện một hành động, hãy bao gồm đối tượng 'action' có cấu trúc trong phản hồi JSON của bạn.
        
        Định dạng phản hồi:
        {
          "text": "Lời nhắn thân thiện của bạn ở đây",
          "action": {
            "type": "create_reminder" | "create_task" | "summarize" | "suggest",
            "data": { ... dữ liệu liên quan ... }
          }
        }`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            action: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ['create_reminder', 'create_task', 'summarize', 'suggest'] },
                data: { type: Type.OBJECT }
              }
            }
          },
          required: ["text"]
        }
      }
    });

    const responseText = response.text;
    return JSON.parse(responseText || "{}");
  } catch (error: any) {
    const errorString = JSON.stringify(error);
    console.error("Gemini API Error Details:", errorString);
    
    if (errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED')) {
      return { text: "LỖI HẠN MỨC (429): API Key của bạn đã hết lượt sử dụng miễn phí trong lúc này. Hãy thử lại sau 1 phút hoặc tạo một API Key trong 'NEW project' tại AI Studio nhé!" };
    }
    
    return { text: "Linh đang gặp một chút vấn đề kỹ thuật khi xử lý câu trả lời. Bạn thử lại sau giây lát nhé!" };
  }
};

export const extractPreferences = async (messages: { role: string, content: string }[]): Promise<Partial<LearnedPreference>[]> => {
  const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n');
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [{ role: "user", parts: [{ text: conversation }] }],
      config: {
        systemInstruction: `Analyze the conversation and extract any new user preferences, habits, or interests.
        Look for:
        - Preferred times for activities (e.g., "I like to work out in the morning")
        - Communication styles (e.g., "Keep it brief")
        - Interests (e.g., "I'm interested in AI")
        - Recurring tasks (e.g., "I have a meeting every Monday")
        
        Return a list of preferences in JSON format.
        Each preference should have:
        - category: "schedule" | "communication" | "interests" | "general"
        - content: A clear description of the preference
        - confidence: A number between 0 and 1 indicating how certain you are.
        
        Example:
        [
          { "category": "schedule", "content": "Thích tập gym vào lúc 8h sáng", "confidence": 0.9 },
          { "category": "communication", "content": "Muốn nhận thông báo ngắn gọn", "confidence": 0.8 }
        ]`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING, enum: ["schedule", "communication", "interests", "general"] },
              content: { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            },
            required: ["category", "content", "confidence"]
          }
        }
      }
    });

    const responseText = response.text;
    return JSON.parse(responseText || "[]");
  } catch (error: any) {
    const errorString = JSON.stringify(error);
    console.error("Preference extraction error:", errorString);
    return [];
  }
};
