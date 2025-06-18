import React from 'react';
import SetupChecker from '@/components/SetupChecker';

const SetupPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Supabase Configuration Setup
          </h1>
          <p className="text-gray-600">
            Check and configure your Supabase environment for secure PDF handling
          </p>
        </div>
        <SetupChecker />
      </div>
    </div>
  );
};

export default SetupPage;