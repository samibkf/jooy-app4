import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface AIChatButtonProps {
  worksheetId: string;
}

const AIChatButton: React.FC<AIChatButtonProps> = ({ worksheetId }) => {
  const navigate = useNavigate();

  const handleChatClick = () => {
    // Check if API key exists in localStorage
    const existingApiKey = localStorage.getItem('geminiApiKey');
    
    if (!existingApiKey) {
      // Prompt user for API key
      const apiKey = prompt(
        'Please enter your Google Gemini API key to use the AI chat feature:\n\n' +
        'You can get your API key from: https://aistudio.google.com/app/apikey'
      );
      
      if (!apiKey || apiKey.trim() === '') {
        toast({
          title: "API Key Required",
          description: "You need to provide a valid Gemini API key to use the chat feature.",
          variant: "destructive"
        });
        return;
      }
      
      // Save the API key to localStorage
      localStorage.setItem('geminiApiKey', apiKey.trim());
      
      toast({
        title: "API Key Saved",
        description: "Your Gemini API key has been saved. You can now use the AI chat feature.",
      });
    }
    
    // Navigate to chat page
    navigate(`/chat/${worksheetId}`);
  };

  return (
    <Button
      onClick={handleChatClick}
      className="fixed top-4 left-4 z-50 rounded-full bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white shadow-lg"
      size="icon"
      aria-label="Open AI Chat"
    >
      <MessageCircle className="h-5 w-5" />
    </Button>
  );
};

export default AIChatButton;