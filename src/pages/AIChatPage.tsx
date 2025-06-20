import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, Send, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { getTextDirection } from "@/lib/textDirection";
import SwitchModeButton from "@/components/SwitchModeButton";
import type { RegionData, WorksheetMetadata } from "@/types/worksheet";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const AIChatPage: React.FC = () => {
  const { worksheetId, pageNumber } = useParams<{ worksheetId: string; pageNumber: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the state passed during navigation
  const locationState = location.state as { 
    fromTextMode?: boolean;
    activeRegion?: RegionData;
    currentStepIndex?: number;
    pdfUrl?: string;
    worksheetMeta?: WorksheetMetadata;
  } | null;
  
  const fromTextMode = locationState?.fromTextMode || false;
  const activeRegion = locationState?.activeRegion;
  const currentStepIndex = locationState?.currentStepIndex || 0;
  const pdfUrl = locationState?.pdfUrl;
  const worksheetMeta = locationState?.worksheetMeta;
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(true);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from localStorage on component mount or when worksheet/page changes
  useEffect(() => {
    if (!worksheetId || !pageNumber) return;
    
    const chatHistoryKey = `aiChatHistory_${worksheetId}_${pageNumber}`;
    
    try {
      const storedHistory = localStorage.getItem(chatHistoryKey);
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
          setMessages(parsedHistory);
          return; // Don't set default message if we have stored history
        }
      }
    } catch (error) {
      console.warn('Failed to parse stored chat history:', error);
    }
    
    // Set default AI welcome message if no stored history
    setMessages([{
      role: 'assistant',
      content: `How can I help you with this worksheet page?`
    }]);
  }, [worksheetId, pageNumber]);

  // Save chat history to localStorage whenever messages change
  useEffect(() => {
    if (!worksheetId || !pageNumber || messages.length === 0) return;
    
    const chatHistoryKey = `aiChatHistory_${worksheetId}_${pageNumber}`;
    
    try {
      localStorage.setItem(chatHistoryKey, JSON.stringify(messages));
    } catch (error) {
      console.warn('Failed to save chat history to localStorage:', error);
    }
  }, [messages, worksheetId, pageNumber]);

  // Scroll to bottom when new messages are added - changed from "smooth" to "instant"
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages]);

  // Load cached page image or generate new one
  useEffect(() => {
    if (!pdfUrl || !pageNumber || !worksheetId) {
      setIsGeneratingImage(false);
      toast({
        title: "Error",
        description: "PDF data not available for AI chat.",
        variant: "destructive"
      });
      return;
    }
    
    // Create a unique key for this worksheet page image
    const imageKey = `worksheetPageImage_${worksheetId}_${pageNumber}`;
    
    // Try to load cached image from sessionStorage first
    try {
      const cachedImage = sessionStorage.getItem(imageKey);
      if (cachedImage) {
        console.log('Using cached worksheet page image');
        setPageImage(cachedImage);
        setIsGeneratingImage(false);
        return;
      }
    } catch (error) {
      console.warn('Failed to load cached image from sessionStorage:', error);
    }
    
    // If no cached image found, generate a new one
    console.log('Generating new worksheet page image');
    setIsGeneratingImage(true);
  }, [pdfUrl, pageNumber, worksheetId]);

  const onPageLoadSuccess = (page: any) => {
    const canvas = canvasRef.current;
    if (!canvas || !worksheetId || !pageNumber) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Set canvas size to match PDF page
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Render PDF page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    page.render(renderContext).promise.then(() => {
      // Convert canvas to base64 image
      const imageDataUrl = canvas.toDataURL('image/png');
      setPageImage(imageDataUrl);
      setIsGeneratingImage(false);
      
      // Cache the generated image in sessionStorage for future use
      const imageKey = `worksheetPageImage_${worksheetId}_${pageNumber}`;
      try {
        sessionStorage.setItem(imageKey, imageDataUrl);
        console.log('Cached worksheet page image for future use');
      } catch (error) {
        console.warn('Failed to cache image in sessionStorage:', error);
        // If sessionStorage is full, try to clear old worksheet images
        try {
          // Clear old worksheet page images to make space
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith('worksheetPageImage_') && key !== imageKey) {
              sessionStorage.removeItem(key);
            }
          }
          // Try to save again after cleanup
          sessionStorage.setItem(imageKey, imageDataUrl);
          console.log('Cached worksheet page image after cleanup');
        } catch (cleanupError) {
          console.warn('Failed to cache image even after cleanup:', cleanupError);
        }
      }
    }).catch((error: any) => {
      console.error('Error rendering PDF page:', error);
      setIsGeneratingImage(false);
      toast({
        title: "Error",
        description: "Failed to generate page image for AI analysis.",
        variant: "destructive"
      });
    });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !pageImage) return;

    const apiKey = localStorage.getItem('gemini-api-key');
    if (!apiKey) {
      toast({
        title: "API Key Missing",
        description: "Please set your Gemini API key first.",
        variant: "destructive"
      });
      return;
    }

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setIsLoading(true);

    // Add user message to chat
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      // Prepare the conversation history for context
      const conversationHistory = newMessages
        .filter(msg => msg.role === 'user')
        .map(msg => `User: ${msg.content}`)
        .join('\n');

      // Create the comprehensive prompt with the new system instructions
      const prompt = `Act as a tutor. Help users understand concepts and solve problems across various subjects. Provide guidance and explanations to foster learning, rather than simply providing answers.

Purpose and Goals:
• Guide users through learning concepts and problem-solving.
• Foster independent thinking and understanding.
• Provide simple, clear, concise, and helpful explanations.

Behaviors and Rules:

1) Worksheet-specific questions:
a) For questions directly asking for worksheet answers, do not provide the direct answer.
b) Instead, offer guidance, hints, or conceptual explanations that help the user arrive at the answer independently.
c) Break down complex problems into smaller, manageable steps.
d) Encourage the user to explain their current thinking or what they've tried so far.

2) General conceptual questions:
a) For general conceptual questions not related to specific worksheet answers, provide direct, clear explanations.
b) Use analogies and examples to illustrate complex ideas.
c) Verify the user's understanding through follow-up questions.

3) Maintain Existing Instructions:
a) Maintain the existing instructions regarding language and context, ensuring responses are appropriate for a tutoring environment.
b) Use clear, simple, and encouraging language.
c) Avoid jargon where simpler terms suffice, or explain technical terms clearly.

Overall Tone:
• Be patient, encouraging, and supportive.
• Maintain an expert yet approachable demeanor.
• Demonstrate enthusiasm for the subject matter and the learning process.

IMPORTANT: Always respond in the same language as the worksheet content and the user's question.

Previous conversation:
${conversationHistory}

Current question: ${userMessage}

Analyze the student's question carefully. If they're asking for a specific worksheet answer, guide them without giving the answer. If they're asking to understand a concept, explain it clearly and directly. Be encouraging and educational in both cases.`;

      // Convert base64 image to the format expected by Gemini
      const base64Data = pageImage.split(',')[1]; // Remove data:image/png;base64, prefix
      
      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: "image/png"
        }
      };

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const aiResponse = response.text();

      // Add AI response to chat
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);

    } catch (error) {
      console.error('Error calling Gemini API:', error);
      toast({
        title: "AI Error",
        description: "Failed to get response from AI. Please check your API key and try again.",
        variant: "destructive"
      });
      
      // Remove the user message if AI failed to respond
      setMessages(messages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const goBack = () => {
    // Navigate back to worksheet without any state - this will show the main PDF view
    navigate(`/worksheet/${worksheetId}/${pageNumber}`);
  };

  if (!worksheetId || !pageNumber) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4">
          Missing worksheet information
        </h1>
        <Button onClick={() => navigate("/")} className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white">
          Return to Scanner
        </Button>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4">
          Worksheet data not available
        </h1>
        <Button onClick={goBack} className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white">
          Return to Worksheet
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Fixed Back Button */}
      <Button
        onClick={goBack}
        className="fixed top-4 left-4 z-70 rounded-full bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white shadow-lg"
        size="icon"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-60 bg-white border-b border-gray-200 p-4 flex items-center gap-4">
        <div className="flex-1 text-center">
          <h1 className="text-xl font-semibold">AI Chat - Page {pageNumber}</h1>
          <p className="text-sm text-gray-600">Worksheet: {worksheetId}</p>
        </div>
      </div>

      <div className="flex-1 flex gap-4 p-4 pt-20 max-w-4xl mx-auto w-full">
        {/* Chat Interface */}
        <div className="flex-1 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">AI Assistant</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {/* Messages */}
              <ScrollArea className="flex-1 mb-4 h-96">
                <div className="space-y-4 pr-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                        dir={getTextDirection(message.content)}
                      >
                        {message.role === 'assistant' ? (
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]} 
                            className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-900 prose-strong:text-gray-900 prose-em:text-gray-900 prose-code:text-gray-900 prose-pre:text-gray-900 prose-li:text-gray-900"
                          >
                            {message.content}
                          </ReactMarkdown>
                        ) : (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 text-gray-900 p-3 rounded-lg">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about this worksheet page..."
                  disabled={isLoading || isGeneratingImage}
                  className="flex-1"
                  dir={getTextDirection(inputMessage)}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputMessage.trim() || isGeneratingImage}
                  size="icon"
                  className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hidden PDF rendering for image generation - only render if no cached image */}
      {!pageImage && (
        <div className="hidden">
          {pdfUrl && (
            <Document file={pdfUrl}>
              <Page
                pageNumber={parseInt(pageNumber)}
                onLoadSuccess={onPageLoadSuccess}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
          )}
          <canvas ref={canvasRef} />
        </div>
      )}

      {/* Conditionally render SwitchModeButton */}
      <SwitchModeButton 
        worksheetId={worksheetId!} 
        pageNumber={parseInt(pageNumber!)} 
        shouldDisplay={fromTextMode}
        initialActiveRegion={activeRegion}
        initialCurrentStepIndex={currentStepIndex}
      />
    </div>
  );
};

export default AIChatPage;