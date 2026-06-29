import { ChatMessage, ChatSession } from '../types';
import { ValidationService } from './validationService';
import { supabase } from '../lib/supabase';
import { validateUrl } from '../utils/security';
import ContentFilterService from './contentFilterService';
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

export class SecureAIService {
  private static instance: SecureAIService;
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  private contentFilter = ContentFilterService.getInstance();
  
  static getInstance(): SecureAIService {
    if (!SecureAIService.instance) {
      SecureAIService.instance = new SecureAIService();
    }
    return SecureAIService.instance;
  }

  private validateAPIKey(): boolean {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
      console.error('Gemini API key not found');
      return false;
    }
    return true;
  }

  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = this.rateLimitMap.get(userId);
    
    if (!userLimit || now > userLimit.resetTime) {
      this.rateLimitMap.set(userId, { count: 1, resetTime: now + 60000 }); // 1 minute
      return true;
    }
    
    if (userLimit.count >= 10) { // 10 messages per minute
      return false;
    }
    
    userLimit.count++;
    return true;
  }

  async generateResponse(
    message: string,
    language: string = 'en',
    userLocation?: { latitude: number; longitude: number; state: string },
    chatHistory: ChatMessage[] = [],
    userId?: string,
    imageBase64?: string
  ): Promise<AIResponse> {
    try {
      // Rate limiting
      if (userId && !this.checkRateLimit(userId)) {
        throw new Error('Rate limit exceeded. Please wait before sending another message.');
      }

      // Input validation and health filter
      const validatedInput = ValidationService.validateChatInput({ message, language });
      
      // Check if message is health-related
      if (!this.contentFilter.isHealthRelated(validatedInput.message)) {
        return {
          message: language === 'pidgin' 
            ? 'I fit only help you with health and medical questions. Please ask about your health concerns.'
            : 'I can only help with health and medical questions. Please ask about your health concerns.',
          emergency_detected: false,
          severity: 'low'
        };
      }
      
      // Emergency detection
      const isEmergency = ValidationService.isEmergencyKeyword(validatedInput.message);
      
      if (isEmergency) {
        return this.getEmergencyResponse(language, userLocation);
      }

      if (!this.validateAPIKey()) {
        return this.getOfflineResponse(language);
      }

      // Call Gemini API with validation
      const response = await this.callGeminiAPI(validatedInput.message, language, userLocation, chatHistory, imageBase64);
      
      return response;
    } catch (error) {
      console.error('AI Service Error:', error);
      return this.getErrorResponse(error as Error, language);
    }
  }

  private async callGeminiAPI(
    message: string,
    language: string,
    userLocation?: { latitude: number; longitude: number; state: string },
    chatHistory: ChatMessage[] = [],
    imageBase64?: string
  ): Promise<AIResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(language, userLocation);
      const conversationContext = this.buildConversationContext(chatHistory);

      const textPart = { text: `${systemPrompt}\n\n${conversationContext}\n\nUser: ${message}` };
      const parts: any[] = imageBase64
        ? [textPart, { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }]
        : [textPart];

      const requestBody = {
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.3,
          topK: 20,
          topP: 0.8,
          maxOutputTokens: 512,
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

      // Validate URL before making request
      if (!validateUrl(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`)) {
        throw new Error('Invalid API URL');
      }

      const fetchWithRetry = async (url: string, retries = 3, delay = 2000): Promise<Response> => {
        const res = await fetch(`${url}?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        if ((res.status === 429 || res.status === 503) && retries > 0) {
          await new Promise(r => setTimeout(r, delay));
          return fetchWithRetry(url, retries - 1, delay * 2);
        }
        return res;
      };

      const finalResponse = await fetchWithRetry(GEMINI_API_URL);

      if (!finalResponse.ok) {
        const errBody = await finalResponse.text();
        console.error('[AI] Error body:', errBody);
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
      throw error;
    }
  }

  private buildSystemPrompt(language: string, userLocation?: { state: string }): string {
    const locationContext = userLocation ? `User is located in ${userLocation.state} state, Nigeria.` : 'User is in Nigeria.';
    const healthOnlyPolicy = this.contentFilter.getHealthOnlyPrompt();

    const languageInstructions: Record<string, string> = {
      pidgin: 'Always respond in Nigerian Pidgin English.',
      yoruba: 'Always respond in Yoruba language.',
      igbo: 'Always respond in Igbo language.',
      hausa: 'Always respond in Hausa language.',
      efik: 'Always respond in Efik language.',
      ijaw: 'Always respond in Ijaw language.',
      tiv: 'Always respond in Tiv language.',
      kanuri: 'Always respond in Kanuri language.',
      fulfulde: 'Always respond in Fulfulde language.',
      ibibio: 'Always respond in Ibibio language.',
      edo: 'Always respond in Edo (Bini) language.',
      urhobo: 'Always respond in Urhobo language.',
      isoko: 'Always respond in Isoko language.',
      nupe: 'Always respond in Nupe language.',
      idoma: 'Always respond in Idoma language.',
    };

    const langInstruction = languageInstructions[language] || 'Always respond in English.';

    if (language === 'pidgin') {
      return `You be AI medical assistant for Nigerian people. You dey help with health questions but you no be doctor. Always remind people say you no be replacement for real doctor.

${healthOnlyPolicy}

IMPORTANT RULES:
- If person get emergency symptoms, tell them call 112 immediately
- ${langInstruction}
- Give general health advice only, no diagnose disease
- Recommend say them see doctor for proper checkup
- Remember previous conversation context
- ${locationContext}`;
    }

    return `You are an AI medical assistant for Nigerian communities. You provide general health information but are NOT a replacement for professional medical care.

${healthOnlyPolicy}

CRITICAL RULES:
- If user describes emergency symptoms, immediately advise calling 112
- Provide general health guidance only, never diagnose conditions
- Always recommend consulting healthcare professionals
- Remember and reference previous conversation context when relevant
- ${langInstruction}
- ${locationContext}

Always end responses with a brief disclaimer that this is general information only.`;
  }

  private buildConversationContext(chatHistory: ChatMessage[]): string {
    if (chatHistory.length === 0) return '';
    
    // Use more context for better memory (last 10 messages)
    const recentMessages = chatHistory.slice(-10);
    return 'Previous conversation:\n' + recentMessages
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n') + '\n\nCurrent message:';
  }

  private parseAIResponse(aiMessage: string, userLocation?: { latitude: number; longitude: number }): AIResponse {
    // Clean up markdown formatting
    const cleanMessage = aiMessage
      .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove **bold**
      .replace(/\*(.*?)\*/g, '$1')     // Remove *italic*
      .replace(/#{1,6}\s/g, '')       // Remove headers
      .trim();

    const emergencyKeywords = [
      'call 112', 'emergency', 'hospital immediately', 'urgent medical attention'
    ];

    const isEmergency = emergencyKeywords.some(keyword => 
      cleanMessage.toLowerCase().includes(keyword.toLowerCase())
    );

    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (isEmergency) {
      severity = 'critical';
    } else if (cleanMessage.toLowerCase().includes('see doctor')) {
      severity = 'medium';
    }

    return {
      message: cleanMessage,
      emergency_detected: isEmergency,
      severity,
    };
  }

  private getEmergencyResponse(language: string, userLocation?: any): AIResponse {
    const message = language === 'pidgin' 
      ? '🚨 EMERGENCY DETECTED! Call 112 immediately for help.'
      : '🚨 EMERGENCY DETECTED! Please call 112 immediately for emergency assistance.';

    return {
      message,
      emergency_detected: true,
      severity: 'critical',
    };
  }

  private getOfflineResponse(language: string): AIResponse {
    return {
      message: language === 'pidgin' 
        ? 'Sorry o, AI service no dey available now. For emergency, call 112 immediately.'
        : 'AI service is currently unavailable. For emergencies, please call 112 immediately.',
      emergency_detected: false,
      severity: 'low'
    };
  }

  private getErrorResponse(error: Error, language: string): AIResponse {
    console.log('AI Error Details:', error.message);
    
    const isRateLimit = error.message.includes('Rate limit');
    const isNetworkError = error.message.includes('Failed to fetch') || error.message.includes('Network');
    
    let message: string;
    
    if (language === 'pidgin') {
      if (isNetworkError) {
        message = 'Network problem dey. Check your internet connection and try again.';
      } else if (isRateLimit) {
        message = 'You don send too many messages. Wait small make you try again.';
      } else {
        message = 'AI service get problem now. For emergency, call 112 immediately.';
      }
    } else {
      if (isNetworkError) {
        message = 'Network connection issue. Please check your internet and try again.';
      } else if (isRateLimit) {
        message = 'AI is busy right now, please wait a few seconds and try again.';
      } else {
        message = 'AI service is temporarily unavailable. For emergencies, call 112 immediately.';
      }
    }

    return {
      message,
      emergency_detected: false,
      severity: 'low'
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