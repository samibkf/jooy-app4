
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
      // Parse QR code data
      const qrData = data.text;
      
      // QR format should be <ID><N> (e.g., ZERTY1)
      // Use regex to extract ID and page number
      const match = qrData.match(/^([A-Za-z]+)(\d+)$/);
      
      if (match) {
        const id = match[1];
        const n = match[2];
        
        console.log(`Valid QR detected: ID=${id}, Page=${n}`);
        setScanning(false);
        
        // Navigate to worksheet page
        navigate(`/worksheet/${id}/${n}`);
      } else {
        // Invalid QR format
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
          <CardTitle className="text-2xl font-bold text-blue-600">
            Scan Worksheet QR Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={resetScanner} className="bg-blue-500 hover:bg-blue-600">
                Try Again
              </Button>
            </div>
          ) : (
            <>
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
              <p className="text-sm text-gray-500 text-center">
                Position the QR code within the frame to scan
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QrScannerPage;
