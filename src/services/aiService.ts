import { ChatMessage, ChatSession } from '../types';
import { sanitizeForLog, validateUrl } from '../utils/security';
import Constants from 'expo-constants';

const GEMINI_API_KEY = Constants.expoConfig?.extra?.geminiApiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_FALLBACK_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

interface AIResponse {
  message: string;
  emergency_detected: boolean;
  recommended_hospitals?: string[];
  recommended_doctors?: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class AIService {
  private static instance: AIService;
  
  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  private validateAPIKey(): boolean {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
      console.error('Gemini API key not found');
      return false;
    }
    return true;
  }

  async generateResponse(
    message: string,
    language: 'en' | 'pidgin' = 'en',
    userLocation?: { latitude: number; longitude: number; state: string },
    chatHistory: ChatMessage[] = []
  ): Promise<AIResponse> {
    if (!this.validateAPIKey()) {
      return this.getOfflineResponse(language);
    }

    try {
      const systemPrompt = this.buildSystemPrompt(language, userLocation);
      const conversationContext = this.buildConversationContext(chatHistory);
      
      const requestBody = {
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\n${conversationContext}\n\nUser: ${message}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };

      if (!validateUrl(GEMINI_API_URL)) {
        throw new Error('Invalid API URL');
      }

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // If primary model is overloaded (503), retry with fallback model
      let finalResponse = response;
      if (response.status === 503) {
        console.log('[AI] Primary model overloaded, trying fallback...');
        await new Promise(r => setTimeout(r, 1000));
        finalResponse = await fetch(`${GEMINI_FALLBACK_URL}?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
      }

      if (!finalResponse.ok) {
        const errorText = await finalResponse.text();
        console.error('[AI] Full error response:', finalResponse.status, errorText);
        console.error('[AI] API Key present:', !!GEMINI_API_KEY, '| Key prefix:', GEMINI_API_KEY?.substring(0, 8));
        if (finalResponse.status === 400) throw new Error('Invalid request format');
        else if (finalResponse.status === 403) throw new Error('API key invalid or quota exceeded');
        else if (finalResponse.status === 404) throw new Error('AI model not found. Please update the model name.');
        else if (finalResponse.status === 429) throw new Error('Rate limit exceeded');
        else if (finalResponse.status === 503) throw new Error('AI service temporarily overloaded. Please try again in a moment.');
        throw new Error(`API error: ${finalResponse.status}`);
      }

      const data = await finalResponse.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response generated');
      }

      const aiMessage = data.candidates[0]?.content?.parts[0]?.text;
      
      if (!aiMessage) {
        throw new Error('Empty response from AI');
      }

      return this.parseAIResponse(aiMessage, userLocation);
    } catch (error) {
      console.error('AI Service Error:', sanitizeForLog(String(error)));
      return this.getErrorResponse(error as Error, language);
    }
  }

  private getOfflineResponse(language: 'en' | 'pidgin'): AIResponse {
    return {
      message: language === 'pidgin' 
        ? 'Sorry o, AI service no dey available now. For emergency, call 112 immediately.'
        : 'AI service is currently unavailable. For emergencies, please call 112 immediately.',
      emergency_detected: false,
      severity: 'low'
    };
  }

  private getErrorResponse(error: Error, language: 'en' | 'pidgin'): AIResponse {
    const isConnectionError = error.message.includes('fetch') || error.message.includes('network');
    const isAPIError = error.message.includes('API') || error.message.includes('quota') || error.message.includes('key');
    
    let message: string;
    
    if (language === 'pidgin') {
      if (isConnectionError) {
        message = 'Network problem o. Check your internet connection and try again. For emergency, call 112.';
      } else if (isAPIError) {
        message = 'AI service get problem now. Try again in few seconds or call 112 for emergency.';
      } else {
        message = 'Something go wrong. Try again or call 112 for emergency.';
      }
    } else {
      if (isConnectionError) {
        message = 'Connection error. Please check your internet and try again. For emergencies, call 112.';
      } else if (isAPIError) {
        message = 'AI service is temporarily busy. Please try again in a few seconds. For emergencies, call 112.';
      } else {
        message = 'Something went wrong. Please try again or call 112 for emergencies.';
      }
    }

    return {
      message,
      emergency_detected: false,
      severity: 'low'
    };
  }

  private buildSystemPrompt(language: 'en' | 'pidgin', userLocation?: { state: string }): string {
    const locationContext = userLocation ? `User is located in ${userLocation.state} state, Nigeria.` : 'User is in Nigeria.';
    
    if (language === 'pidgin') {
      return `You be AI medical assistant for Nigerian people. You dey help with health questions but you no be doctor. Always remind people say you no be replacement for real doctor.

IMPORTANT RULES:
- If person get emergency symptoms (chest pain, difficulty breathing, severe bleeding, unconsciousness), tell them call 112 immediately
- Always speak Nigerian Pidgin English
- Give general health advice only, no diagnose disease
- Recommend say them see doctor for proper checkup
- If symptoms serious, recommend nearest hospital
- Be respectful and caring
- ${locationContext}

Emergency symptoms wey you must detect:
- Chest pain or heart attack signs
- Difficulty breathing or choking
- Severe bleeding
- Unconsciousness or fainting
- Severe burns
- Poisoning
- Stroke symptoms
- Severe allergic reactions`;
    }

    return `You are an AI medical assistant for Nigerian communities. You provide general health information but are NOT a replacement for professional medical care.

CRITICAL RULES:
- If user describes emergency symptoms, immediately advise calling 112 (Nigeria emergency number)
- Provide general health guidance only, never diagnose conditions
- Always recommend consulting healthcare professionals for proper diagnosis
- Be culturally sensitive to Nigerian context
- Recommend nearest hospitals for serious symptoms
- ${locationContext}

EMERGENCY SYMPTOMS TO DETECT:
- Chest pain, heart attack symptoms
- Difficulty breathing, choking
- Severe bleeding, trauma
- Loss of consciousness
- Severe burns
- Poisoning
- Stroke symptoms (FAST test)
- Severe allergic reactions
- High fever in children

Always end responses with: "This is general information only. For proper diagnosis and treatment, please consult a qualified healthcare professional."`;
  }

  private buildConversationContext(chatHistory: ChatMessage[]): string {
    if (chatHistory.length === 0) return '';
    
    const recentMessages = chatHistory.slice(-6);
    return recentMessages
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');
  }

  private parseAIResponse(aiMessage: string, userLocation?: { latitude: number; longitude: number }): AIResponse {
    const emergencyKeywords = [
      'call 112', 'emergency', 'hospital immediately', 'urgent medical attention',
      'chest pain', 'difficulty breathing', 'severe bleeding', 'unconscious',
      'stroke', 'heart attack', 'poisoning', 'severe burn'
    ];

    const isEmergency = emergencyKeywords.some(keyword => 
      aiMessage.toLowerCase().includes(keyword.toLowerCase())
    );

    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (isEmergency) {
      severity = 'critical';
    } else if (aiMessage.toLowerCase().includes('see doctor') || aiMessage.toLowerCase().includes('medical attention')) {
      severity = 'medium';
    }

    return {
      message: aiMessage,
      emergency_detected: isEmergency,
      severity,
      recommended_hospitals: isEmergency ? [] : undefined,
      recommended_doctors: severity === 'medium' ? [] : undefined,
    };
  }

  createAnonymousSession(): ChatSession {
    return {
      id: `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      messages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_emergency: false,
      language: 'en'
    };
  }
}