import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageSquareText } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface AIChatButtonProps {
  worksheetId: string;
  pageNumber: number;
}

const AIChatButton: React.FC<AIChatButtonProps> = ({ worksheetId, pageNumber }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    // Check if API key exists in localStorage
    const apiKey = localStorage.getItem('gemini-api-key');
    
    if (!apiKey) {
      // Prompt user for API key
      const userApiKey = prompt(
        'Please enter your Google Gemini API key to use AI chat:\n\n' +
        'You can get your API key from: https://aistudio.google.com/app/apikey'
      );
      
      if (!userApiKey) {
        toast({
          title: "API Key Required",
          description: "You need to provide a Gemini API key to use AI chat.",
          variant: "destructive"
        });
        return;
      }
      
      // Save API key to localStorage
      localStorage.setItem('gemini-api-key', userApiKey.trim());
      
      toast({
        title: "API Key Saved",
        description: "Your Gemini API key has been saved successfully.",
      });
    }
    
    // Navigate to chat page
    navigate(`/chat/${worksheetId}/${pageNumber}`);
  };

  return (
    <Button
      onClick={handleClick}
      className="fixed bottom-4 left-4 z-50 rounded-full bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white shadow-lg"
      size="icon"
      aria-label="AI Chat"
    >
      <MessageSquareText className="h-5 w-5" />
    </Button>
  );
};

export default AIChatButton;