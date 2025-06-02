import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Fullscreen } from "lucide-react";

const FullscreenButton: React.FC = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleClick = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Error toggling fullscreen:", err);
    }
  };

  if (isFullscreen) {
    return null;
  }

  return (
    <Button
      onClick={handleClick}
      className="fixed bottom-4 right-4 z-50 rounded-full bg-transparent hover:bg-transparent"
      size="icon"
      variant="ghost"
      aria-label="Toggle Fullscreen"
    >
      <Fullscreen className="h-20 w-20 text-blue-600" />
    </Button>
  );
};

export default FullscreenButton;