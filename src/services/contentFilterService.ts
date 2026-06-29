class ContentFilterService {
  private static instance: ContentFilterService;

  static getInstance(): ContentFilterService {
    if (!ContentFilterService.instance) {
      ContentFilterService.instance = new ContentFilterService();
    }
    return ContentFilterService.instance;
  }

  private healthKeywords = [
    'health', 'medical', 'doctor', 'hospital', 'medicine', 'symptom', 'disease', 'illness', 'pain',
    'fever', 'headache', 'treatment', 'diagnosis', 'prescription', 'pharmacy', 'clinic', 'nurse',
    'surgery', 'therapy', 'wellness', 'fitness', 'nutrition', 'diet', 'exercise', 'mental health',
    'depression', 'anxiety', 'stress', 'sleep', 'fatigue', 'blood pressure', 'diabetes', 'heart',
    'lung', 'kidney', 'liver', 'stomach', 'brain', 'skin', 'eye', 'ear', 'throat', 'chest',
    'pregnancy', 'baby', 'child', 'elderly', 'vaccine', 'medication', 'allergy', 'infection',
    'virus', 'bacteria', 'covid', 'flu', 'cold', 'cough', 'breathing', 'emergency', 'first aid'
  ];

  private nonHealthTopics = [
    'politics', 'religion', 'sports', 'entertainment', 'movies', 'music', 'games', 'technology',
    'business', 'finance', 'investment', 'cryptocurrency', 'weather', 'news', 'gossip', 'celebrity',
    'fashion', 'travel', 'food recipe', 'cooking', 'shopping', 'dating', 'relationship advice',
    'legal advice', 'financial advice', 'investment tips', 'stock market', 'real estate'
  ];

  private conversationalPhrases = [
    'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
    'thank you', 'thanks', 'ok', 'okay', 'yes', 'no', 'sure', 'alright',
    'i see', 'i understand', 'got it', 'makes sense', 'please', 'help me',
    'tell me more', 'explain', 'can you', 'what about', 'how about',
    'bye', 'goodbye', 'see you', 'take care', 'have a good day'
  ];

  isHealthRelated(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();
    
    // Allow basic conversational phrases
    const isConversational = this.conversationalPhrases.some(phrase => 
      lowerMessage === phrase || lowerMessage.startsWith(phrase + ' ') || lowerMessage.endsWith(' ' + phrase)
    );
    
    if (isConversational) return true;

    // Check for health keywords
    const hasHealthKeywords = this.healthKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );

    // Check for non-health topics
    const hasNonHealthTopics = this.nonHealthTopics.some(topic => 
      lowerMessage.includes(topic)
    );

    // If it contains non-health topics, reject
    if (hasNonHealthTopics) return false;

    // If it contains health keywords, accept
    if (hasHealthKeywords) return true;

    // For short messages or follow-ups, be more lenient
    if (message.length < 30) return true;

    // For ambiguous messages, check context
    return this.isHealthContext(lowerMessage);
  }

  private isHealthContext(message: string): boolean {
    const healthContextPhrases = [
      'how do i', 'what should i do', 'is it normal', 'should i see',
      'what causes', 'how to treat', 'what is', 'why do i feel',
      'is it safe', 'can i take', 'what are the symptoms',
      'thank you', 'thanks', 'ok', 'okay', 'yes', 'no',
      'tell me more', 'explain', 'how long', 'when should',
      'what about', 'can you', 'please', 'help me'
    ];

    return healthContextPhrases.some(phrase => message.includes(phrase));
  }

  filterAIResponse(response: string): string {
    // Remove any non-health content from AI response
    const lines = response.split('\n');
    const filteredLines = lines.filter(line => {
      const lowerLine = line.toLowerCase();
      return !this.nonHealthTopics.some(topic => lowerLine.includes(topic));
    });

    return filteredLines.join('\n').trim();
  }

  getHealthOnlyPrompt(): string {
    return `You are Hbridge AI, a friendly health assistant. You can discuss health, medical topics, and engage in basic conversation. 
    Respond naturally to greetings and conversational messages. For non-health topics, politely redirect: 
    "I'm here to help with health questions. What can I assist you with regarding your health?"`;
  }
}

export default ContentFilterService;