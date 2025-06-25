import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import QrScanner from "react-qr-scanner";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const QrScannerPage: React.FC = () => {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleScan = (data: { text: string } | null) => {
    if (data && data.text) {
      const qrData = data.text;
      const match = qrData.match(/^([A-Za-z]+)(\d+)$/);
      
      if (match) {
        const id = match[1];
        const n = match[2];
        setScanning(false);
        navigate(`/worksheet/${id}/${n}`);
      } else {
        setError("Invalid QR code format. Expected format: ID followed by page number.");
        toast({
          title: "Invalid QR Format",
          description: "Please scan a valid worksheet QR code.",
          variant: "destructive"
        });
      }
    }
  };

  const handleError = (err: Error) => {
    console.error(err);
    setError(`Error accessing camera: ${err.message}`);
    toast({
      title: "Camera Error",
      description: "Unable to access your camera. Please check your permissions.",
      variant: "destructive"
    });
  };

  const resetScanner = () => {
    setError(null);
    setScanning(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gradient-clip">
            Scan Worksheet QR Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={resetScanner} className="bg-gradient-orange-magenta hover:bg-gradient-orange-magenta">
                Try Again
              </Button>
            </div>
          ) : (
            <div className="aspect-square rounded-lg overflow-hidden border-2 border-blue-200 mb-4">
              {scanning && (
                <QrScanner
                  delay={300}
                  onError={handleError}
                  onScan={handleScan}
                  style={{ width: "100%", height: "100%" }}
                  constraints={{
                    audio: false,
                    video: { facingMode: "environment" }
                  }}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QrScannerPage;