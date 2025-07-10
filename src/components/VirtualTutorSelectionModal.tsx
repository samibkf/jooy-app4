import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface VirtualTutor {
  id: string;
  name: string;
  imageSrc: string;
  videoSrc: string;
}

const VIRTUAL_TUTORS: VirtualTutor[] = [
  {
    id: "tutor1",
    name: "Virtual Tutor 1",
    imageSrc: "/video/1.jpg",
    videoSrc: "/video/1.mp4"
  },
  {
    id: "tutor2", 
    name: "Virtual Tutor 2",
    imageSrc: "/video/2.jpg",
    videoSrc: "/video/2.mp4"
  }
];

interface VirtualTutorSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTutor: (videoSrc: string) => void;
}

const VirtualTutorSelectionModal: React.FC<VirtualTutorSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectTutor
}) => {
  const handleTutorClick = (videoSrc: string) => {
    onSelectTutor(videoSrc);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center">Select Virtual Tutor</DialogTitle>
          <DialogDescription className="text-center">
            Choose your preferred virtual tutor for this session
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4 p-4">
          {VIRTUAL_TUTORS.map((tutor) => (
            <div
              key={tutor.id}
              className="flex flex-col items-center cursor-pointer p-3 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200"
              onClick={() => handleTutorClick(tutor.videoSrc)}
            >
              <img
                src={tutor.imageSrc}
                alt={tutor.name}
                className="w-20 h-20 rounded-full object-cover mb-2 shadow-md"
                onError={(e) => {
                  // Fallback if image fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
              <p className="text-sm font-medium text-center text-gray-700">
                {tutor.name}
              </p>
            </div>
          ))}
        </div>
        
        <div className="flex justify-center p-4">
          <Button 
            onClick={onClose}
            variant="outline"
            className="px-6"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VirtualTutorSelectionModal;