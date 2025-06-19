import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Bot, User } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useWorksheetData } from "@/hooks/useWorksheetData";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const ChatPage: React.FC = () => {
  const { worksheetId } = useParams<{ worksheetId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Fetch worksheet data for context
  const { data: worksheetData, isLoading: isWorksheetLoading, error: worksheetError } = useWorksheetData(worksheetId || "");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Add initial welcome message
    if (worksheetData && messages.length === 0) {
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Hello! I'm here to help you with the worksheet "${worksheetData.documentName}". I can answer questions about the content, explain concepts, or help you understand the material better. What would you like to know?`,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [worksheetData, messages.length]);

  const generateContextPrompt = () => {
    if (!worksheetData) return "";
    
    let context = `You are an AI assistant helping a student with a worksheet titled "${worksheetData.documentName}". `;
    
    if (worksheetData.regions && worksheetData.regions.length > 0) {
      context += "The worksheet contains the following interactive regions:\n\n";
      worksheetData.regions.forEach((region, index) => {
        context += `Region ${index + 1} (${region.name}) on page ${region.page}:\n`;
        if (region.description && region.description.length > 0) {
          context += `Description: ${region.description.join(' ')}\n\n`;
        }
      });
    }
    
    context += "Please provide helpful, educational responses that assist the student in understanding the worksheet content. Be encouraging and explain concepts clearly.";
    
    return context;
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const apiKey = localStorage.getItem('geminiApiKey');
    if (!apiKey) {
      toast({
        title: "API Key Missing",
        description: "Please provide your Gemini API key to use the chat feature.",
        variant: "destructive"
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Initialize Gemini AI
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      // Prepare conversation history for context
      const conversationHistory = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      // Add current user message
      conversationHistory.push({
        role: 'user',
        parts: [{ text: userMessage.content }]
      });

      // Create context-aware prompt
      const contextPrompt = generateContextPrompt();
      const fullPrompt = `${contextPrompt}\n\nUser question: ${userMessage.content}`;

      // Start chat with history
      const chat = model.startChat({
        history: conversationHistory.slice(0, -1), // Exclude the current message as it will be sent separately
      });

      const result = await chat.sendMessage(fullPrompt);
      const response = await result.response;
      const aiResponse = response.text();

      // Add AI response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please check your API key and try again.",
        variant: "destructive"
      });
      
      // Remove the user message if there was an error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const goBack = () => {
    navigate(`/worksheet/${worksheetId}/1`);
  };

  if (!worksheetId) {
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

  if (worksheetError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4">
          Error loading worksheet data
        </h1>
        <Button onClick={goBack} className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white">
          Return to Worksheet
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={goBack}
            variant="ghost"
            size="icon"
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">AI Chat Assistant</h1>
            {worksheetData && (
              <p className="text-sm text-gray-600">{worksheetData.documentName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {isWorksheetLoading ? (
              <div className="flex justify-center py-8">
                <div className="text-gray-500">Loading worksheet data...</div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <Bot className="h-4 w-4 text-purple-600" />
                    </div>
                  )}
                  
                  <Card className={`max-w-[80%] ${
                    message.role === 'user' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white'
                  }`}>
                    <CardContent className="p-3">
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className={`text-xs mt-2 ${
                        message.role === 'user' 
                          ? 'text-blue-100' 
                          : 'text-gray-500'
                      }`}>
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </CardContent>
                  </Card>

                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                  )}
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Bot className="h-4 w-4 text-purple-600" />
                </div>
                <Card className="bg-white">
                  <CardContent className="p-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about this worksheet..."
              disabled={isLoading || isWorksheetLoading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading || isWorksheetLoading}
              className="bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;