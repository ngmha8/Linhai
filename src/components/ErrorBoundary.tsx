import React, { useState, useEffect, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

export const ErrorBoundary: React.FC<Props> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      setHasError(true);
      setError(event.error);
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      setHasError(true);
      setError(event.reason);
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }, []);

  const handleReset = () => {
    setHasError(false);
    setError(null);
    window.location.reload();
  };

  if (hasError) {
    let errorMessage = "Đã có lỗi xảy ra. Vui lòng thử lại.";
    
    try {
      if (error?.message) {
        const parsed = JSON.parse(error.message);
        if (parsed.error && parsed.error.includes('permission')) {
          errorMessage = "Bạn không có quyền thực hiện thao tác này hoặc phiên làm việc đã hết hạn.";
        }
      }
    } catch (e) {
      // Not a JSON error
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-tg-bg">
        <Card className="w-full max-w-md tg-card">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertCircle className="text-destructive w-6 h-6" />
            <CardTitle>Rất tiếc!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-tg-hint">{errorMessage}</p>
            <Button 
              onClick={handleReset}
              className="w-full tg-button flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              Thử lại
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
