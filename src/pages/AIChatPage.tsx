import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, Send, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from '../lib/supabaseClient';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const AIChatPage: React.FC = () => {
  const { worksheetId, pageNumber } = useParams<{ worksheetId: string; pageNumber: string }>();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(true);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Generate page image on component mount
  useEffect(() => {
    const generatePageImage = async () => {
      if (!worksheetId || !pageNumber) return;
      
      setIsGeneratingImage(true);
      
      try {
        // Fetch PDF URL from Supabase
        const { data, error } = await supabase.functions.invoke('get-worksheet-data', {
          body: { worksheetId },
        });

        if (error || !data?.pdfUrl) {
          throw new Error('Failed to fetch PDF');
        }

        setPdfUrl(data.pdfUrl);
        
        // The actual image generation will happen in the onPageLoadSuccess callback
      } catch (error) {
        console.error('Error fetching PDF:', error);
        toast({
          title: "Error",
          description: "Failed to load worksheet page for AI chat.",
          variant: "destructive"
        });
      }
    };

    generatePageImage();
  }, [worksheetId, pageNumber]);

  const onPageLoadSuccess = (page: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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
      
      // Add initial AI message
      setMessages([{
        role: 'assistant',
        content: `How can I help you with this worksheet page?`
      }]);
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
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      // Prepare the conversation history for context
      const conversationHistory = newMessages
        .filter(msg => msg.role === 'user')
        .map(msg => `User: ${msg.content}`)
        .join('\n');

      // Create the prompt with context and language instruction
      const prompt = `You are an AI assistant helping a student understand their worksheet. You can see the worksheet page in the image provided. 

IMPORTANT: Please respond in the same language as the worksheet content and the user's question.

Previous conversation:
${conversationHistory}

Current question: ${userMessage}

Please provide a helpful, educational response based on what you can see in the worksheet image and the student's question. Be encouraging and explain concepts clearly. Always respond in the language of the worksheet.`;

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-4">
        <Button
          onClick={goBack}
          variant="ghost"
          size="icon"
          className="rounded-full"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">AI Chat - Page {pageNumber}</h1>
          <p className="text-sm text-gray-600">Worksheet: {worksheetId}</p>
        </div>
      </div>

      <div className="flex-1 flex gap-4 p-4 max-w-4xl mx-auto w-full">
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
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
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

      {/* Hidden PDF rendering for image generation */}
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
    </div>
  );
};

export default AIChatPage;