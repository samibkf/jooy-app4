import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const QRScannerButton: React.FC = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate("/");
    toast({
      title: "QR Scanner Activated",
      description: "Position the QR code within the frame to scan",
    });
  };

  return (
    <Button
      onClick={handleClick}
      className="fixed top-4 right-4 z-50 rounded-full bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white shadow-lg"
      size="icon"
      aria-label="Scan QR Code"
    >
      <QrCode className="h-5 w-5" />
    </Button>
  );
};

export default QRScannerButton;