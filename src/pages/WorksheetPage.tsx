import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import WorksheetViewer from "@/components/WorksheetViewer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";

const WorksheetPage: React.FC = () => {
  const { id, n } = useParams<{ id: string; n: string }>();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);
  
  const goBack = () => {
    navigate("/");
  };

  // Fetch current user session
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        setIsLoadingUser(true);
        setUserError(null);
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        if (session?.user?.id) {
          setUserId(session.user.id);
        } else {
          // For demo purposes, we'll use a default user ID if no session exists
          // In production, you might want to redirect to login or handle this differently
          console.warn("No authenticated user found, using demo user ID");
          setUserId("demo-user-id");
        }
      } catch (error: any) {
        console.error("Error fetching user session:", error);
        setUserError("Failed to authenticate user");
        // For demo purposes, fallback to demo user ID
        setUserId("demo-user-id");
      } finally {
        setIsLoadingUser(false);
      }
    };

    getCurrentUser();
  }, []);

  if (!id || !n) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4">
          Missing worksheet information
        </h1>
        <Button onClick={goBack} className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white">
          Return to Scanner
        </Button>
      </div>
    );
  }

  const pageIndex = parseInt(n, 10);
  
  if (isNaN(pageIndex)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4">
          Invalid page number
        </h1>
        <Button onClick={goBack} className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white">
          Return to Scanner
        </Button>
      </div>
    );
  }

  // Show loading while fetching user
  if (isLoadingUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-xl font-semibold mb-4">
          Authenticating...
        </h1>
        <p className="text-gray-600">Please wait while we verify your access.</p>
      </div>
    );
  }

  // Show error if user authentication failed
  if (userError && !userId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4">
          Authentication Error
        </h1>
        <p className="text-gray-600 mb-4">{userError}</p>
        <Button onClick={goBack} className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white">
          Return to Scanner
        </Button>
      </div>
    );
  }

  // Render the worksheet viewer with userId
  return (
    <div className="min-h-screen bg-gray-50">
      <WorksheetViewer 
        worksheetId={id} 
        pageIndex={pageIndex} 
        userId={userId!} 
      />
    </div>
  );
};

export default WorksheetPage;