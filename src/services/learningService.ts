import { GoogleGenAI, Type } from "@google/genai";
import { Message, Task, Reminder, LearnedPreference } from "@/types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const learningService = {
  /**
   * Analyzes user history to extract preferences and habits.
   */
  async extractPreferences(
    messages: Message[],
    tasks: Task[],
    reminders: Reminder[],
    existingPreferences: LearnedPreference[]
  ): Promise<LearnedPreference[]> {
    const context = {
      messages: messages.slice(-20).map(m => ({ role: m.role, content: m.content })),
      tasks: tasks.slice(-20).map(t => ({ title: t.title, date: t.date, completed: t.completed })),
      reminders: reminders.slice(-20).map(r => ({ title: r.title, time: r.time, completed: r.completed })),
      existing: existingPreferences.map(p => p.content)
    };

    const prompt = `
      Bạn là một chuyên gia phân tích hành vi AI. Hãy phân tích dữ liệu người dùng dưới đây để tìm ra các thói quen, sở thích, quy luật lịch trình và THÔNG TIN CÁ NHÂN quan trọng.
      
      Dữ liệu:
      ${JSON.stringify(context, null, 2)}
      
      Yêu cầu:
      1. Tìm các thói quen lặp lại (ví dụ: luôn tập thể dục buổi sáng).
      2. Tìm các sở thích giao tiếp và sở thích cá nhân.
      3. ĐẶC BIỆT CHÚ Ý trích xuất thông tin cố định: Tên, Địa chỉ, Công việc, Ngày sinh, hoặc các địa điểm quan trọng.
      4. Tránh lặp lại các thông tin đã biết trong "existing".
      5. Chỉ trả về các thông tin có độ tin cậy cao.
      
      Trả về danh sách các sở thích mới dưới dạng JSON.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { 
                  type: Type.STRING, 
                  enum: ['schedule', 'communication', 'interests', 'personal_info', 'work', 'location', 'general'] 
                },
                content: { type: Type.STRING },
                confidence: { type: Type.NUMBER, description: "Từ 0 đến 1" }
              },
              required: ['category', 'content', 'confidence']
            }
          }
        }
      });

      const results = JSON.parse(response.text || "[]");
      return results.map((r: any) => ({
        ...r,
        id: crypto.randomUUID(),
        source: "AI Analysis",
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {
      console.error("Error extracting preferences:", error);
      return [];
    }
  },

  /**
   * Updates the structured user profile based on extracted preferences.
   */
  async updateProfile(
    currentProfile: any,
    newLearnedPrefs: LearnedPreference[]
  ): Promise<any> {
    const personalInfo = newLearnedPrefs.filter(p => 
      ['personal_info', 'work', 'location'].includes(p.category) && p.confidence > 0.8
    );

    if (personalInfo.length === 0) return currentProfile;

    const prompt = `
      Cập nhật hồ sơ người dùng dựa trên các thông tin mới được trích xuất.
      
      Hồ sơ hiện tại:
      ${JSON.stringify(currentProfile, null, 2)}
      
      Thông tin mới:
      ${JSON.stringify(personalInfo, null, 2)}
      
      Yêu cầu:
      - Hợp nhất thông tin mới vào hồ sơ hiện tại.
      - Nếu thông tin mới mâu thuẫn với thông tin cũ, hãy ưu tiên thông tin mới nếu độ tin cậy cao.
      - Trả về đối tượng hồ sơ đầy đủ (UserProfile) dưới dạng JSON.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              address: { type: Type.STRING },
              occupation: { type: Type.STRING },
              birthday: { type: Type.STRING },
              bio: { type: Type.STRING }
            }
          }
        }
      });

      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("Error updating profile:", error);
      return currentProfile;
    }
  },

  /**
   * Generates proactive suggestions based on context and learned preferences.
   */
  async generateSuggestions(
    learnedPreferences: LearnedPreference[],
    currentTasks: Task[],
    currentReminders: Reminder[]
  ): Promise<string[]> {
    if (learnedPreferences.length === 0) return [];

    const prompt = `
      Dựa trên các thói quen và sở thích đã học được của người dùng, hãy đưa ra 3 gợi ý hành động hoặc nhắc nhở thông minh cho hôm nay.
      
      Thói quen đã học:
      ${learnedPreferences.map(p => `- ${p.content}`).join('\n')}
      
      Công việc hiện tại:
      ${currentTasks.map(t => `- ${t.title} (${t.date})`).join('\n')}
      
      Nhắc nhở hiện tại:
      ${currentReminders.map(r => `- ${r.title} (${r.time})`).join('\n')}
      
      Yêu cầu:
      - Gợi ý phải mang tính cá nhân hóa cao.
      - Ví dụ: "Bạn thường tập gym vào giờ này, tôi có nên lên lịch nhắc nhở không?" hoặc "Tôi thấy bạn có cuộc họp lúc 2h, bạn nên chuẩn bị tài liệu từ bây giờ."
      - Trả về danh sách các câu gợi ý ngắn gọn, thân thiện.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      return JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("Error generating suggestions:", error);
      return [];
    }
  }
};
