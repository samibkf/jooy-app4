import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface SetupStatus {
  secrets: {
    PDF_ENCRYPTION_KEY: string;
  };
  status: string;
  instructions: string;
}

const SetupChecker: React.FC = () => {
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const checkSetup = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('setup-secrets', {
        body: { action: 'check-secrets' }
      });

      if (error) {
        console.error('Setup check error:', error);
        return;
      }

      setSetupStatus(data);
    } catch (error) {
      console.error('Failed to check setup:', error);
    } finally {
      setLoading(false);
    }
  };

  const testEncryption = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('setup-secrets', {
        body: { action: 'test-encryption' }
      });

      if (error) {
        setTestResult({ success: false, error: error.message });
        return;
      }

      setTestResult(data);
    } catch (error) {
      setTestResult({ success: false, error: error.message });
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    checkSetup();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Set':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'Missing':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Ready':
        return <Badge variant="default" className="bg-green-500">Ready</Badge>;
      case 'Needs Configuration':
        return <Badge variant="destructive">Needs Setup</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Supabase Setup Status
            {setupStatus && getStatusBadge(setupStatus.status)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p>Checking setup...</p>
          ) : setupStatus ? (
            <>
              <div className="space-y-2">
                <h3 className="font-semibold">Environment Secrets:</h3>
                {Object.entries(setupStatus.secrets).map(([key, status]) => (
                  <div key={key} className="flex items-center justify-between p-2 border rounded">
                    <span className="font-mono text-sm">{key}</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      <span className="text-sm">{status}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm">{setupStatus.instructions}</p>
              </div>

              {setupStatus.status === 'Needs Configuration' && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 mb-2">Setup Instructions:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-700">
                    <li>Go to your Supabase project dashboard</li>
                    <li>Navigate to Settings → Edge Functions</li>
                    <li>Add a new secret:</li>
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li>Name: <code className="bg-yellow-100 px-1 rounded">PDF_ENCRYPTION_KEY</code></li>
                      <li>Value: <code className="bg-yellow-100 px-1 rounded">a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6</code></li>
                    </ul>
                    <li>Save the secret</li>
                    <li>Click "Refresh Status" below</li>
                  </ol>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={checkSetup} disabled={loading}>
                  Refresh Status
                </Button>
                
                {setupStatus.status === 'Ready' && (
                  <Button 
                    onClick={testEncryption} 
                    disabled={testing}
                    variant="outline"
                  >
                    {testing ? 'Testing...' : 'Test Encryption'}
                  </Button>
                )}
              </div>

              {testResult && (
                <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className={`font-semibold ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                      {testResult.success ? 'Encryption Test Passed!' : 'Encryption Test Failed'}
                    </span>
                  </div>
                  {testResult.message && (
                    <p className={`text-sm mt-1 ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                      {testResult.message}
                    </p>
                  )}
                  {testResult.error && (
                    <p className="text-sm mt-1 text-red-700">
                      Error: {testResult.error}
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p>Failed to check setup status</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupChecker;